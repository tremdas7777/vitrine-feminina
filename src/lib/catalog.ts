/**
 * Catálogo da loja (gerado por tools/atualizar_catalogo.sh em src/data/catalog.json) e as regras
 * de preço da vitrine: promoções por categoria e kit com 3 unidades.
 *
 * Roda no navegador (exibição) e no servidor (cobrança). O servidor sempre recalcula o preço
 * a partir daqui — nunca usa o valor que vem do navegador.
 */
import raw from "@/data/catalog.json";

export type RawImage = string | [string, string];

export type Product = {
  id: number;
  slug: string;
  name: string;
  brand: string;
  cat: string;
  sub: string;
  /** Preço de tabela do catálogo (sem promoção da categoria). */
  price: number;
  regular: number | null;
  inStock: boolean;
  /** Posição no ranking de vendas da loja de origem (1 = mais vendido). */
  rank: number;
  imgs: RawImage[];
  colors: string[];
  sizes: string[];
  comfort: boolean;
  leather: boolean;
  sku: string;
};

export type SubCategory = { slug: string; name: string; count: number };
export type Category = { slug: string; name: string; count: number; subs: SubCategory[] };

const data = raw as unknown as { categories: Category[]; products: Product[]; banners: string[] };

export const CATEGORIES: Category[] = data.categories;
export const PRODUCTS: Product[] = data.products;
export const BANNERS: string[] = data.banners;

export const BY_SLUG = new Map(PRODUCTS.map((p) => [p.slug, p]));
export const BY_ID = new Map(PRODUCTS.map((p) => [p.id, p]));
export const CAT = new Map(CATEGORIES.map((c) => [c.slug, c]));

export const subName = (cat: string, sub: string) =>
  CAT.get(cat)?.subs.find((s) => s.slug === sub)?.name ?? "";

// ---------- texto ----------
export const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export const slugify = (s: string) =>
  norm(s)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

// ---------- imagens ----------
const IMG_BASE = "https://samisapatilhasecia.com.br/wp-content/uploads/";
/** Foto grande (800px) da posição i. */
export const imgLarge = (p: Product, i = 0) => {
  const im = p.imgs[i];
  if (!im) return "";
  return IMG_BASE + (Array.isArray(im) ? im[0] : im);
};
/** Miniatura (449px) da posição i — cards, sacola e resumo. */
export const imgSmall = (p: Product, i = 0) => {
  const im = p.imgs[i];
  if (!im) return "";
  return IMG_BASE + (Array.isArray(im) ? im[1] : im.replace("-800x800.", "-449x449."));
};

// ---------- marcas ----------
export type Brand = { name: string; slug: string; count: number };
export const BRANDS: Brand[] = (() => {
  const m = new Map<string, number>();
  for (const p of PRODUCTS) m.set(p.brand, (m.get(p.brand) ?? 0) + 1);
  return [...m]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, slug: slugify(name), count }));
})();
export const BRAND_BY_SLUG = new Map(BRANDS.map((b) => [b.slug, b]));

// ---------- cores ----------
export const COLOR_FAMILIES: [string, string, RegExp][] = [
  ["Preto", "#1d1a1b", /pret|black|onix/],
  ["Branco & Off", "#f7f5f0", /branc|white|off|gelo|perola|bone|marfim/],
  [
    "Nude & Bege",
    "#e1c3a6",
    /nude|bege|areia|creme|natural|baunilha|amendoa|almond|sand|cream|palha|champagne/,
  ],
  [
    "Marrom & Caramelo",
    "#9a6038",
    /marrom|caramel|camel|conhaque|cacau|cafe|chocolate|tan|whisky|castanh|doce de leite|nocciola|avela|mel|tabaco|brown|canela|cognac|terra|capuccino|cappuccino|amendo/,
  ],
  ["Rosa", "#ef9ab4", /rosa|pink|chiclete|blush|rose|berry|gelato|lilas|lavanda|lilac/],
  ["Vermelho & Vinho", "#a3243b", /vermelh|red|vinho|bordo|marsala|cereja|coral|laranja|telha/],
  ["Azul", "#3a63b8", /azul|blue|jeans|navy|marinho|royal|turquesa/],
  ["Verde", "#5b8a5a", /verde|green|militar|oliva|menta|luna|limao|lima/],
  [
    "Dourado & Prata",
    "linear-gradient(135deg,#e7c873,#b8935a 50%,#d9d9d9 50%,#9a9a9a)",
    /dourad|ouro|gold|prata|silver|metal|bronze|cobre|glitter|grafite|chumbo/,
  ],
  ["Cinza", "#9a9a9e", /cinza|grey|gray|fume|mescla/],
  ["Amarelo", "#eccb50", /amarel|yellow|mostarda/],
];
export const OTHER_COLORS = "Outras cores";
const OTHER_HEX = "conic-gradient(#ef9ab4,#eccb50,#5b8a5a,#3a63b8,#ef9ab4)";
export const colorFamily = (name: string) => {
  const n = norm(name);
  return COLOR_FAMILIES.find(([, , rx]) => rx.test(n))?.[0] ?? OTHER_COLORS;
};
export const familyHex = (fam: string) =>
  COLOR_FAMILIES.find((f) => f[0] === fam)?.[1] ?? OTHER_HEX;
