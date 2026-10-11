import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useCart } from "@/hooks/useCart";
import { brand } from "@/lib/brand";
import type { CartLine, Variant } from "@/lib/cart";
import {
  BEST_SELLERS,
  CAT,
  colorHex,
  imgLarge,
  imgSmall,
  kitPriceOf,
  kitSizesOf,
  priceOf,
  PRODUCTS,
  promoOf,
  regularOf,
  slugify,
  sortProducts,
  subName,
  TOP_RANK,
  type Product,
} from "@/lib/catalog";
import { metaTrack } from "@/lib/meta-pixel";
import { brl } from "@/lib/shipping";
import { ChevL, ChevR } from "./icons";
import { PriceTag, Rail, SectionHead } from "./ProductCard";

export type ProductTexts = { short: string; desc: string } | null;

const only = (arr: string[]) => (arr.length === 1 ? arr[0]! : null);

export function ProductPage({ p, texts }: { p: Product; texts: ProductTexts }) {
  const cart = useCart();
  const navigate = useNavigate();
  const c = CAT.get(p.cat)!;
  const rank = TOP_RANK.get(p.id);
  const promo = promoOf(p);
  const kits = kitSizesOf(p);
  const blank = (): Variant => ({ color: only(p.colors), size: only(p.sizes) });

  const [img, setImg] = useState(0);
  const [zoom, setZoom] = useState(false);
  /** 1 = unidade avulsa; 2/3 = kit com essa quantidade. */
  const [mode, setMode] = useState(1);
  const [single, setSingle] = useState<Variant>(blank);
  const [units, setUnits] = useState<Variant[]>(() => [blank(), blank(), blank()]);
  const [qty, setQty] = useState(1);
  const [errors, setErrors] = useState<{ color?: boolean; size?: boolean; units?: number[] }>({});
  const optsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setImg(0);
    setMode(1);
    setSingle(blank());
    setUnits([blank(), blank(), blank()]);
    setQty(1);
    setErrors({});
    metaTrack("ViewContent", { value: priceOf(p), contentName: p.name });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.id]);

  const related = sortProducts(
    PRODUCTS.filter(
      (x) =>
        x.id !== p.id && x.inStock && x.cat === p.cat && (x.sub === p.sub || x.brand === p.brand),
    ),
    "vendidos",
    p.cat,
  ).slice(0, 8);
  const alsoBest = BEST_SELLERS.filter((x) => x.id !== p.id && !related.includes(x)).slice(0, 8);

  const bad = (v: Variant) => ({
    color: p.colors.length > 0 && !v.color,
    size: p.sizes.length > 0 && !v.size,
  });

  /** Monta a linha da sacola; marca os campos que faltam escolher. */
  const buildLine = (): CartLine | null => {
    if (mode === 1) {
      const e = bad(single);
      if (e.color || e.size) {
        setErrors(e);
        optsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        toast(`Escolha ${[e.color && "a cor", e.size && "o tamanho"].filter(Boolean).join(" e ")}`);
        return null;
      }
      return { slug: p.slug, qty, kit: false, color: single.color, size: single.size };
    }
    const chosen = units.slice(0, mode);
    const missing = chosen.flatMap((u, i) => {
      const e = bad(u);
      return e.color || e.size ? [i] : [];
    });
    if (missing.length) {
      setErrors({ units: missing });
      optsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      toast(`Escolha cor e tamanho das ${mode} unidades`);
      return null;
    }
    return { slug: p.slug, qty, kit: true, units: chosen };
  };

  const add = (buyNow: boolean) => {
    const line = buildLine();
    if (!line) return;
    cart.add(line);
    const value = (mode === 1 ? priceOf(p) : kitPriceOf(p, mode)) * qty;
    metaTrack("AddToCart", { value, contentName: p.name });
    if (buyNow) navigate({ to: "/checkout" });
    else {
      cart.setDrawerOpen(true);
      toast(mode === 1 ? "Produto adicionado à sacola" : "Kit adicionado à sacola");
    }
  };

  const unitPrice = mode === 1 ? priceOf(p) : kitPriceOf(p, mode);
  const n = p.imgs.length;
  const sizeHelp = /^\d+$/.test(p.sizes[0] ?? "");

  return (
    <>
      <div className="container">
        <nav className="crumbs">
          <Link to="/">Início</Link>{" "}
          <span>
            <Link to="/c/$cat" params={{ cat: c.slug }}>
              {c.name}
            </Link>
          </span>{" "}
          <span>
            <Link to="/c/$cat/$sub" params={{ cat: c.slug, sub: p.sub }}>
              {subName(p.cat, p.sub)}
            </Link>
          </span>
        </nav>
        <div className="pdp">
          <div className="gallery">
            <div className="gallery__thumbs">
              {p.imgs.map((_, i) => (
                <button
                  type="button"
                  key={i}
                  className={i === img ? "is-active" : ""}
                  onClick={() => {
                    setImg(i);
                    setZoom(false);
                  }}
                  aria-label={`Foto ${i + 1}`}
                >
                  <img src={imgSmall(p, i)} alt="" loading="lazy" referrerPolicy="no-referrer" />
                </button>
              ))}
            </div>
            <div
              className={`gallery__main ${zoom ? "zoom" : ""}`}
              onClick={() => setZoom((z) => !z)}
            >
              {n > 0 && <img src={imgLarge(p, img)} alt={p.name} referrerPolicy="no-referrer" />}
              {n > 1 && (
                <>
                  <button
                    type="button"
                    className="gallery__nav gallery__nav--prev"
                    aria-label="Foto anterior"
                    onClick={(e) => {
                      e.stopPropagation();
                      setImg((img - 1 + n) % n);
                      setZoom(false);
                    }}
                  >
                    <ChevL />
                  </button>
                  <button
                    type="button"
                    className="gallery__nav gallery__nav--next"
                    aria-label="Próxima foto"
                    onClick={(e) => {
                      e.stopPropagation();
                      setImg((img + 1) % n);
                      setZoom(false);
                    }}
                  >
                    <ChevR />
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="pinfo">
            <Link className="pinfo__brand" to="/marca/$brand" params={{ brand: slugify(p.brand) }}>
              {p.brand}
            </Link>
            <h1>{p.name}</h1>
            <div className="pinfo__meta">
              {rank && rank <= 20 && <span className="tag tag--best">#{rank} mais vendido</span>}
              {p.comfort && <span className="tag tag--comfort">Linha conforto</span>}
              {p.sku && <span>Ref.: {p.sku}</span>}
            </div>

            {p.inStock ? (
              <div>
                {mode === 1 ? (
                  <PriceTag p={p} />
                ) : (
                  <div className="price">
                    <b>{brl(unitPrice)}</b>
                    <s>{brl((regularOf(p) ?? priceOf(p)) * mode)}</s>
                    <small>
                      Kit com {mode} unidades · {brl(unitPrice / mode)} cada
                    </small>
                  </div>
                )}
                <div style={{ fontSize: 13.5, color: "var(--muted)" }}>
                  Com o cupom {brand.coupon.code}:{" "}
                  <b style={{ color: "var(--rose-700)" }}>
                    {brl(unitPrice * (1 - brand.coupon.pct / 100))}
                  </b>{" "}
                  na 1ª compra
                </div>
              </div>
            ) : (
              <div className="price">
                <b style={{ color: "var(--muted)" }}>Produto esgotado</b>
              </div>
            )}

            {p.inStock && kits.length > 0 && (
              <div
                className={`modes ${kits.length > 1 ? "modes--3" : ""}`}
                role="radiogroup"
                aria-label="Como você quer comprar"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={mode === 1}
                  className={`mode ${mode === 1 ? "is-active" : ""}`}
                  onClick={() => setMode(1)}
                >
                  <b>1 unidade</b>
                  <span>{brl(priceOf(p))}</span>
                  <small>Escolha cor e tamanho</small>
                </button>
                {kits.map((k) => (
                  <button
                    type="button"
                    key={k}
                    role="radio"
                    aria-checked={mode === k}
                    className={`mode ${mode === k ? "is-active" : ""}`}
                    onClick={() => setMode(k)}
                  >
                    <em>Economize {brl(priceOf(p) * k - kitPriceOf(p, k))}</em>
                    <b>{promo ? `${k} unidades` : `Kit com ${k} unidades`}</b>
                    <span>{brl(kitPriceOf(p, k))}</span>
                    <small>
                      {brl(kitPriceOf(p, k) / k)} cada
                      {promo && k >= promo.freeShippingUnits
                        ? " · frete grátis"
                        : " · cor e nº à escolha"}
                    </small>
                  </button>
                ))}
              </div>
            )}

            <div ref={optsRef}>
              {mode === 1 ? (
                <>
                  {p.colors.length > 0 && (
                    <div className={`opt ${errors.color ? "is-error" : ""}`}>
                      <div className="opt__label">
                        <span>
                          Cor: <b>{single.color ?? "selecione"}</b>
                        </span>
                      </div>
                      <div className="opt__list">
                        {p.colors.map((cl) => (
                          <button
                            type="button"
                            key={cl}
                            className={single.color === cl ? "is-active" : ""}
                            onClick={() => {
                              setSingle({ ...single, color: cl });
                              setErrors({ ...errors, color: false });
                            }}
                          >
                            <i className="dot" style={{ background: colorHex(cl) }} />
                            {cl}
                          </button>
                        ))}
                      </div>
                      <div className="opt__err">Escolha uma cor</div>
                    </div>
                  )}
                  {p.sizes.length > 0 && (
                    <div className={`opt ${errors.size ? "is-error" : ""}`}>
                      <div className="opt__label">
                        <span>
                          Tamanho: <b>{single.size ?? "selecione"}</b>
                        </span>
                        {sizeHelp && (
                          <Link className="link" to="/faq" style={{ fontSize: 13 }}>
                            Guia de tamanhos
                          </Link>
                        )}
                      </div>
                      <div className="opt__list">
                        {p.sizes.map((s) => (
                          <button
                            type="button"
                            key={s}
                            className={single.size === s ? "is-active" : ""}
                            onClick={() => {
                              setSingle({ ...single, size: s });
                              setErrors({ ...errors, size: false });
                            }}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                      <div className="opt__err">Escolha um tamanho</div>
                    </div>
                  )}
                </>
              ) : (
                <div className={`kit-units ${errors.units?.length ? "is-error" : ""}`}>
                  <div className="opt__label">
                    <span>
                      Escolha <b>cor{p.sizes.length ? " e tamanho" : ""}</b> de cada unidade
                    </span>
                  </div>
                  {units.slice(0, mode).map((u, i) => (
                    <div
                      className={`kit-unit ${errors.units?.includes(i) ? "is-error" : ""}`}
                      key={i}
                    >
                      <span className="kit-unit__n">{i + 1}</span>
                      <select
                        className="kselect"
                        aria-label={`Cor da unidade ${i + 1}`}
                        value={u.color ?? ""}
                        onChange={(e) => {
                          const next = [...units];
                          next[i] = { ...u, color: e.target.value || null };
                          setUnits(next);
                        }}
                      >
                        <option value="">Cor</option>
                        {p.colors.map((cl) => (
                          <option key={cl}>{cl}</option>
                        ))}
                      </select>
                      {p.sizes.length > 0 && (
                        <select
                          className="kselect"
                          aria-label={`Tamanho da unidade ${i + 1}`}
                          value={u.size ?? ""}
                          onChange={(e) => {
                            const next = [...units];
                            next[i] = { ...u, size: e.target.value || null };
                            setUnits(next);
                          }}
                        >
                          <option value="">Tamanho</option>
                          {p.sizes.map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  ))}
                  <div className="opt__err">
                    Escolha cor{p.sizes.length ? " e tamanho" : ""} das {mode} unidades
                  </div>
                </div>
              )}
            </div>

            {p.inStock ? (
              <div className="buy">
                <div className="qty">
                  <button
                    type="button"
                    aria-label="Diminuir"
                    onClick={() => setQty(Math.max(1, qty - 1))}
                  >
                    −
                  </button>
                  <span>{qty}</span>
                  <button
                    type="button"
                    aria-label="Aumentar"
                    onClick={() => setQty(Math.min(10, qty + 1))}
                  >
                    +
                  </button>
                </div>
                <button type="button" className="btn btn--primary" onClick={() => add(true)}>
                  Comprar agora
                </button>
                <button
                  type="button"
                  className="btn btn--outline buy__add"
                  onClick={() => add(false)}
                >
                  Adicionar à sacola
                </button>
              </div>
            ) : (
              <div className="pinfo__note">
                <span>🔔</span>
                <span>Este modelo esgotou. Veja os modelos parecidos logo abaixo.</span>
              </div>
            )}

            <div className="pinfo__note">
              <span>🔒</span>
              <span>
                Compra 100% segura com Pix — aprovação na hora.
                {promo
                  ? ` Levando ${promo.freeShippingUnits} ou mais, o frete é grátis.`
                  : " Frete grátis em compras acima de R$ 90."}
              </span>
            </div>

            <div className="acc">
              {texts?.short && (
                <details open>
                  <summary>Sobre o produto</summary>
                  <div className="acc__body">{texts.short}</div>
                </details>
              )}
              {texts?.desc && texts.desc !== texts.short && (
                <details open={!texts.short}>
                  <summary>Descrição completa</summary>
                  <div className="acc__body">{texts.desc}</div>
                </details>
              )}
              <details>
                <summary>Cores e tamanhos disponíveis</summary>
                <div className="acc__body">
                  {p.colors.length > 0 && `Cores: ${p.colors.join(", ")}`}
                  {p.sizes.length > 0 && `\nTamanhos: ${p.sizes.join(", ")}`}
                </div>
              </details>
            </div>
          </div>
        </div>
      </div>
      {related.length > 0 && (
        <section className="section section--cream">
          <div className="container">
            <SectionHead
              eyebrow="Você também vai gostar"
              title="Produtos relacionados"
              link={{ to: "/c/$cat/$sub", params: { cat: p.cat, sub: p.sub }, label: "Ver mais" }}
            />
            <Rail items={related} />
          </div>
        </section>
      )}
      <section className="section">
        <div className="container">
          <SectionHead
            eyebrow="Ranking da loja"
            title="Mais vendidos"
            link={{ to: "/colecao/$col", params: { col: "mais-vendidos" }, label: "Ver todos" }}
          />
          <Rail items={alsoBest} />
        </div>
      </section>
    </>
  );
}
