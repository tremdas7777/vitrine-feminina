// Pedidos Pix guardados no servidor para que a aprovação seja reportada
// (UTMify + Meta CAPI) mesmo que o cliente feche a página. Somente servidor.
import { sendUtmifyOrder, type UtmParams } from "@/lib/utmify.server";
import { sendCapiEvent } from "@/lib/meta.server";
import { sendRotasyncOrder, type RotasyncAddress } from "@/lib/rotasync.server";
import { brand } from "@/lib/brand";
import type { OrderItem } from "@/lib/cart";
import { isPaidStatus } from "@/lib/pix-status";
import { fetchPixStatus } from "@/lib/pix-gateway.server";
import { notifyPushcut, type PushcutResult } from "@/lib/pushcut.server";
import { PHYSICAL_UPSELLS, UPSELL_META_EVENT, type UpsellProduct } from "@/lib/upsell";

export type StoredCustomer = {
  name: string;
  email: string;
  phone: string;
  cpf: string;
  endereco?: string;
  /** Endereço por partes (pedidos a partir da integração com a RastroCode). */
  address?: RotasyncAddress;
  frete?: { id: string; name: string; price: number };
  bumps?: { id: string; name: string; price: number }[];
  /** Itens da sacola (cor, tamanho, kit) com o preço cobrado. */
  items?: OrderItem[];
  /** Cupom aplicado e o desconto (reais). */
  coupon?: string;
  /** Formato antigo (um só bump). */
  bump?: { id: string; name: string; price: number };
  /** Id do pedido original quando este é um upsell pós-compra. */
  upsellOf?: string;
  /** Ofertas pós-compra desta cobrança (sem o campo = só o item extra). */
  upsellItems?: UpsellProduct[];
  /** Upsell: ofertas físicas sem item do catálogo (ex.: palmilha), com o preço cobrado. */
  extras?: { id: string; name: string; price: number }[];
  /** Código Pix copia-e-cola (guardado no upsell para reexibir sem cobrar de novo). */
  qrcode?: string;
  /** Forma de pagamento (pedidos antigos não têm: são Pix). */
  method?: "pix" | "card";
  installments?: number;
  card?: { brand?: string; lastDigits?: string };
  /** Desconto do Pix aplicado (reais). */
  discount?: number;
  /** Cobrança de teste (admin) feita após o pedido indicado. Não é reportada a lugar nenhum. */
  testOf?: string;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // Tabela nova ainda não presente nos tipos gerados.
  return supabaseAdmin as unknown as { from: (t: string) => any };
}

export async function saveOrder(o: {
  id: string;
  amountCents: number;
  customer: StoredCustomer;
  bundleId: string;
  bundleName: string;
  utm?: UtmParams;
  ip?: string | null;
  ua?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  /** Momento da criação (ms). O mesmo valor vai para a UTMify no "pendente" e no "pago". */
  createdAt?: number;
}): Promise<void> {
  try {
    const db = await admin();
    const { error } = await db.from("pix_orders").upsert({
      id: o.id,
      ...(o.createdAt ? { created_at: new Date(o.createdAt).toISOString() } : {}),
      amount_cents: o.amountCents,
      customer: o.customer,
      bundle_id: o.bundleId,
      bundle_name: o.bundleName,
      utm: o.utm ?? {},
      ip: o.ip ?? null,
      ua: o.ua ?? null,
      fbp: o.fbp ?? null,
      fbc: o.fbc ?? null,
    });
    if (error) console.error("saveOrder error", error.message);
  } catch (e) {
    console.error("saveOrder failed", e);
  }
}

export type StoredOrder = {
  id: string;
  status: string;
  amount_cents: number;
  customer: StoredCustomer;
  bundle_id: string;
  bundle_name: string;
  utm: UtmParams | null;
  fbp: string | null;
  fbc: string | null;
  ip?: string | null;
  ua?: string | null;
  report_result?: unknown;
};

export async function getOrder(id: string): Promise<StoredOrder | null> {
  const db = await admin();
  const { data } = await db.from("pix_orders").select("*").eq("id", id).maybeSingle();
  return (data as StoredOrder | null) ?? null;
}

/**
 * Upsell já gerado para um pedido (evita cobranças duplicadas). São duas etapas independentes:
 * as ofertas (kit e/ou seguro) e, depois, o envio expresso.
 */
