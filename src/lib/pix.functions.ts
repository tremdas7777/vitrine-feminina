import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { brl, FREE_SHIPPING_MIN } from "@/lib/shipping";
import { brand } from "@/lib/brand";
import {
  cartSchema,
  cartSubtotal,
  cartSummary,
  couponDiscount,
  couponPct,
  freeShippingFor,
  resolveCart,
  toOrderItem,
} from "@/lib/cart";
import { imgSmall } from "@/lib/catalog";
import { bumpsTotal, getBumps } from "@/lib/order-bump";
import {
  saveOrder,
  fetchGatewayStatus,
  reportPaidOnce,
  finalizeMetaPurchase,
  flushDueMetaPurchases,
  reportPendingToUtmify,
  getOrder,
  findUpsellOf,
} from "@/lib/pix-orders.server";
import { createPix } from "@/lib/pix-gateway.server";
import { syncPricesFromDb } from "@/lib/prices.server";
import { isPaidStatus } from "@/lib/pix-status";
import { INSOLE_OFFER, UPSELL_PRODUCTS, upsellBaseOf, upsellSelection } from "@/lib/upsell";
import { getRequest } from "@tanstack/react-start/server";
import { checkoutTotals } from "@/lib/payment-pricing";

const utmSchema = z.record(z.string(), z.string().max(300).nullable()).optional().default({});

function isValidCpf(raw: string): boolean {
  const c = raw.replace(/\D/g, "");
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  for (const t of [9, 10]) {
    let sum = 0;
    for (let i = 0; i < t; i++) sum += Number(c[i]) * (t + 1 - i);
    const d = ((sum * 10) % 11) % 10;
    if (d !== Number(c[t])) return false;
  }
  return true;
}

const customerSchema = z.object({
  // Itens da sacola: o servidor confere produto, cor, tamanho e estoque e calcula o preço.
  items: cartSchema,
  coupon: z.string().trim().max(40).optional(),
  name: z.string().trim().min(3).max(120),
  email: z.string().trim().email().max(160),
  phone: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .pipe(z.string().min(10).max(11)),
  cpf: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .refine(isValidCpf, "CPF inválido"),
  origin: z.string().url(),
  frete: z.enum(["gratis", "padrao", "express"]).default("padrao"),
  endereco: z.string().max(300).optional(),
  // Endereço por partes (RastroCode). Opcional: clientes antigos não enviam.
  address: z
    .object({
      street: z.string().trim().min(1).max(200),
      number: z.string().trim().min(1).max(20),
      complement: z.string().trim().max(200).optional(),
      neighborhood: z.string().trim().min(1).max(120),
      city: z.string().trim().min(1).max(120),
      state: z.string().trim().length(2),
      zipcode: z.string().regex(/^\d{8}$/),
    })
    .optional(),
  // Ids dos order bumps; desconhecidos são ignorados (o preço vem sempre do servidor).
  bumps: z.array(z.string().max(40)).max(10).default([]),
  utm: utmSchema,
});

/** Order bumps do pedido, com preço do servidor. */
const chosenBumps = (d: { bumps: readonly string[] }) => getBumps(d.bumps);
const storedBumps = (d: { bumps: readonly string[] }) =>
  chosenBumps(d).map((b) => ({ id: b.id, name: b.fullName, price: b.price }));
const orderName = (summary: string, d: { bumps: readonly string[] }) => {
  const name = [summary, ...chosenBumps(d).map((b) => b.name)].join(" + ");
  return name.length > 120 ? `${name.slice(0, 119)}…` : name;
};

/** Regras de preço do checkout (espelhadas no cliente só para exibição). */
export const FRETES = [
  { id: "gratis", name: "Frete Grátis", eta: "7 a 10 dias úteis", price: 0 },
  { id: "padrao", name: "Frete Padrão", eta: "5 dias úteis", price: 20 },
  { id: "express", name: "Frete Express", eta: "1 a 2 dias úteis", price: 37.53 },
] as const;
export type FreteId = (typeof FRETES)[number]["id"];
export const getFrete = (id: FreteId) => FRETES.find((f) => f.id === id) ?? FRETES[0];

export type PixCharge = { id: string; qrcode: string; amount: number; status: string };

