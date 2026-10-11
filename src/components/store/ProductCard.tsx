import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useCart } from "@/hooks/useCart";
import {
  colorHex,
  hasKit,
  imgSmall,
  kitLabel,
  kitOffersText,
  priceOf,
  regularOf,
  TOP_IDS,
  type Product,
} from "@/lib/catalog";
import { brl } from "@/lib/shipping";
import { ChevL, ChevR, IconHeart } from "./icons";

export function PriceTag({ p }: { p: Product }) {
  if (!p.inStock && !priceOf(p))
    return (
      <div className="price">
        <b>Esgotado</b>
      </div>
    );
  const reg = regularOf(p);
  return (
    <div className="price">
      <b>{brl(priceOf(p))}</b>
      {reg && <s>{brl(reg)}</s>}
    </div>
  );
}

export function ProductCard({ p, ranked }: { p: Product; ranked?: number }) {
  const { favs, toggleFav } = useCart();
  const tags: { cls: string; text: string }[] = [];
  if (!p.inStock) tags.push({ cls: "tag--out", text: "Esgotado" });
  else {
    const reg = regularOf(p);
    if (reg) tags.push({ cls: "tag--sale", text: `-${Math.round((1 - priceOf(p) / reg) * 100)}%` });
    if (TOP_IDS.has(p.id) && !ranked) tags.push({ cls: "tag--best", text: "Mais vendido" });
    if (hasKit(p)) tags.push({ cls: "tag--kit", text: kitLabel(p) });
    if (p.comfort && tags.length < 2) tags.push({ cls: "tag--comfort", text: "Conforto" });
  }
  const more =
    p.colors.length > 5
      ? `+${p.colors.length - 5}`
      : p.colors.length > 1
        ? `${p.colors.length} cores`
        : "";
  const media = (
    <>
      {p.imgs[0] && (
        <img
          src={imgSmall(p)}
          alt={p.name}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
        />
      )}
      {p.imgs[1] && (
        <img
          src={imgSmall(p, 1)}
          alt=""
          className="alt"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
        />
      )}
    </>
  );
  const fav = favs.has(p.id);
  return (
    <article className={`card ${p.inStock ? "" : "card--out"} ${ranked ? "card--ranked" : ""}`}>
      <Link className="card__media" to="/p/$slug" params={{ slug: p.slug }} aria-label={p.name}>
        {ranked ? (
          <>
            <div className="clip">{media}</div>
            <span className="rank">{ranked}</span>
          </>
        ) : (
          media
        )}
        <div className="card__tags">
          {tags.map((t) => (
            <span key={t.text} className={`tag ${t.cls}`}>
              {t.text}
            </span>
          ))}
        </div>
        <span className="card__quick">{p.inStock ? "Escolher tamanho e cor" : "Ver detalhes"}</span>
      </Link>
      <button
        type="button"
        className={`card__fav ${fav ? "is-on" : ""}`}
        aria-label={fav ? "Remover dos favoritos" : "Favoritar"}
        aria-pressed={fav}
        onClick={() =>
          toast(toggleFav(p.id) ? "Adicionado aos favoritos ♥" : "Removido dos favoritos")
        }
      >
        <IconHeart />
      </button>
      <div className="card__body">
        <span className="card__brand">{p.brand}</span>
        <Link className="card__name" to="/p/$slug" params={{ slug: p.slug }}>
          {p.name}
        </Link>
        {p.colors.length > 0 && (
          <div className="card__colors">
            {p.colors.slice(0, 5).map((c) => (
              <i key={c} className="dot" style={{ background: colorHex(c) }} title={c} />
            ))}
            <span>{more}</span>
          </div>
        )}
        <PriceTag p={p} />
        {hasKit(p) && (
          <span className="card__kit">
            ou <b>{kitOffersText(p)}</b>
          </span>
        )}
      </div>
    </article>
  );
}

/** Carrossel horizontal de produtos (com setas no computador). */
export function Rail({ items, ranked }: { items: Product[]; ranked?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: false });
  const update = () => {
    const t = ref.current;
    if (!t) return;
    setEdge({
      start: t.scrollLeft < 8,
      end: t.scrollLeft + t.clientWidth >= t.scrollWidth - 8,
    });
  };
  useEffect(update, [items]);
  const by = (dir: number) =>
    ref.current?.scrollBy({ left: ref.current.clientWidth * 0.9 * dir, behavior: "smooth" });
  return (
    <div className="rail">
      <button
        type="button"
        className="rail__btn rail__btn--prev"
        disabled={edge.start}
        onClick={() => by(-1)}
        aria-label="Anterior"
      >
        <ChevL />
      </button>
      <div className="rail__track" ref={ref} onScroll={update}>
        {items.map((p, i) => (
          <ProductCard key={p.id} p={p} ranked={ranked ? i + 1 : undefined} />
        ))}
      </div>
      <button
        type="button"
        className="rail__btn rail__btn--next"
        disabled={edge.end}
        onClick={() => by(1)}
        aria-label="Próximo"
      >
        <ChevR />
      </button>
    </div>
  );
}

export function SectionHead({
  eyebrow,
  title,
  sub,
  link,
}: {
  eyebrow: string;
  title: React.ReactNode;
  sub?: string;
  link?: { to: string; label: string; params?: Record<string, string> };
}) {
  return (
    <div className="section__head">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h2 className="title">{title}</h2>
        {sub && <p className="section__sub">{sub}</p>}
      </div>
      {link && (
        <Link className="link" to={link.to as never} params={link.params as never}>
          {link.label} →
        </Link>
      )}
    </div>
  );
}
