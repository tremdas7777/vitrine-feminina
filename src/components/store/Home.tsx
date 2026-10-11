import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useCart } from "@/hooks/useCart";
import { brand } from "@/lib/brand";
import {
  BANNERS,
  BEST_SELLERS,
  BRANDS,
  CAT,
  CATEGORIES,
  hasKit,
  imgLarge,
  imgSmall,
  PRICING,
  PRODUCTS,
  sortProducts,
} from "@/lib/catalog";
import { brl, FREE_SHIPPING_MIN } from "@/lib/shipping";
import { ChevL, ChevR } from "./icons";
import { ProductCard, Rail, SectionHead } from "./ProductCard";

function Hero() {
  const [i, setI] = useState(0);
  const n = BANNERS.length;
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);
  const restart = () => {
    clearInterval(timer.current);
    timer.current = setInterval(() => setI((x) => (x + 1) % n), 5500);
  };
  useEffect(() => {
    restart();
    return () => clearInterval(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const go = (k: number) => {
    setI((k + n) % n);
    restart();
  };
  const sx = useRef<number | null>(null);
  return (
    <section
      className="hero"
      onTouchStart={(e) => (sx.current = e.touches[0]?.clientX ?? null)}
      onTouchEnd={(e) => {
        if (sx.current == null) return;
        const dx = (e.changedTouches[0]?.clientX ?? 0) - sx.current;
        if (Math.abs(dx) > 40) go(i + (dx < 0 ? 1 : -1));
        sx.current = null;
      }}
    >
      <div className="hero__track" style={{ transform: `translateX(-${i * 100}%)` }}>
        {BANNERS.map((b, k) => (
          <Link key={b} className="hero__slide" to="/colecao/$col" params={{ col: "novidades" }}>
            <img
              src={b}
              alt={`Banner ${k + 1}`}
              loading={k ? "lazy" : "eager"}
              referrerPolicy="no-referrer"
            />
          </Link>
        ))}
      </div>
      <button
        type="button"
        className="hero__arrow hero__arrow--prev"
        onClick={() => go(i - 1)}
        aria-label="Anterior"
      >
        <ChevL />
      </button>
      <button
        type="button"
        className="hero__arrow hero__arrow--next"
        onClick={() => go(i + 1)}
        aria-label="Próximo"
      >
        <ChevR />
      </button>
      <div className="hero__dots">
        {BANNERS.map((b, k) => (
          <button
            type="button"
            key={b}
            className={k === i ? "is-active" : ""}
            onClick={() => go(k)}
            aria-label={`Banner ${k + 1}`}
          />
        ))}
      </div>
    </section>
  );
}

const catCover = (slug: string) => {
  const p =
    PRODUCTS.filter((x) => x.cat === slug && x.inStock).sort((a, b) => a.rank - b.rank)[0] ??
    PRODUCTS.find((x) => x.cat === slug);
  return p ? imgSmall(p) : "";
};

const TAB_CATS = ["tenis", "sandalias", "bolsas", "sapatilhas", "botas"];

export function Home() {
  const { setCoupon } = useCart();
  const [tab, setTab] = useState(TAB_CATS[0]!);
  const top = BEST_SELLERS.slice(0, 12);
  const kits = BEST_SELLERS.filter(hasKit).slice(0, 12);
  const news = PRODUCTS.filter((p) => p.inStock)
    .sort((a, b) => b.id - a.id)
    .slice(0, 8);
  const tabItems = sortProducts(
    PRODUCTS.filter((p) => p.cat === tab && p.inStock),
    "vendidos",
    tab,
  ).slice(0, 8);
  const comfort = BEST_SELLERS.find((p) => p.comfort && p.cat === "tenis");
  const leather = BEST_SELLERS.find((p) => p.leather && p.cat === "bolsas");
  const pj = BEST_SELLERS.find((p) => p.brand === "Petite Jolie" && p.cat === "chinelos");
  const tenis = PRICING.promos["tenis"];

  return (
    <>
      <Hero />
      <div className="perks container">
        <div>
          <span>🔒</span>
          <p>
            <b>Compra segura</b>Pix com aprovação na hora
          </p>
        </div>
        <div>
          <span>✅</span>
          <p>
            <b>Marcas originais</b>Beira Rio, Modare, Petite Jolie…
          </p>
        </div>
        <div>
          <span>🎁</span>
          <p>
            <b>{brand.coupon.pct}% OFF</b>na 1ª compra: {brand.coupon.code}
          </p>
        </div>
        <div>
          <span>🚚</span>
          <p>
            <b>Frete grátis</b>acima de {brl(FREE_SHIPPING_MIN)}
          </p>
        </div>
      </div>

      <section className="section">
        <div className="container">
          <SectionHead eyebrow="Navegue por" title="Categorias" />
          <div className="cat-circles">
            <Link className="cat-circle" to="/colecao/$col" params={{ col: "mais-vendidos" }}>
              <div className="cat-circle__img cat-circle__img--hot">
                <span>★</span>
                <b>TOP</b>
              </div>
              <b>Mais Vendidos</b>
              <small>Ranking da loja</small>
            </Link>
            {CATEGORIES.map((c) => (
              <Link key={c.slug} className="cat-circle" to="/c/$cat" params={{ cat: c.slug }}>
                <div className="cat-circle__img">
                  <img
                    src={catCover(c.slug)}
                    alt={c.name}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <b>{c.name}</b>
                <small>{c.count} itens</small>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--tint">
        <div className="container">
          <SectionHead
            eyebrow="Ranking da loja"
            title={
              <>
                Os <em>mais vendidos</em>
              </>
            }
            sub="Os modelos que mais saem na Vitrine Feminina — escolha certeira."
            link={{
              to: "/colecao/$col",
              params: { col: "mais-vendidos" },
              label: "Ver ranking completo",
            }}
          />
          <Rail items={top} ranked />
        </div>
      </section>

      {tenis && (
        <section className="section">
          <div className="container">
            <div className="kit-band">
              <div>
                <span className="eyebrow" style={{ color: "#fff" }}>
                  Promoção da coleção Tênis
                </span>
                <h2 className="title">
                  1 por <em>{brl(tenis.price)}</em> · 2 por {brl(tenis.kits[2] ?? 0)} · 3 por{" "}
                  {brl(tenis.kits[3] ?? 0)}
                </h2>
                <p>
                  Escolha a cor e a numeração de cada par. <b>Levando 2 ou 3, o frete é grátis.</b>
                </p>
              </div>
              <Link className="btn" to="/c/$cat" params={{ cat: "tenis" }}>
                Ver tênis →
              </Link>
            </div>
            <Rail
              items={sortProducts(
                BEST_SELLERS.filter((p) => p.cat === "tenis"),
                "vendidos",
                "tenis",
              ).slice(0, 12)}
            />
          </div>
        </section>
      )}

      <section className="section" style={{ paddingTop: tenis ? 0 : undefined }}>
        <div className="container">
          <div className="kit-band">
            <div>
              <span className="eyebrow" style={{ color: "#fff" }}>
                Monte o seu
              </span>
              <h2 className="title">
                Kit com 3 por <em>{brl(PRICING.kitPrice)}</em>
              </h2>
              <p>
                Escolha a cor e a numeração de cada unidade. Válido para os modelos com mais de uma
                cor.
              </p>
            </div>
            <Link className="btn" to="/colecao/$col" params={{ col: "kits" }}>
              Montar meu kit →
            </Link>
          </div>
          <Rail items={kits.filter((p) => p.cat !== "tenis")} />
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="tiles">
            {comfort && (
              <Link className="tile" to="/colecao/$col" params={{ col: "conforto" }}>
                <img src={imgLarge(comfort)} alt="Linha conforto" referrerPolicy="no-referrer" />
                <div>
                  <h3>Linha Conforto</h3>
                  <p>Ortopédicos, ultra macios e leves para o dia a dia.</p>
                  <span>Comprar agora</span>
                </div>
              </Link>
            )}
            {leather && (
              <Link className="tile" to="/colecao/$col" params={{ col: "couro" }}>
                <img src={imgLarge(leather)} alt="Bolsas de couro" referrerPolicy="no-referrer" />
                <div>
                  <h3>Couro Legítimo</h3>
                  <p>Bolsas que duram anos e combinam com tudo.</p>
                  <span>Ver bolsas</span>
                </div>
              </Link>
            )}
            {pj && (
              <Link className="tile" to="/marca/$brand" params={{ brand: "petite-jolie" }}>
                <img src={imgLarge(pj)} alt="Petite Jolie" referrerPolicy="no-referrer" />
                <div>
                  <h3>Petite Jolie</h3>
                  <p>Chinelos, tênis e bolsas da marca queridinha.</p>
                  <span>Ver coleção</span>
                </div>
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="section section--cream">
        <div className="container">
          <div className="section__head">
            <div>
              <div className="eyebrow">Escolha por categoria</div>
              <h2 className="title">Destaques da semana</h2>
            </div>
            <div className="tabs">
              {TAB_CATS.map((c) => (
                <button
                  type="button"
                  key={c}
                  className={c === tab ? "is-active" : ""}
                  onClick={() => setTab(c)}
                >
                  {CAT.get(c)?.name}
                </button>
              ))}
            </div>
          </div>
          <div className="grid">
            {tabItems.map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: 30 }}>
            <Link className="btn btn--outline" to="/c/$cat" params={{ cat: tab }}>
              Ver todos em {CAT.get(tab)?.name}
            </Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <SectionHead
            eyebrow="Acabou de chegar"
            title="Novidades"
            link={{ to: "/colecao/$col", params: { col: "novidades" }, label: "Ver todas" }}
          />
          <div className="grid">
            {news.map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
        </div>
      </section>

      <section className="section section--tint">
        <div className="container">
          <SectionHead eyebrow="As marcas que você ama" title="Compre por marca" />
          <div className="brands">
            {BRANDS.filter((b) => b.count >= 2).map((b) => (
              <Link
                key={b.slug}
                className="brand-card"
                to="/marca/$brand"
                params={{ brand: b.slug }}
              >
                <b>{b.name}</b>
                <small>{b.count} produtos</small>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="coupon">
            <div>
              <h3>Primeira compra na Vitrine?</h3>
              <p>Ganhe {brand.coupon.pct}% de desconto em todo o site. O cupom vale no checkout.</p>
            </div>
            <div className="coupon__code">
              {brand.coupon.code}{" "}
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(brand.coupon.code).catch(() => undefined);
                  setCoupon(brand.coupon.code);
                  toast("Cupom copiado e aplicado na sacola!");
                }}
              >
                Copiar
              </button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