function requestMeta() {
  const h = getRequest()?.headers;
  return {
    ip: h?.get("cf-connecting-ip") ?? h?.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    ua: h?.get("user-agent") ?? null,
  };
}

export const createPixCharge = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => customerSchema.parse(d))
  .handler(async ({ data }): Promise<PixCharge> => {
    // Preço sempre definido no servidor (o do /admin → Preços), nunca o do cliente.
    await syncPricesFromDb();
    const lines = resolveCart(data.items);
    // Algum item mudou (esgotou, cor/tamanho removidos): o cliente revisa a sacola antes de pagar.
    if (lines.length !== data.items.length)
      throw new Error("Algum item da sua sacola não está mais disponível. Revise a sacola.");
    const productsTotal = cartSubtotal(lines) + bumpsTotal(chosenBumps(data).map((b) => b.id));
    const coupon = couponPct(data.coupon) ? data.coupon!.trim().toUpperCase() : null;
    const discount = couponDiscount(productsTotal, coupon);
    if (data.frete === "gratis" && !freeShippingFor(productsTotal, lines)) {
      throw new Error(
        `Frete grátis disponível para compras acima de ${brl(FREE_SHIPPING_MIN)} ou levando 2 tênis ou mais.`,
      );
    }
    const freteOpt = getFrete(data.frete);
    const totals = checkoutTotals({ products: productsTotal, frete: freteOpt.price, discount });
    const amount = totals.total;
    const { ip, ua } = requestMeta();
    // Pix gerado no gateway escolhido no /admin (SagacePay, PixGate ou MagicPay).
    const charge = await createPix({
      amount,
      customer: { name: data.name, email: data.email, phone: data.phone, cpf: data.cpf },
      // Nome genérico enviado ao gateway, sem detalhes do produto real.
      description: brand.chargeDescription,
      origin: data.origin,
      address: data.address,
      ip,
    });
    // Guarda o pedido no servidor para reportar a aprovação mesmo sem o cliente na página.
    const orderData = {
      createdAt: Date.now(),
      id: charge.id,
      amountCents: amount,
      customer: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        cpf: data.cpf,
        endereco: data.endereco?.replace(/\s+/g, " ").trim(),
        ...(data.address ? { address: data.address } : {}),
        // Pix copia e cola, para o admin poder reenviar ao cliente.
        qrcode: charge.qrcode,
        frete: { id: freteOpt.id, name: freteOpt.name, price: freteOpt.price },
        bumps: storedBumps(data),
        items: lines.map((l) => toOrderItem(l, imgSmall(l.product))),
        ...(coupon ? { coupon, discount } : {}),
        method: "pix" as const,
      },
      bundleId: "sacola",
      bundleName: orderName(cartSummary(lines), data),
      utm: data.utm,
      ip,
      ua,
    };
    await saveOrder(orderData);
    // Pix gerado → UTMify como pendente (não é conversão; só "paid" conta como venda).
    await reportPendingToUtmify(orderData);
    return { id: charge.id, qrcode: charge.qrcode, amount, status: charge.status };
  });

/**
 * Etapa do pós-compra: ofertas (kit e/ou seguro) ou envio expresso, que tem página própria e cobrança
 * separada. Devolve a cobrança já feita nesta etapa, se houver.
 */
async function upsellStep(parentId: string, products: readonly string[]) {
  const express = products.includes("expresso");
  if (express && products.length > 1) throw new Error("Oferta inválida.");
  return { existing: await findUpsellOf(parentId, express) };
}

/**
 * Upsell pós-compra no Pix: kit extra (mais 1 kit igual ao do pedido pago, com desconto) e/ou seguro de
 * entrega, num Pix só.
 * Usa os dados já salvos do pedido original — o cliente não digita nada de novo.
 */
