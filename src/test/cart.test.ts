import { afterEach, describe, expect, it } from "vitest";
import { applyPrices, DEFAULT_PRICES } from "@/lib/prices";
import {
  BY_SLUG,
  kitPriceOf,
  kitSizesOf,
  PRODUCTS,
  priceOf,
  sortProducts,
  type Product,
} from "@/lib/catalog";
import {
  cartSummary,
  couponDiscount,
  freeShippingFor,
  kitUpgradeFor,
  resolveCart,
  resolveLine,
  type CartLine,
} from "@/lib/cart";
import { checkoutTotals } from "@/lib/payment-pricing";
import { bumpsTotal, ORDER_BUMPS } from "@/lib/order-bump";
import { EXPRESS_SHIPPING, upsellSelection, UPSELL_OFFER } from "@/lib/upsell";
import { toOrderItem } from "@/lib/cart";

const find = (pred: (p: Product) => boolean) => {
  const p = PRODUCTS.find(pred);
  if (!p) throw new Error("produto de teste não encontrado no catálogo");
  return p;
};
const tenis = find(
  (p) => p.cat === "tenis" && p.inStock && p.colors.length > 0 && p.sizes.length > 0,
);
const sandalia = find(
  (p) =>
    p.cat === "sandalias" &&
    p.inStock &&
    p.colors.length > 1 &&
    p.sizes.length > 0 &&
    p.price * 3 > 99,
);
const one = (p: Product, qty = 1): CartLine => ({
  slug: p.slug,
  qty,
  kit: false,
  color: p.colors[0] ?? null,
  size: p.sizes[0] ?? null,
});
const kit = (p: Product, n: number): CartLine => ({
  slug: p.slug,
  qty: 1,
  kit: true,
  units: Array.from({ length: n }, (_, i) => ({
    color: p.colors[i % p.colors.length] ?? null,
    size: p.sizes[i % p.sizes.length] ?? null,
  })),
});

describe("preços da coleção Tênis", () => {
  afterEach(() => applyPrices(null));

  it("1 por R$ 49, 2 por R$ 79 e 3 por R$ 99", () => {
    expect(priceOf(tenis)).toBe(49);
    expect(kitSizesOf(tenis)).toEqual([2, 3]);
    expect(kitPriceOf(tenis, 2)).toBe(79);
    expect(kitPriceOf(tenis, 3)).toBe(99);
    expect(resolveLine(kit(tenis, 2))?.total).toBe(79);
    expect(resolveLine(kit(tenis, 3))?.total).toBe(99);
  });

  it("frete grátis levando 2 ou mais tênis (em kit ou avulsos)", () => {
    const um = resolveCart([one(tenis)]);
    expect(freeShippingFor(49, um)).toBe(false);
    const kit2 = resolveCart([kit(tenis, 2)]);
    expect(freeShippingFor(79, kit2)).toBe(true);
    const doisAvulsos = resolveCart([one(tenis, 2)]);
    expect(freeShippingFor(98, doisAvulsos)).toBe(true);
  });

  it("Modare aparece primeiro na ordem padrão dos tênis", () => {
    const list = sortProducts(
      PRODUCTS.filter((p) => p.cat === "tenis" && p.inStock),
      "vendidos",
      "tenis",
    );
    const firstOther = list.findIndex((p) => p.brand !== "Modare");
    expect(list.slice(firstOther).some((p) => p.brand === "Modare")).toBe(false);
  });

  it("preços do painel valem na hora", () => {
    const cfg = structuredClone(DEFAULT_PRICES);
    cfg.tenis = { price: 59, kit2: 89, kit3: 109 };
    applyPrices(cfg);
    expect(priceOf(tenis)).toBe(59);
    expect(resolveLine(kit(tenis, 2))?.total).toBe(89);
    applyPrices(null);
    expect(priceOf(tenis)).toBe(49);
  });
});

describe("sacola", () => {
  afterEach(() => applyPrices(null));

  it("kit com 3 por R$ 99 nos modelos com mais de uma cor (não aceita kit de 2 fora dos tênis)", () => {
    expect(kitSizesOf(sandalia)).toEqual([3]);
    expect(resolveLine(kit(sandalia, 3))?.total).toBe(99);
    expect(resolveLine(kit(sandalia, 2))).toBeNull();
  });

  it("recusa cor ou tamanho que o produto não tem e produto esgotado", () => {
    expect(resolveLine({ ...one(sandalia), color: "Cor inexistente" } as CartLine)).toBeNull();
    expect(resolveLine({ ...one(sandalia), size: "99" } as CartLine)).toBeNull();
    expect(resolveLine({ ...one(sandalia), size: null } as CartLine)).toBeNull();
    const esgotado = PRODUCTS.find((p) => !p.inStock);
    if (esgotado) expect(resolveLine(one(esgotado))).toBeNull();
    expect(resolveLine({ ...one(sandalia), slug: "nao-existe" } as CartLine)).toBeNull();
  });

  it("o preço vem sempre do catálogo, com quantidade", () => {
    const r = resolveLine(one(sandalia, 2))!;
    expect(r.total).toBeCloseTo(BY_SLUG.get(sandalia.slug)!.price * 2);
    expect(cartSummary([r])).toContain(sandalia.name.slice(0, 20));
  });

  it("cupom de 10% só nos produtos e total do Pix em centavos", () => {
    expect(couponDiscount(200, "primeira10")).toBe(20);
    expect(couponDiscount(200, "INVALIDO")).toBe(0);
    expect(checkoutTotals({ products: 200, frete: 20, discount: 20 })).toEqual({
      products: 20000,
      frete: 2000,
      discount: 2000,
      total: 20000,
    });
  });
});

describe("ofertas", () => {
  afterEach(() => applyPrices(null));

  it("order bump, upsell (+1 igual com desconto), seguro e expresso seguem o painel", () => {
    const cfg = structuredClone(DEFAULT_PRICES);
    cfg.bump = { price: 14.9, compareAt: 29.9 };
    cfg.upsellPct = 50;
    cfg.expresso = 39.9;
    applyPrices(cfg);
    expect(bumpsTotal([ORDER_BUMPS[0]!.id])).toBe(14.9);
    expect(UPSELL_OFFER.pct).toBe(50);
    expect(EXPRESS_SHIPPING.price).toBe(39.9);
    const base = toOrderItem(resolveLine(kit(tenis, 3))!, "");
    const sel = upsellSelection(base, ["kit", "seguro", "kit", "x"]);
    expect(sel.products).toEqual(["kit", "seguro"]);
    expect(sel.items[0]!.price).toBe(49.5);
    expect(upsellSelection(null, ["kit"]).products).toEqual([]);
  });
});

describe("oferta do kit no frete", () => {
  it("1 tênis avulso: oferece o kit de 3, que libera o frete grátis", () => {
    const lines = resolveCart([one(tenis)]);
    const up = kitUpgradeFor(lines);
    expect(up?.from.product.slug).toBe(tenis.slug);
    expect(up?.units).toBe(3);
    expect(up?.price).toBe(kitPriceOf(tenis, 3));
    expect(up?.extra).toBe(Math.round((kitPriceOf(tenis, 3) - priceOf(tenis)) * 100) / 100);
  });

  it("não oferece quando o frete já é grátis", () => {
    expect(kitUpgradeFor(resolveCart([one(tenis, 2)]))).toBeNull();
    expect(kitUpgradeFor(resolveCart([kit(tenis, 3)]))).toBeNull();
  });
});
