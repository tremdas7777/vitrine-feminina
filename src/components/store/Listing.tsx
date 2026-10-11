import { Link, useNavigate } from "@tanstack/react-router";
import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { z } from "zod";
import { useCart } from "@/hooks/useCart";
import {
  BRAND_BY_SLUG,
  BRANDS,
  CAT,
  CATEGORIES,
  COLLECTIONS,
  COLOR_FAMILIES,
  familyHex,
  matches,
  OTHER_COLORS,
  PRICE_RANGES,
  PRODUCTS,
  priceOf,
  productFamilies,
  promoOf,
  searchProducts,
  slugify,
  sortProducts,
  SORTS,
  subName,
  TOP_RANK,
  type FilterKey,
  type Filters,
  type Product,
  type SortKey,
} from "@/lib/catalog";
import { brl } from "@/lib/shipping";
import { Drawer } from "./StoreLayout";
import { ProductCard } from "./ProductCard";

const PAGE = 24;

/** Filtros na URL (?marca=beira-rio,modare&tam=36&ordem=preco-asc), para compartilhar e voltar. */
export const listingSearchSchema = z.object({
  cat: z.string().max(200).optional(),
  marca: z.string().max(400).optional(),
  tam: z.string().max(200).optional(),
  cor: z.string().max(400).optional(),
  preco: z.string().max(100).optional(),
  disp: z.literal("1").optional(),
  ordem: z.enum(["vendidos", "novos", "preco-asc", "preco-desc", "az"]).optional(),
  q: z.string().max(100).optional(),
});
export type ListingSearch = z.infer<typeof listingSearchSchema>;

export type ListingCtx =
  | { kind: "cat"; cat: string; sub?: string }
  | { kind: "brand"; brand: string }
  | { kind: "col"; col: string }
  | { kind: "search"; q: string }
  | { kind: "favs" };

const list = (v?: string) => (v ? v.split(",").filter(Boolean) : []);