export async function findUpsellOf(parentId: string, express = false): Promise<StoredOrder | null> {
  const db = await admin();
  const { data } = await db
    .from("pix_orders")
    .select("*")
    .eq("customer->>upsellOf", parentId)
    .order("created_at", { ascending: false })
    .limit(10);
  const rows = (data ?? []) as StoredOrder[];
  return rows.find((o) => !!o.customer?.upsellItems?.includes("expresso") === express) ?? null;
}

/**
 * Avisa a UTMify que o Pix foi gerado (status "waiting_payment"). Isso NÃO conta como venda/conversão:
 * a UTMify só considera venda quando o mesmo orderId chega depois com status "paid".
 */
export async function reportPendingToUtmify(o: {
  id: string;
  amountCents: number;
  customer: StoredCustomer;
  bundleId: string;
  bundleName: string;
  utm?: UtmParams;
  ip?: string | null;
  createdAt: number;
}): Promise<void> {
  // Pushcut "Pix gerado" (com o valor), em paralelo com a UTMify.
  const pushcutPending = notifyPushcut("pending", {
    amountCents: o.amountCents,
    orderId: o.id,
  });
  const r = await sendUtmifyOrder({
    orderId: o.id,
    status: "waiting_payment",
    // A UTMify exige a MESMA data de criação no envio pendente e no pago.
    createdAt: o.createdAt,
    approvedAt: null,
    customer: {
      name: o.customer.name,
      email: o.customer.email,
      phone: o.customer.phone,
      document: o.customer.cpf,
      ip: o.ip ?? null,
    },
    product: { id: o.bundleId, name: `${brand.name} - ${o.bundleName}` },
    amountCents: o.amountCents,
    utm: o.utm ?? {},
    paymentMethod: o.customer.method === "card" ? "credit_card" : "pix",
  });
  if (!r.ok) console.error("UTMify pending failed", o.id, r.error);
  // Guarda a resposta no pedido para aparecer no admin (seção Técnico).
  try {
    const db = await admin();
    await db
      .from("pix_orders")
      .update({
        report_result: {
          utmifyPending: { ...r, at: new Date().toISOString() },
          pushcutPending: await pushcutPending,
        },
      })
      .eq("id", o.id)
      .is("paid_reported_at", null);
  } catch (e) {
    console.error("UTMify pending save failed", e);
  }
}

export { isPaidStatus };

/** Consulta o status real no gateway em que o Pix foi gerado (SagacePay, PixGate ou MagicPay). */
export async function fetchGatewayStatus(id: string): Promise<{ status: string; amount: number }> {
  return fetchPixStatus(id);
}

/**
 * Reporta a venda aprovada uma única vez (idempotente via paid_reported_at).
 * `extra` traz cookies do Meta/URL quando a chamada vem do navegador.
 */
