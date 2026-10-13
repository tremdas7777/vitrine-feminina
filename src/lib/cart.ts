/**
 * Itens da sacola e o preço de cada um. Funções puras: o navegador usa para exibir e o servidor
 * usa para cobrar (o servidor revalida tudo — produto, cor, tamanho, estoque e preço).
 */
import { z } from "zod";
import { brand } from "@/lib/brand";
import {
  BY_SLUG,
  KIT_UNITS,
  kitPriceOf,
  kitSizesOf,
  priceOf,
  promoOf,
  type Product,
} from "@/lib/catalog";
import { isFreeShippingEligible } from "@/lib/shipping";

export const MAX_QTY = 10;
export const MAX_LINES = 30;

const variant = z.object({
  color: z.string().max(80).nullable(),
  size: z.string().max(20).nullable(),
});

export const cartLineSchema = z.union([
  z.object({
    slug: z.string().max(200),
    qty: z.number().int().min(1).max(MAX_QTY),
    kit: z.literal(true),
    units: z.array(variant).min(2).max(KIT_UNITS),
  }),
  z.object({
    slug: z.string().max(200),
    qty: z.number().int().min(1).max(MAX_QTY),
    kit: z.literal(false).optional(),
    color: z.string().max(80).nullable(),
    size: z.string().max(20).nullable(),
  }),
]);
export const cartSchema = z.array(cartLineSchema).min(1).max(MAX_LINES);

export type CartLine = z.infer<typeof cartLineSchema>;
export type Variant = z.infer<typeof variant>;

export const lineKey = (l: CartLine) =>
  l.kit ? `${l.slug}|kit|${JSON.stringify(l.units)}` : `${l.slug}|${l.color ?? ""}|${l.size ?? ""}`;

/** "Preto · Tam 36" */
export const variantText = (v: Variant) =>
  [v.color, v.size && `Tam ${v.size}`].filter(Boolean).join(" · ");

export type ResolvedLine = {
  line: CartLine;
  product: Product;
  /** Preço de uma unidade da linha (o kit inteiro, quando é kit). */
  unitPrice: number;
  total: number;
  /** Nome para o pedido, o painel e o rastreio. */
  title: string;
  /** Cor/tamanho (ou as unidades do kit). */
  detail: string;
  /** Peças físicas na linha (kit = 3 por unidade). */
  pieces: number;
};

const validVariant = (p: Product, v: Variant) =>
  (p.colors.length === 0 || (!!v.color && p.colors.includes(v.color))) &&
  (p.sizes.length === 0 || (!!v.size && p.sizes.includes(v.size)));

/** Confere a linha contra o catálogo. Devolve null se o produto, a cor ou o tamanho não valem. */
export function resolveLine(line: CartLine): ResolvedLine | null {
  const product = BY_SLUG.get(line.slug);
  if (!product || !product.inStock) return null;
  if (line.kit) {
    const n = line.units.length;
    if (!kitSizesOf(product).includes(n) || !line.units.every((u) => validVariant(product, u)))
      return null;
    const unitPrice = kitPriceOf(product, n);
    return {
      line,
      product,
      unitPrice,
      total: round2(unitPrice * line.qty),
      title: `Kit ${n} unidades — ${product.name}`,
      detail: line.units.map((u, i) => `${i + 1}) ${variantText(u)}`).join(" | "),
      pieces: n * line.qty,
    };
  }
  if (!validVariant(product, line)) return null;
  const unitPrice = priceOf(product);
  return {
    line,
    product,
    unitPrice,
    total: round2(unitPrice * line.qty),
    title: product.name,
    detail: variantText(line),
    pieces: line.qty,
  };
}

/** Linhas válidas da sacola (as inválidas — produto esgotado, cor removida — ficam de fora). */
export const resolveCart = (lines: readonly CartLine[]) =>
  lines.map(resolveLine).filter((l): l is ResolvedLine => !!l);

export const cartSubtotal = (lines: readonly ResolvedLine[]) =>
  round2(lines.reduce((s, l) => s + l.total, 0));

/**
 * Frete grátis: pelo valor (FREE_SHIPPING_MIN) ou pela promoção da categoria — ex.: levando 2 ou
 * mais tênis. Mesma regra no checkout e no servidor.
 */