export const colorHex = (name: string) => familyHex(colorFamily(name));

const FAMS = new Map(PRODUCTS.map((p) => [p.id, [...new Set(p.colors.map(colorFamily))]]));
export const productFamilies = (p: Product) => FAMS.get(p.id) ?? [];

const SEARCH = new Map(
  PRODUCTS.map((p) => [
    p.id,
    norm(
      `${p.name} ${p.brand} ${subName(p.cat, p.sub)} ${CAT.get(p.cat)?.name ?? ""} ${p.colors.join(" ")} ${p.sku}`,
    ),
  ]),
);
export function searchProducts(q: string): Product[] {
  const terms = norm(q).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return PRODUCTS.filter((p) => {
    const s = SEARCH.get(p.id) ?? "";
    return terms.every((t) => s.includes(t) || s.includes(t.replace(/s$/, "")));
  }).sort((a, b) => Number(b.inStock) - Number(a.inStock) || a.rank - b.rank);
}

// ---------- preços ----------
/**
 * Regras de preço editáveis no /admin → Preços (os valores abaixo são o padrão de fábrica).
 * - kitPrice: kit com KIT_UNITS unidades nos modelos com mais de uma cor.
 * - promos: preço fixo para uma categoria inteira (ex.: todos os tênis), com kits de 2 e 3
 *   unidades e frete grátis a partir de `freeShippingUnits` peças da categoria.
 */