export async function reportPaidOnce(
  id: string,
  gatewayAmount: number,
  extra?: {
    fbp?: string | null;
    fbc?: string | null;
    url?: string;
    ip?: string | null;
    ua?: string | null;
  },
): Promise<void> {
  try {
    const db = await admin();
    // Trava atômica: só quem conseguir marcar paid_reported_at envia.
    const { data: rows, error } = await db
      .from("pix_orders")
      .update({
        status: "paid",
        paid_reported_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .is("paid_reported_at", null)
      .select("*");
    if (error) {
      console.error("reportPaidOnce lock error", error.message);
      return;
    }
    const o = rows?.[0];
    if (!o) return; // já reportado ou pedido desconhecido

    // Cobrança de teste do admin: marca como paga, mas não vira venda em lugar nenhum.
    if ((o.customer as StoredCustomer)?.testOf) {
      await db
        .from("pix_orders")
        .update({
          report_result: { skipped: "cobrança de teste do admin", at: new Date().toISOString() },
        })
        .eq("id", id);
      return;
    }

    const amount =
      Number.isFinite(gatewayAmount) && gatewayAmount > 0 ? gatewayAmount : o.amount_cents;
    const c = o.customer as StoredCustomer;
    const productName = `${brand.name} - ${o.bundle_name}`;
    // Canal que já confirmou o recebimento numa tentativa anterior não recebe de novo (sem duplicar venda).
    const done = (o.report_result ?? {}) as {
      utmify?: { ok?: boolean };
      meta?: { ok?: boolean };
      pushcut?: PushcutResult;
    };
    // Pushcut "Venda aprovada" (com o valor): uma vez por pedido, mesmo se a UTMify/Meta forem
    // reenviados numa nova tentativa.
    const pushcut = done.pushcut?.ok
      ? done.pushcut
      : await notifyPushcut("paid", {
          amountCents: amount,
          orderId: id,
        });
    const utmify = done.utmify?.ok
      ? done.utmify
      : await sendUtmifyOrder({
          orderId: id,
          status: "paid",
          createdAt: new Date(o.created_at).getTime(),
          approvedAt: Date.now(),
          customer: { name: c.name, email: c.email, phone: c.phone, document: c.cpf, ip: o.ip },
          product: { id: o.bundle_id, name: productName },
          amountCents: amount,
          utm: o.utm ?? {},
          paymentMethod: c.method === "card" ? "credit_card" : "pix",
        });
    // Meta: uma compra por pedido, com o valor do pedido + ofertas pós-compra pagas. A do pedido
    // principal espera o fim do pós-compra (finalizeMetaPurchase); a oferta paga entra nessa soma.
    // Oferta paga depois que a compra já foi enviada vai como evento à parte (não soma compra).
    const user = {
      fbp: extra?.fbp ?? o.fbp ?? null,
      fbc: extra?.fbc ?? o.fbc ?? null,
      ip: extra?.ip ?? o.ip ?? null,
      ua: extra?.ua ?? o.ua ?? null,
    };
    let meta: Record<string, unknown> & { ok: boolean };
    if (done.meta?.ok) meta = done.meta as typeof meta;
    else if (!c.upsellOf) {
      const pending: MetaPending = {
        ok: true,
        deferred: true,
        until: Date.now() + META_HOLD_MS,
        user,
        url: extra?.url ?? null,
      };
      meta = pending;
    } else {
      const parent = await getOrder(c.upsellOf);
      const pm = (parent?.report_result as { meta?: MetaPending & MetaSent } | null)?.meta;
      // Compra do pedido principal ainda não enviada: esta oferta entra na soma dela.
      if (!pm || pm.deferred) meta = { ok: true, skipped: "somado à compra do pedido principal" };
      else if (pm.upsellIds?.includes(id)) meta = { ok: true, skipped: "já somado à compra" };
      else
        meta = await sendCapiEvent({
          eventName: UPSELL_META_EVENT,
          eventId: `upsell-${id}`,
          url: extra?.url,
          user: { email: c.email, phone: c.phone, name: c.name, cpf: c.cpf, ...user },
          customData: {
            value: amount / 100,
            currency: "BRL",
            content_name: productName,
            content_type: "product",
            order_id: c.upsellOf,
          },
        });
    }
    // Rastreio (Rotasync): pedido principal e upsell com item extra viram envios próprios (o pedido
    // principal já foi repassado quando o upsell é pago). Seguro e expresso não têm produto físico.
    // Se a API já respondeu de forma definitiva (sucesso, 422, 401, 402, 403), não reenvia.
    const prev = (o.report_result as { rastro?: { ok?: boolean; status?: number } } | null)?.rastro;
    const rastroDone =
      !!prev && (prev.ok || [401, 402, 403, 413, 415, 422].includes(prev.status ?? 0));
    const isUpsell = !!c.upsellOf;
    const upsellItems = c.upsellItems ?? ["kit"];
    const shipsKit = !isUpsell || upsellItems.some((p) => PHYSICAL_UPSELLS.includes(p));
    const rastro = rastroDone
      ? prev
      : !shipsKit
        ? { ok: true, skipped: "upsell sem produto físico (seguro/expresso)" }
        : !c.address
          ? { ok: false, skipped: "pedido sem endereço por partes" }
          : await sendRotasyncOrder({
              transactionId: id,
              customer: { name: c.name, email: c.email, phone: c.phone, document: c.cpf },
              address: c.address,
              products: [
                // Uma linha por item, com cor/tamanho (ou as unidades do kit) no nome.
                ...(c.items ?? []).map((i) => ({
                  name: `${i.title} (${i.detail})`.slice(0, 250),
                  quantity: i.qty,
                  price: i.unitPrice,
                })),
                ...(isUpsell ? [] : (c.bumps ?? (c.bump ? [c.bump] : []))).map((b) => ({
                  name: b.name,
                  quantity: 1,
                  price: b.price,
                })),
                ...(isUpsell && c.extras?.length ? c.extras : []).map((x) => ({
                  name: x.name,
                  quantity: 1,
                  price: x.price,
                })),
              ],
            });
    // O rastreio fica fora do allOk: é idempotente por external_id e um 422 não deve ser retentado.
    const allOk = utmify.ok && meta.ok;
    console.log("reportPaidOnce", id, JSON.stringify({ utmify, meta, rastro, pushcut }));
    // Guarda o resultado; se algo falhou, libera a trava para nova tentativa.
    await db
      .from("pix_orders")
      .update({
        report_result: {
          ...((o.report_result as Record<string, unknown> | null) ?? {}),
          utmify,
          meta,
          rastro,
          pushcut,
          at: new Date().toISOString(),
        },
        ...(allOk ? {} : { paid_reported_at: null }),
        ...(extra?.fbp ? { fbp: extra.fbp } : {}),
        ...(extra?.fbc ? { fbc: extra.fbc } : {}),
      })
      .eq("id", id);
  } catch (e) {
    console.error("reportPaidOnce failed", e);
  }
}

// ---------- Meta: compra única por pedido (pedido + ofertas pós-compra) ----------

/** Quanto a compra do pedido principal espera o pós-compra antes de ir sozinha para o Meta. */
export const META_HOLD_MS = 35 * 60 * 1000;

type MetaUser = { fbp: string | null; fbc: string | null; ip: string | null; ua: string | null };
type MetaPending = { ok: true; deferred: true; until: number; user: MetaUser; url: string | null };
type MetaSent = { ok: boolean; sentAt?: string; value?: number; upsellIds?: string[] };

/**
 * Envia ao Meta a compra (Purchase) do pedido principal com o valor do pedido + ofertas pós-compra
 * já pagas. Idempotente: se já foi enviada, só devolve o valor. O event_id é o mesmo do navegador
 * (purchase-<id>), então o Meta conta uma compra só.
 */
export async function finalizeMetaPurchase(
  parentId: string,
): Promise<{ value: number; name: string } | null> {
  const db = await admin();
  const parent = await getOrder(parentId);
  if (!parent || parent.customer?.upsellOf || parent.status !== "paid") return null;
  const rr = (parent.report_result ?? {}) as Record<string, unknown> & {
    meta?: Partial<MetaPending> & MetaSent;
  };
  const m = rr.meta;
  const name = `${brand.name} - ${parent.bundle_name}`;
  if (!m?.deferred) return m?.value ? { value: m.value, name } : null;

  const { data } = await db
    .from("pix_orders")
    .select("id, amount_cents, status, customer")
    .eq("customer->>upsellOf", parentId)
    .eq("status", "paid");
  const upsells = ((data ?? []) as Pick<StoredOrder, "id" | "amount_cents" | "customer">[]).filter(
    (u) => !u.customer?.testOf,
  );
  const cents = parent.amount_cents + upsells.reduce((s, u) => s + u.amount_cents, 0);
  const value = cents / 100;
  const c = parent.customer;
  const user = m.user ?? { fbp: parent.fbp, fbc: parent.fbc, ip: parent.ip, ua: parent.ua };
  const result = await sendCapiEvent({
    eventName: "Purchase",
    eventId: `purchase-${parentId}`,
    url: m.url ?? undefined,
    user: { email: c.email, phone: c.phone, name: c.name, cpf: c.cpf, ...user },
    customData: {
      value,
      currency: "BRL",
      content_name: name,
      content_ids: c.items?.length ? c.items.map((i) => i.slug) : [parent.bundle_id],
      content_type: "product",
      order_id: parentId,
    },
  });
  const meta: Record<string, unknown> = result.ok
    ? { ...result, sentAt: new Date().toISOString(), value, upsellIds: upsells.map((u) => u.id) }
    : { ...m, lastError: result.error ?? "erro" }; // falhou: continua pendente para nova tentativa
  await db
    .from("pix_orders")
    .update({ report_result: { ...rr, meta } })
    .eq("id", parentId);
  return result.ok ? { value, name } : null;
}

let lastFlush = 0;
/**
 * Compras do Meta que passaram do prazo de espera (cliente saiu no meio do pós-compra): envia.
 * Roda junto com o webhook e a consulta de status, no máximo uma vez por minuto.
 */
export async function flushDueMetaPurchases(): Promise<void> {
  if (Date.now() - lastFlush < 60_000) return;
  lastFlush = Date.now();
  try {
    const db = await admin();
    const { data } = await db
      .from("pix_orders")
      .select("id, report_result")
      .eq("status", "paid")
      .eq("report_result->meta->>deferred", "true")
      .limit(50);
    const due = ((data ?? []) as { id: string; report_result: { meta?: { until?: number } } }[])
      .filter((r) => (r.report_result?.meta?.until ?? 0) <= Date.now())
      .slice(0, 10);
    for (const r of due) await finalizeMetaPurchase(r.id);
  } catch (e) {
    console.error("flushDueMetaPurchases failed", e);
  }
}