export function freeShippingFor(products: number, lines: readonly ResolvedLine[]): boolean {
  if (isFreeShippingEligible(products)) return true;
  const byCat = new Map<string, number>();
  for (const l of lines) {
    if (promoOf(l.product)) byCat.set(l.product.cat, (byCat.get(l.product.cat) ?? 0) + l.pieces);
  }
  return [...byCat].some(([cat, pieces]) => {
    const min = lines.find((l) => l.product.cat === cat)?.product;
    return !!min && pieces >= (promoOf(min)?.freeShippingUnits ?? Infinity);
  });
}

/** Oferta do checkout: trocar uma linha avulsa pelo kit de KIT_UNITS e ganhar o frete grátis. */
export type KitUpgrade = {
  /** Linha avulsa que vira kit. */
  from: ResolvedLine;
  units: number;
  /** Preço do kit inteiro. */
  price: number;
  /** Quanto a mais o cliente paga em relação à linha atual. */
  extra: number;
};

/**
 * Primeira linha avulsa (com menos de KIT_UNITS peças) que, trocada pelo kit de KIT_UNITS, libera o
 * frete grátis. null se o frete já é grátis ou se nenhuma troca resolve. `extras` = order bumps.
 */
export function kitUpgradeFor(lines: readonly ResolvedLine[], extras = 0): KitUpgrade | null {
  if (freeShippingFor(cartSubtotal(lines) + extras, lines)) return null;
  for (const from of lines) {
    const { line, product } = from;
    if (line.kit || line.qty >= KIT_UNITS || !kitSizesOf(product).includes(KIT_UNITS)) continue;
    const v: Variant = { color: line.color, size: line.size };
    const kit = resolveLine({
      slug: line.slug,
      qty: 1,
      kit: true,
      units: Array.from({ length: KIT_UNITS }, () => v),
    });
    if (!kit) continue;
    const next = lines.map((l) => (l === from ? kit : l));
    if (!freeShippingFor(cartSubtotal(next) + extras, next)) continue;
    return {
      from,
      units: KIT_UNITS,
      price: kit.unitPrice,
      extra: round2(kit.unitPrice - from.total),
    };
  }
  return null;
}

/** Resumo curto do pedido (coluna "Plano" do painel, UTMify e Meta). */
export function cartSummary(lines: readonly ResolvedLine[]) {
  const first = lines[0];
  if (!first) return "";
  const name = first.line.kit
    ? `Kit ${first.line.units.length} — ${first.product.name}`
    : first.product.name;
  const more = lines.length - 1;
  const label = `${first.line.qty}x ${name}${more > 0 ? ` + ${more} ${more > 1 ? "itens" : "item"}` : ""}`;
  return label.length > 78 ? `${label.slice(0, 77)}…` : label;
}

/** Item como fica guardado no pedido (painel, upsell, rastreio e tela de obrigado). */
export type OrderItem = {
  slug: string;
  title: string;
  detail: string;
  kit: boolean;
  qty: number;
  /** Preço cobrado por unidade da linha (o kit inteiro, quando é kit). */
  unitPrice: number;
  pieces: number;
  img: string;
  line: CartLine;
};

export const toOrderItem = (r: ResolvedLine, img: string): OrderItem => ({
  slug: r.product.slug,
  title: r.title,
  detail: r.detail,
  kit: !!r.line.kit,
  qty: r.line.qty,
  unitPrice: r.unitPrice,
  pieces: r.pieces,
  img,
  line: r.line,
});

// ---------- cupom ----------
export const COUPONS: Record<string, number> = { [brand.coupon.code]: brand.coupon.pct };

/** Percentual do cupom (0 se não existe). */
export const couponPct = (code: string | null | undefined) =>
  code ? (COUPONS[code.trim().toUpperCase()] ?? 0) : 0;

/** Desconto do cupom sobre os produtos (sem frete), em reais. */
export const couponDiscount = (products: number, code: string | null | undefined) =>
  round2((products * couponPct(code)) / 100);

const round2 = (n: number) => Math.round(n * 100) / 100;