export const createUpsellCharge = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        parentId: z.string().regex(/^[\w-]{1,64}$/),
        origin: z.string().url(),
        // Ofertas marcadas na tela pós-compra (kit extra, seguro de entrega e envio expresso), numa cobrança só.
        products: z
          .array(z.enum(UPSELL_PRODUCTS))
          .min(1)
          .max(UPSELL_PRODUCTS.length)
          .default(["kit"]),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<PixCharge> => {
    await syncPricesFromDb();
    const parent = await getOrder(data.parentId);
    if (!parent || parent.customer?.upsellOf) throw new Error("Pedido não encontrado.");
    if (!isPaidStatus(parent.status)) {
      const { status } = await fetchGatewayStatus(parent.id);
      if (!isPaidStatus(status)) throw new Error("Pedido ainda não foi pago.");
    }

    // Já existe esta etapa do upsell para este pedido: reaproveita em vez de gerar outra cobrança.
    const { existing } = await upsellStep(parent.id, data.products);
    if (existing?.customer.qrcode) {
      return {
        id: existing.id,
        qrcode: existing.customer.qrcode,
        amount: existing.amount_cents,
        status: existing.status,
      };
    }

    const base = upsellBaseOf(parent.customer.items);
    const sel = upsellSelection(base, data.products);
    if (!sel.products.length) throw new Error("Escolha uma oferta.");
    const amount = Math.round(sel.total * 100);
    const c = parent.customer;
    const { ip, ua } = requestMeta();
    const charge = await createPix({
      amount,
      customer: { name: c.name, email: c.email, phone: c.phone, cpf: c.cpf },
      description: brand.chargeDescription,
      origin: data.origin,
      address: c.address,
      ip,
    });
    const orderData = {
      createdAt: Date.now(),
      id: charge.id,
      amountCents: amount,
      customer: {
        name: c.name,
        email: c.email,
        phone: c.phone,
        cpf: c.cpf,
        endereco: c.endereco,
        ...(c.address ? { address: c.address } : {}),
        frete: { id: "junto", name: `Junto com o pedido ${parent.id}`, price: 0 },
        upsellOf: parent.id,
        upsellItems: sel.products,
        ...(sel.products.includes("palmilha")
          ? {
              extras: sel.items
                .filter((i) => i.product === "palmilha")
                .map((i) => ({ id: i.product, name: INSOLE_OFFER.fullName, price: i.price })),
            }
          : {}),
        ...(base && sel.products.includes("kit")
          ? {
              items: [
                {
                  ...base,
                  qty: 1,
                  unitPrice: sel.items[0]!.price,
                  pieces: base.line.kit ? base.line.units.length : 1,
                },
              ],
            }
          : {}),
        qrcode: charge.qrcode,
      },
      bundleId: "upsell",
      bundleName: `Upsell: ${sel.label}`,
      utm: parent.utm ?? undefined,
      ip,
      ua,
      fbp: parent.fbp,
      fbc: parent.fbc,
    };
    await saveOrder(orderData);
    // Pix gerado → UTMify como pendente (não é conversão; só "paid" conta como venda).
    await reportPendingToUtmify(orderData);
    return { id: charge.id, qrcode: charge.qrcode, amount, status: charge.status };
  });

export const getPixStatus = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().regex(/^[\w-]{1,64}$/),
        report: z
          .object({
            name: z.string().max(120),
            email: z.string().max(160),
            phone: z.string().max(20),
            cpf: z.string().max(14),
            bundleId: z.string().max(20),
            bundleName: z.string().max(200),
            createdAt: z.number(),
            utm: utmSchema,
            fbp: z.string().max(200).nullable().optional(),
            fbc: z.string().max(300).nullable().optional(),
            url: z.string().max(1000).optional(),
          })
          .optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<{ status: string; paid: boolean }> => {
    const { status, amount } = await fetchGatewayStatus(data.id);
    const paid = isPaidStatus(status);
    // Só pagamento confirmado pelo gateway (servidor) vira conversão — reportado uma única vez.
    if (paid) {
      const h = getRequest()?.headers;
      await reportPaidOnce(data.id, amount, {
        fbp: data.report?.fbp,
        fbc: data.report?.fbc,
        url: data.report?.url,
        ip: h?.get("cf-connecting-ip") ?? h?.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
        ua: h?.get("user-agent") ?? null,
      });
    }
    await flushDueMetaPurchases();
    return { status, paid };
  });

/**
 * Fim do pós-compra (tela de obrigado): envia ao Meta a compra do pedido com o valor do pedido +
 * ofertas pagas e devolve esse valor para o pixel do navegador usar o mesmo (mesmo event_id).
 */
export const finalizeMetaPurchaseFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().regex(/^[\w-]{1,64}$/) }).parse(d))
  .handler(async ({ data }) => finalizeMetaPurchase(data.id));