export const KIT_UNITS = 3;
export type Promo = { price: number; kits: Record<number, number>; freeShippingUnits: number };
export const PRICING: { kitPrice: number; promos: Record<string, Promo> } = {
  kitPrice: 99,
  promos: { tenis: { price: 49, kits: { 2: 79, 3: 99 }, freeShippingUnits: 2 } },
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export const promoOf = (p: Product): Promo | undefined => PRICING.promos[p.cat];

/** Preço de venda da unidade (com a promoção da categoria, se houver). */
export function priceOf(p: Product): number {
  return promoOf(p)?.price ?? p.price;
}

/** Preço "de" (riscado) ou null. */
export function regularOf(p: Product): number | null {
  const orig = p.regular ?? p.price;
  const now = priceOf(p);
  return orig > now ? orig : null;
}

/** Tamanhos de kit oferecidos para o produto (ex.: [2, 3] nos tênis, [3] nos demais). */
export function kitSizesOf(p: Product): number[] {
  if (!p.inStock || priceOf(p) <= 0) return [];
  const promo = promoOf(p);
  const sizes = promo
    ? Object.keys(promo.kits)
        .map(Number)
        .sort((a, b) => a - b)
    : p.colors.length > 1
      ? [KIT_UNITS]
      : [];
  // Nunca oferece kit mais caro que as unidades avulsas.
  return sizes.filter((n) => round2(priceOf(p) * n) > kitPriceOf(p, n));
}

/** Preço do kit com `units` unidades deste produto. */
export const kitPriceOf = (p: Product, units = KIT_UNITS) =>
  promoOf(p)?.kits[units] ?? PRICING.kitPrice;

export const hasKit = (p: Product) => kitSizesOf(p).length > 0;

const money = (v: number) =>
  Number.isInteger(v)
    ? `R$ ${v}`
    : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Selo curto do kit ("Kit 3 por R$ 99" / "2 por R$ 79"). */
export const kitLabel = (p: Product) => {
  const n = kitSizesOf(p)[0];
  if (!n) return "";
  return promoOf(p)
    ? `${n} por ${money(kitPriceOf(p, n))}`
    : `Kit ${n} por ${money(kitPriceOf(p, n))}`;
};

/** Texto das ofertas de kit ("2 por R$ 79 · 3 por R$ 99"). */
export const kitOffersText = (p: Product) =>
  kitSizesOf(p)
    .map((n) => `${n} por ${money(kitPriceOf(p, n))}`)
    .join(" · ");

// ---------- ranking / vitrines ----------
export const BEST_SELLERS = PRODUCTS.filter((p) => p.inStock).sort((a, b) => a.rank - b.rank);
export const TOP_IDS = new Set(BEST_SELLERS.slice(0, 12).map((p) => p.id));
export const TOP_RANK = new Map(BEST_SELLERS.slice(0, 50).map((p, i) => [p.id, i + 1]));

/** Marcas que aparecem primeiro na ordem padrão de uma categoria. */
export const PINNED_BRANDS: Record<string, string[]> = { tenis: ["Modare"] };

export type SortKey = "vendidos" | "novos" | "preco-asc" | "preco-desc" | "az";
export const SORTS: [SortKey, string][] = [
  ["vendidos", "Mais vendidos"],
  ["novos", "Novidades"],
  ["preco-asc", "Menor preço"],
  ["preco-desc", "Maior preço"],
  ["az", "A – Z"],
];

export function sortProducts(items: Product[], sort: SortKey, cat?: string): Product[] {
  const stock = (a: Product, b: Product) => Number(b.inStock) - Number(a.inStock);
  const pinned = cat ? PINNED_BRANDS[cat] : undefined;
  const pin = (p: Product) => {
    if (!pinned) return 0;
    const i = pinned.indexOf(p.brand);
    return i === -1 ? pinned.length : i;
  };
  const fn: Record<SortKey, (a: Product, b: Product) => number> = {
    vendidos: (a, b) => stock(a, b) || pin(a) - pin(b) || a.rank - b.rank,
    novos: (a, b) => stock(a, b) || b.id - a.id,
    "preco-asc": (a, b) => stock(a, b) || priceOf(a) - priceOf(b),
    "preco-desc": (a, b) => stock(a, b) || priceOf(b) - priceOf(a),
    az: (a, b) => a.name.localeCompare(b.name, "pt-BR"),
  };
  return [...items].sort(fn[sort] ?? fn.vendidos);
}

export type Collection = {
  name: string;
  sub: string;
  filter: (p: Product) => boolean;
  sort: SortKey;
};

export const COLLECTIONS: Record<string, Collection> = {
  "mais-vendidos": {
    name: "Mais Vendidos",
    sub: "Os queridinhos das nossas clientes — ranking atualizado pelas vendas da loja.",
    filter: (p) => TOP_RANK.has(p.id),
    sort: "vendidos",
  },
  kits: {
    name: "Kits",
    sub: "Leve mais e pague menos — escolha a cor e a numeração de cada unidade.",
    filter: hasKit,
    sort: "vendidos",
  },
  novidades: {
    name: "Novidades",
    sub: "Acabaram de chegar na Vitrine.",
    filter: () => true,
    sort: "novos",
  },
  ofertas: {
    name: "Ofertas & Achadinhos",
    sub: "Produtos em promoção e achadinhos até R$ 99,90.",
    filter: (p) => p.inStock && (!!regularOf(p) || priceOf(p) < 100),
    sort: "preco-asc",
  },
  conforto: {
    name: "Linha Conforto",
    sub: "Palmilhas macias, modelos ortopédicos e ultra conforto para o dia todo.",
    filter: (p) => p.comfort,
    sort: "vendidos",
  },
  couro: {
    name: "Couro Legítimo",
    sub: "Bolsas e calçados em couro legítimo.",
    filter: (p) => p.leather,
    sort: "vendidos",
  },
};

// ---------- filtros da listagem ----------
export const PRICE_RANGES: [string, string, number, number][] = [
  ["0-100", "Até R$ 100", 0, 100],
  ["100-150", "R$ 100 a R$ 150", 100, 150],
  ["150-200", "R$ 150 a R$ 200", 150, 200],
  ["200-300", "R$ 200 a R$ 300", 200, 300],
  ["300-", "Acima de R$ 300", 300, Infinity],
];

export type Filters = {
  cat: string[];
  marca: string[];
  tam: string[];
  cor: string[];
  preco: string[];
  disp: boolean;
};
export type FilterKey = Exclude<keyof Filters, "disp">;

export function matches(p: Product, f: Filters, skip?: FilterKey): boolean {
  const price = priceOf(p);
  return (
    (skip === "cat" || !f.cat.length || f.cat.includes(p.cat)) &&
    (skip === "marca" || !f.marca.length || f.marca.includes(slugify(p.brand))) &&
    (skip === "tam" || !f.tam.length || p.sizes.some((s) => f.tam.includes(s))) &&
    (skip === "cor" ||
      !f.cor.length ||
      productFamilies(p).some((c) => f.cor.includes(slugify(c)))) &&
    (skip === "preco" ||
      !f.preco.length ||
      f.preco.some((k) => {
        const r = PRICE_RANGES.find((x) => x[0] === k);
        return !!r && price >= r[2] && price < r[3];
      })) &&
    (!f.disp || p.inStock)
  );
}
