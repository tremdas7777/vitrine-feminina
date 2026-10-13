import type { OrderItem } from "@/lib/cart";

/**
 * Ofertas da tela pós-compra (Pix):
 * - "kit": mais 1 unidade do item principal do pedido (o mais caro), igual — mesma cor e
 *   tamanho, ou o mesmo kit —, com desconto. O id interno continua "kit".
 * - "palmilha": palmilha de gel (produto físico, vai no envio do upsell).
 * - "seguro": seguro de entrega.
 * - "expresso": envio expresso (página própria, cobrança separada).
 * Desconto e preços editáveis no /admin → Preços.
 */
export const UPSELL_OFFER = {
  /** Desconto sobre o preço pago no pedido (%). */
  pct: 40,
};

/**
 * Evento do Meta para as ofertas pós-compra pagas. Não é "Purchase": o Meta conta uma compra por
 * pedido (a do pedido principal) e o valor das ofertas fica neste evento à parte.
 */
export const UPSELL_META_EVENT = "UpsellPurchase";

/** Nome enviado ao gateway na cobrança do upsell (genérico). */
export const UPSELL_GATEWAY_NAME = "Pedido Vitrine Feminina";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Item do pedido que vira a oferta "mais 1 igual" (o de maior valor unitário). */
export function upsellBaseOf(items: readonly OrderItem[] | undefined): OrderItem | null {
  if (!items?.length) return null;
  return [...items].sort((a, b) => b.unitPrice - a.unitPrice)[0] ?? null;
}

export const upsellPrice = (base: OrderItem) =>
  round2(base.unitPrice * (1 - UPSELL_OFFER.pct / 100));

/** Ofertas da tela pós-compra. */
export const UPSELL_PRODUCTS = ["kit", "palmilha", "seguro", "expresso"] as const;
export type UpsellProduct = (typeof UPSELL_PRODUCTS)[number];

/** Palmilha de gel (pós-compra): produto físico, enviado junto com o pedido. */
export const INSOLE_OFFER: {
  name: string;
  fullName: string;
  gatewayName: string;
  price: number;
  compareAt?: number;
  img: string;
} = {
  name: "Palmilha de gel",
  fullName: "Palmilha ortopédica de gel",
  /** Nome enviado ao gateway. */
  gatewayName: UPSELL_GATEWAY_NAME,
  price: 14.9,
  compareAt: 24.9,
  img: "/ofertas/palmilha.svg",
};

/** Ofertas pós-compra que têm produto físico (geram envio no rastreio). */
export const PHYSICAL_UPSELLS: readonly UpsellProduct[] = ["kit", "palmilha"];

/** Seguro de entrega (pós-compra): reenvio ou reembolso em caso de extravio ou dano no transporte. */
export const SHIPPING_INSURANCE = {
  name: "Seguro de entrega",
  fullName: "Seguro de entrega — reenvio ou reembolso",
  /** Nome enviado ao gateway. */
  gatewayName: "Seguro de entrega",
  price: 19.9,
};

/** Envio expresso: página própria depois da tela de ofertas (cobrança separada). */
export const EXPRESS_SHIPPING = {
  name: "Envio expresso",
  /** Nome enviado ao gateway. */
  gatewayName: "Envio expresso",
  price: 29.9,
};

/**
 * O que o cliente escolheu na tela pós-compra, numa cobrança só (preços do servidor).
 * Itens repetidos ou desconhecidos são ignorados; a ordem segue UPSELL_PRODUCTS.
 * Sem item principal no pedido, a oferta "kit" fica de fora.
 */
export function upsellSelection(base: OrderItem | null, chosen: readonly string[]) {
  const products = UPSELL_PRODUCTS.filter((p) => chosen.includes(p) && (p !== "kit" || !!base));
  const items = products.map((p) => {
    if (p === "kit" && base)
      return {
        product: p,
        title: UPSELL_GATEWAY_NAME,
        price: upsellPrice(base),
        label: `+1 ${base.kit ? "kit" : "unidade"} ${UPSELL_OFFER.pct}% OFF`,
      };
    const o =
      p === "palmilha" ? INSOLE_OFFER : p === "seguro" ? SHIPPING_INSURANCE : EXPRESS_SHIPPING;
    return { product: p, title: o.gatewayName, price: o.price, label: o.name };
  });
  const total = Math.round(items.reduce((s, i) => s + i.price * 100, 0)) / 100;
  return { products, items, total, label: items.map((i) => i.label).join(" + ") };
}