export function Listing({ ctx, search }: { ctx: ListingCtx; search: ListingSearch }) {
  const navigate = useNavigate();
  const { favs } = useCart();
  const [limit, setLimit] = useState(PAGE);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const setSearch = (patch: Partial<ListingSearch>) =>
    navigate({
      to: ".",
      search: (prev: ListingSearch) => {
        const next: Record<string, string | undefined> = { ...prev, ...patch };
        for (const k of Object.keys(next)) if (!next[k]) delete next[k];
        return next as ListingSearch;
      },
      replace: true,
      resetScroll: false,
    });

  // ---------- conjunto base, título e migalhas ----------
  const { base, title, sub, crumbs, chips, catSlug, defaultSort, ranked } = useMemo(() => {
    let base: Product[] = PRODUCTS;
    let title = "";
    let sub = "";
    const crumbs: [string | null, string, Record<string, string>?][] = [["/", "Início"]];
    let chips: ReactNode = null;
    let catSlug: string | undefined;
    let defaultSort: SortKey = "vendidos";
    let ranked = false;
    if (ctx.kind === "cat") {
      const c = CAT.get(ctx.cat)!;
      catSlug = c.slug;
      base = PRODUCTS.filter((p) => p.cat === c.slug);
      title = c.name;
      crumbs.push(["/c/$cat", c.name, { cat: c.slug }]);
      if (ctx.sub) {
        title = subName(c.slug, ctx.sub) || c.name;
        crumbs.push([null, title]);
        base = base.filter((p) => p.sub === ctx.sub);
      }
      const promo = base[0] ? promoOf(base[0]) : undefined;
      if (promo)
        sub = `Promoção: 1 por ${brl(promo.price)} · 2 por ${brl(promo.kits[2] ?? 0)} · 3 por ${brl(
          promo.kits[3] ?? 0,
        )}. Levando ${promo.freeShippingUnits} ou mais, o frete é grátis.`;
      chips = (
        <>
          <Link
            className={`chip ${ctx.sub ? "" : "is-active"}`}
            to="/c/$cat"
            params={{ cat: c.slug }}
          >
            Todos<small>{c.count}</small>
          </Link>
          {c.subs.map((s) => (
            <Link
              key={s.slug}
              className={`chip ${ctx.sub === s.slug ? "is-active" : ""}`}
              to="/c/$cat/$sub"
              params={{ cat: c.slug, sub: s.slug }}
            >
              {s.name}
              <small>{s.count}</small>
            </Link>
          ))}
        </>
      );
    } else if (ctx.kind === "brand") {
      const b = BRAND_BY_SLUG.get(ctx.brand)!;
      base = PRODUCTS.filter((p) => p.brand === b.name);
      title = b.name;
      sub = `Todos os produtos ${b.name} disponíveis na Vitrine Feminina.`;
      crumbs.push([null, "Marcas"], [null, b.name]);
    } else if (ctx.kind === "col") {
      const col = COLLECTIONS[ctx.col]!;
      base = PRODUCTS.filter(col.filter);
      title = col.name;
      sub = col.sub;
      defaultSort = col.sort;
      ranked = ctx.col === "mais-vendidos";
      crumbs.push([null, col.name]);
    } else if (ctx.kind === "search") {
      base = searchProducts(ctx.q);
      title = ctx.q ? `Resultados para “${ctx.q}”` : "Busca";
      crumbs.push([null, "Busca"]);
    } else {
      base = PRODUCTS.filter((p) => favs.has(p.id));
      title = "Meus Favoritos";
      sub = "Os produtos que você salvou.";
      crumbs.push([null, "Favoritos"]);
    }
    return { base, title, sub, crumbs, chips, catSlug, defaultSort, ranked };
  }, [ctx, favs]);

  const f: Filters = {
    cat: list(search.cat),
    marca: list(search.marca),
    tam: list(search.tam),
    cor: list(search.cor),
    preco: list(search.preco),
    disp: search.disp === "1",
  };
  const sort: SortKey = search.ordem ?? defaultSort;
  const filtered = sortProducts(
    base.filter((p) => matches(p, f)),
    sort,
    catSlug,
  );
  const key = JSON.stringify([ctx, search]);
  useEffect(() => setLimit(PAGE), [key]);
  const shown = filtered.slice(0, limit);

  const toggle = (k: FilterKey, v: string) => {
    const cur = f[k];
    setSearch({ [k]: (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]).join(",") });
  };

  // ---------- facetas (contagem considerando os outros filtros) ----------
  const count = (skip: FilterKey, pred: (p: Product) => boolean) =>
    base.filter((p) => matches(p, f, skip) && pred(p)).length;
  const groups: ReactNode[] = [];
  if (ctx.kind !== "cat") {
    const cats = CATEGORIES.map((c) => ({
      v: c.slug,
      label: c.name,
      n: count("cat", (p) => p.cat === c.slug),
    })).filter((x) => x.n || f.cat.includes(x.v));
    if (cats.length > 1)
      groups.push(
        <CheckGroup
          key="cat"
          title="Categoria"
          k="cat"
          items={cats}
          active={f.cat}
          onToggle={toggle}
        />,
      );
  }
  if (ctx.kind !== "brand") {
    const brands = BRANDS.map((b) => ({
      v: b.slug,
      label: b.name,
      n: count("marca", (p) => p.brand === b.name),
    })).filter((x) => x.n || f.marca.includes(x.v));
    if (brands.length > 1)
      groups.push(
        <CheckGroup
          key="marca"
          title="Marca"
          k="marca"
          items={brands}
          active={f.marca}
          onToggle={toggle}
          limit={8}
        />,
      );
  }
  const sizes = [...new Set(base.flatMap((p) => p.sizes))]
    .filter((s) => /^\d+$/.test(s))
    .sort((a, b) => +a - +b);
  if (sizes.length)
    groups.push(
      <div className="fgroup" key="tam">
        <h4>Tamanho</h4>
        <div className="fsizes">
          {sizes.map((s) => (
            <button
              type="button"
              key={s}
              className={f.tam.includes(s) ? "is-active" : ""}
              onClick={() => toggle("tam", s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>,
    );
  const fams = [...COLOR_FAMILIES.map((c) => c[0]), OTHER_COLORS]
    .map((name) => ({
      v: slugify(name),
      label: name,
      n: count("cor", (p) => productFamilies(p).includes(name)),
      dot: familyHex(name),
    }))
    .filter((x) => x.n || f.cor.includes(x.v));
  if (fams.length > 1)
    groups.push(
      <CheckGroup key="cor" title="Cor" k="cor" items={fams} active={f.cor} onToggle={toggle} />,
    );
  const prices = PRICE_RANGES.map(([v, label, lo, hi]) => ({
    v,
    label,
    n: count("preco", (p) => priceOf(p) >= lo && priceOf(p) < hi),
  })).filter((x) => x.n || f.preco.includes(x.v));
  if (prices.length > 1)
    groups.push(
      <CheckGroup
        key="preco"
        title="Preço"
        k="preco"
        items={prices}
        active={f.preco}
        onToggle={toggle}
      />,
    );
  groups.push(
    <div className="fgroup" key="disp">
      <label className="fcheck">
        <input
          type="checkbox"
          checked={f.disp}
          onChange={(e) => setSearch({ disp: e.target.checked ? "1" : undefined })}
        />{" "}
        Somente disponíveis
      </label>
    </div>,
  );

  const labelOf: Record<FilterKey, (v: string) => string | undefined> = {
    cat: (v) => CAT.get(v)?.name,
    marca: (v) => BRAND_BY_SLUG.get(v)?.name,
    tam: (v) => `Tam. ${v}`,
    cor: (v) => fams.find((x) => x.v === v)?.label ?? v,
    preco: (v) => PRICE_RANGES.find((x) => x[0] === v)?.[1],
  };
  const active = (["cat", "marca", "tam", "cor", "preco"] as FilterKey[]).flatMap((k) =>
    f[k].map((v) => (
      <button type="button" key={`${k}${v}`} onClick={() => toggle(k, v)}>
        {labelOf[k](v)} ✕
      </button>
    )),
  );
  if (f.disp)
    active.push(
      <button type="button" key="disp" onClick={() => setSearch({ disp: undefined })}>
        Disponíveis ✕
      </button>,
    );

  const empty =
    ctx.kind === "favs" ? (
      <div className="empty">
        <b>Nenhum favorito ainda</b>Toque no coração dos produtos para salvá-los aqui.
        <br />
        <br />
        <Link className="btn btn--primary" to="/colecao/$col" params={{ col: "mais-vendidos" }}>
          Ver mais vendidos
        </Link>
      </div>
    ) : (
      <div className="empty">
        <b>Nenhum produto encontrado</b>Tente remover alguns filtros ou buscar por outro termo.
        <br />
        <br />
        <Link className="btn btn--outline" to="/colecao/$col" params={{ col: "mais-vendidos" }}>
          Ver mais vendidos
        </Link>
      </div>
    );
  const showRank = ranked && sort === "vendidos" && !active.length;

  return (
    <div className="container">
      <nav className="crumbs">
        {crumbs.map(([to, label, params], i) => {
          const inner = to ? (
            <Link to={to as never} params={params as never}>
              {label}
            </Link>
          ) : (
            label
          );
          return i ? <span key={i}>{inner}</span> : <Fragment key={i}>{inner}</Fragment>;
        })}
      </nav>
      <div className="listing__head">
        <div>
          <h1 className="title">{title}</h1>
          {sub && <p className="section__sub">{sub}</p>}
        </div>
        {chips && <div className="listing__subs">{chips}</div>}
      </div>
      <div className="listing">
        <aside className="filters" aria-label="Filtros">
          {groups}
        </aside>
        <div>
          <div className="toolbar">
            <button
              type="button"
              className="btn btn--outline filter-btn"
              style={{ height: 42, padding: "0 18px" }}
              onClick={() => setFiltersOpen(true)}
            >
              Filtrar{active.length ? ` (${active.length})` : ""}
            </button>
            <span className="toolbar__count only-desktop">
              {filtered.length} {filtered.length === 1 ? "produto" : "produtos"}
            </span>
            <select
              className="select"
              aria-label="Ordenar"
              value={sort}
              onChange={(e) => setSearch({ ordem: e.target.value as SortKey })}
            >
              {SORTS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          {active.length > 0 && (
            <div className="factive">
              {active}
              <button
                type="button"
                className="clear"
                onClick={() =>
                  setSearch({
                    cat: undefined,
                    marca: undefined,
                    tam: undefined,
                    cor: undefined,
                    preco: undefined,
                    disp: undefined,
                  })
                }
              >
                Limpar tudo
              </button>
            </div>
          )}
          {filtered.length ? (
            <div className="grid">
              {shown.map((p, i) => (
                <ProductCard
                  key={p.id}
                  p={p}
                  ranked={showRank ? (TOP_RANK.get(p.id) ?? i + 1) : undefined}
                />
              ))}
            </div>
          ) : (
            empty
          )}
          {filtered.length > shown.length && (
            <div className="more">
              <span>
                Mostrando {shown.length} de {filtered.length}
              </span>
              <div className="more__bar">
                <i style={{ width: `${(shown.length / filtered.length) * 100}%` }} />
              </div>
              <button
                type="button"
                className="btn btn--outline"
                onClick={() => setLimit((l) => l + PAGE)}
              >
                Carregar mais
              </button>
            </div>
          )}
        </div>
      </div>
      <Drawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        side="left"
        title="Filtrar"
        foot={
          <button
            type="button"
            className="btn btn--primary btn--block"
            onClick={() => setFiltersOpen(false)}
          >
            Ver {filtered.length} produtos
          </button>
        }
      >
        {groups}
      </Drawer>
    </div>
  );
}

function CheckGroup({
  title,
  k,
  items,
  active,
  onToggle,
  limit = 99,
}: {
  title: string;
  k: FilterKey;
  items: { v: string; label: string; n: number; dot?: string }[];
  active: string[];
  onToggle: (k: FilterKey, v: string) => void;
  limit?: number;
}) {
  const [all, setAll] = useState(false);
  const rows = items.filter((x, i) => all || i < limit || active.includes(x.v));
  return (
    <div className="fgroup">
      <h4>{title}</h4>
      {rows.map((x) => (
        <label className="fcheck" key={x.v}>
          <input type="checkbox" checked={active.includes(x.v)} onChange={() => onToggle(k, x.v)} />
          {x.dot && <i className="dot" style={{ background: x.dot }} />}
          {x.label}
          <small>{x.n}</small>
        </label>
      ))}
      {!all && items.length > limit && (
        <button type="button" className="fmore" onClick={() => setAll(true)}>
          + Ver todas ({items.length})
        </button>
      )}
    </div>
  );
}
