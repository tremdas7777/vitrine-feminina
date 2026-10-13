import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useCart } from "@/hooks/useCart";
import { brand } from "@/lib/brand";
import {
  BRANDS,
  CAT,
  CATEGORIES,
  imgSmall,
  KIT_UNITS,
  priceOf,
  PRICING,
  PRODUCTS,
  searchProducts,
  slugify,
} from "@/lib/catalog";
import { couponDiscount, couponPct, lineKey } from "@/lib/cart";
import { brl, FREE_SHIPPING_MIN } from "@/lib/shipping";
import {
  IconBadgeCheck,
  IconBag,
  IconClose,
  IconGift,
  IconHeart,
  IconInstagram,
  IconLock,
  IconMenu,
  IconSearch,
  IconShoe,
  IconTag,
  IconTruck,
} from "./icons";

/** Nome curto da categoria no menu do computador. */
const SHORT: Record<string, string> = {
  chinelos: "Chinelos",
  sapatilhas: "Sapatilhas",
  sapatos: "Sapatos",
  bolsas: "Bolsas",
};

export function Logo({ small }: { small?: boolean }) {
  return (
    <span className={`logo ${small ? "logo--sm" : ""}`}>
      <span className="logo__script">Vitrine</span>
      <span className="logo__sub">Feminina</span>
    </span>
  );
}

/** Painel lateral (menu, sacola, filtros), com fundo escurecido. */
export function Drawer({
  open,
  onClose,
  side,
  title,
  children,
  foot,
}: {
  open: boolean;
  onClose: () => void;
  side: "left" | "right";
  title: ReactNode;
  children: ReactNode;
  foot?: ReactNode;
}) {
  useEffect(() => {
    document.body.classList.toggle("lock", open);
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("keydown", esc);
      document.body.classList.remove("lock");
    };
  }, [open, onClose]);
  return (
    <>
      <div className={`overlay ${open ? "is-open" : ""}`} onClick={onClose} />
      <aside
        className={`drawer drawer--${side} ${open ? "is-open" : ""}`}
        aria-hidden={!open}
        inert={!open}
      >
        <div className="drawer__head">
          {typeof title === "string" ? <h3>{title}</h3> : title}
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar">
            <IconClose />
          </button>
        </div>
        <div className="drawer__body">{children}</div>
        {foot && <div className="drawer__foot">{foot}</div>}
      </aside>
    </>
  );
}

function Search({ open }: { open: boolean }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [show, setShow] = useState(false);
  const [idx, setIdx] = useState(-1);
  const results = useMemo(() => (q.trim().length >= 2 ? searchProducts(q) : []), [q]);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => setShow(false), [pathname]);
  const go = (slug?: string) => {
    setShow(false);
    if (slug) navigate({ to: "/p/$slug", params: { slug } });
    else if (q.trim()) navigate({ to: "/busca", search: { q: q.trim() } });
  };
  return (
    <form
      className={`search ${open ? "is-open" : ""}`}
      role="search"
      autoComplete="off"
      onSubmit={(e) => {
        e.preventDefault();
        go(results[idx]?.slug);
      }}
    >
      <IconSearch />
      <input
        type="search"
        value={q}
        placeholder="O que você procura? Ex.: rasteirinha, Petite Jolie, bota…"
        aria-label="Buscar produtos"
        onChange={(e) => {
          setQ(e.target.value);
          setIdx(-1);
          setShow(true);
        }}
        onFocus={() => setShow(true)}
        onBlur={() => setTimeout(() => setShow(false), 150)}
        onKeyDown={(e) => {
          const n = Math.min(results.length, 6);
          if (!n) return;
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setIdx((i) => (i + (e.key === "ArrowDown" ? 1 : -1) + n) % n);
          } else if (e.key === "Escape") setShow(false);
        }}
      />
      {show && q.trim().length >= 2 && (
        <div className="search__results">
          {results.length ? (
            <>
              {results.slice(0, 6).map((p, i) => (
                <Link
                  key={p.id}
                  to="/p/$slug"
                  params={{ slug: p.slug }}
                  className={`search__item ${i === idx ? "is-active" : ""}`}
                >
                  <img src={imgSmall(p)} alt="" referrerPolicy="no-referrer" />
                  <div>
                    <b>{p.name}</b>
                    <small>
                      {p.brand} · {p.inStock ? brl(priceOf(p)) : "Esgotado"}
                    </small>
                  </div>
                </Link>
              ))}
              <Link className="search__all" to="/busca" search={{ q: q.trim() }}>
                Ver todos os {results.length} resultados
              </Link>
            </>
          ) : (
            <div className="search__empty">Nenhum produto para “{q}”</div>
          )}
        </div>
      )}
    </form>
  );
}

function Nav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const cur = pathname.split("/").filter(Boolean).slice(0, 2).join("/");
  const featured = (slug: string) =>
    PRODUCTS.filter((p) => p.cat === slug && p.inStock)
      .sort((a, b) => a.rank - b.rank)
      .slice(0, 3);
  const brandsIn = (slug: string) => {
    const m = new Map<string, number>();
    for (const p of PRODUCTS) if (p.cat === slug) m.set(p.brand, (m.get(p.brand) ?? 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]).slice(0, 10);
  };
  return (
    <nav className="nav" aria-label="Categorias">
      <ul className="nav__list">
        <li className="nav__item">
          <Link
            className={`nav__link nav__link--hot ${cur === "colecao/mais-vendidos" ? "is-current" : ""}`}
            to="/colecao/$col"
            params={{ col: "mais-vendidos" }}
          >
            Mais Vendidos
          </Link>
        </li>
        <li className="nav__item">
          <Link
            className={`nav__link nav__link--kit ${cur === "colecao/kits" ? "is-current" : ""}`}
            to="/colecao/$col"
            params={{ col: "kits" }}
          >
            Kits {KIT_UNITS} un.
          </Link>
        </li>
        {CATEGORIES.map((c) => (
          <li className="nav__item" key={c.slug}>
            <Link
              className={`nav__link ${cur === `c/${c.slug}` ? "is-current" : ""}`}
              to="/c/$cat"
              params={{ cat: c.slug }}
            >
              {SHORT[c.slug] ?? c.name}
            </Link>
            <div className="mega">
              <div className="mega__inner">
                <div className="mega__links">
                  <h4>{c.name}</h4>
                  {c.subs.map((s) => (
                    <Link key={s.slug} to="/c/$cat/$sub" params={{ cat: c.slug, sub: s.slug }}>
                      {s.name}
                      <small>{s.count}</small>
                    </Link>
                  ))}
                  <Link className="mega__all" to="/c/$cat" params={{ cat: c.slug }}>
                    Ver tudo em {c.name} →
                  </Link>
                </div>
                <div>
                  <h4>Marcas</h4>
                  <div className="mega__brands">
                    {brandsIn(c.slug).map(([b]) => (
                      <Link
                        key={b}
                        to="/c/$cat"
                        params={{ cat: c.slug }}
                        search={{ marca: slugify(b) }}
                      >
                        {b}
                      </Link>
                    ))}
                  </div>
                </div>
                <div>
                  <h4>Mais vendidos</h4>
                  <div className="mega__feat">
                    {featured(c.slug).map((p) => (
                      <Link key={p.id} to="/p/$slug" params={{ slug: p.slug }}>
                        <img src={imgSmall(p)} alt="" loading="lazy" referrerPolicy="no-referrer" />
                        <span>{p.name}</span>
                        <b>{brl(priceOf(p))}</b>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </li>
        ))}
        <li className="nav__item">
          <span className="nav__link" tabIndex={0} style={{ cursor: "default" }}>
            Marcas
          </span>
          <div className="mega mega--brands">
            <div className="mega__inner">
              <div>
                <h4>Todas as marcas</h4>
                <div className="brand-grid">
                  {BRANDS.map((b) => (
                    <Link key={b.slug} to="/marca/$brand" params={{ brand: b.slug }}>
                      {b.name}
                      <small>{b.count} produtos</small>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </li>
        <li className="nav__item">
          <Link
            className={`nav__link ${cur === "colecao/ofertas" ? "is-current" : ""}`}
            to="/colecao/$col"
            params={{ col: "ofertas" }}
          >
            Ofertas
          </Link>
        </li>
      </ul>
    </nav>
  );
}

function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [openSec, setOpenSec] = useState<string | null>(null);
  const sec = (key: string, label: string, body: ReactNode) => (
    <div key={key} className={`mm-section ${openSec === key ? "is-open" : ""}`}>
      <button type="button" onClick={() => setOpenSec(openSec === key ? null : key)}>
        {label}
      </button>
      <div className="mm-sub">{body}</div>
    </div>
  );
  return (
    <Drawer open={open} onClose={onClose} side="left" title={<Logo small />}>
      <div onClick={(e) => (e.target as HTMLElement).closest("a") && onClose()}>
        <div className="mm-section">
          <Link className="mm-hot" to="/colecao/$col" params={{ col: "mais-vendidos" }}>
            ★ Mais Vendidos
          </Link>
        </div>
        <div className="mm-section">
          <Link className="mm-hot" to="/colecao/$col" params={{ col: "kits" }}>
            Kits com {KIT_UNITS} unidades
          </Link>
        </div>
        <div className="mm-section">
          <Link to="/colecao/$col" params={{ col: "novidades" }}>
            Novidades
          </Link>
        </div>
        {CATEGORIES.map((c) =>
          sec(
            c.slug,
            c.name,
            <>
              <Link to="/c/$cat" params={{ cat: c.slug }}>
                <b>Ver tudo</b>
                <small>{c.count}</small>
              </Link>
              {c.subs.map((s) => (
                <Link key={s.slug} to="/c/$cat/$sub" params={{ cat: c.slug, sub: s.slug }}>
                  {s.name}
                  <small>{s.count}</small>
                </Link>
              ))}
            </>,
          ),
        )}
        {sec(
          "marcas",
          "Marcas",
          BRANDS.map((b) => (
            <Link key={b.slug} to="/marca/$brand" params={{ brand: b.slug }}>
              {b.name}
              <small>{b.count}</small>
            </Link>
          )),
        )}
        <div className="mm-section">
          <Link to="/colecao/$col" params={{ col: "conforto" }}>
            Linha Conforto
          </Link>
        </div>
        <div className="mm-section">
          <Link to="/colecao/$col" params={{ col: "ofertas" }}>
            Ofertas
          </Link>
        </div>
        <div className="mm-section">
          <Link to="/favoritos">Meus favoritos</Link>
        </div>
        <div className="mm-section">
          <Link to="/rastreio">Rastrear pedido</Link>
        </div>
        <div style={{ marginTop: 20 }}>
          <a
            className="btn btn--outline btn--block"
            href={brand.instagram.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Instagram @{brand.instagram.handle}
          </a>
        </div>
      </div>
    </Drawer>
  );
}

function CartDrawer() {
  const cart = useCart();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const close = () => cart.setDrawerOpen(false);
  const discount = couponDiscount(cart.subtotal, cart.coupon);
  const missing = Math.max(0, Math.round((FREE_SHIPPING_MIN - cart.subtotal) * 100) / 100);
  return (
    <Drawer
      open={cart.drawerOpen}
      onClose={close}
      side="right"
      title="Sua sacola"
      foot={
        cart.resolved.length > 0 && (
          <>
            {cart.coupon ? (
              <div className="cart-ok">
                Cupom {cart.coupon} aplicado ({couponPct(cart.coupon)}% OFF) ✓{" "}
                <button
                  type="button"
                  className="link"
                  style={{ fontSize: 12 }}
                  onClick={() => cart.setCoupon(null)}
                >
                  remover
                </button>
              </div>
            ) : (
              <form
                className="cart-coupon"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (cart.setCoupon(code)) toast("Cupom aplicado!");
                  else toast("Cupom inválido");
                }}
              >
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Cupom de desconto"
                  aria-label="Cupom"
                />
                <button>Aplicar</button>
              </form>
            )}
            <div className="cart-sum">
              <span>Subtotal</span>
              <span>{brl(cart.subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="cart-sum" style={{ color: "var(--green)" }}>
                <span>Desconto</span>
                <span>− {brl(discount)}</span>
              </div>
            )}
            <div className="cart-sum cart-sum--total">
              <span>Total</span>
              <span>{brl(cart.subtotal - discount)}</span>
            </div>
            <button
              type="button"
              className="btn btn--primary btn--block"
              style={{ marginTop: 12 }}
              onClick={() => {
                close();
                navigate({ to: "/checkout" });
              }}
            >
              Comprar agora
            </button>
            <p className="cart-foot__hint">
              {missing > 0
                ? `Faltam ${brl(missing)} para o frete grátis.`
                : "Você ganhou frete grátis!"}{" "}
              Pagamento seguro via Pix.
            </p>
          </>
        )
      }
    >
      {cart.resolved.length === 0 ? (
        <div className="cart-empty">
          <IconBag />
          <b style={{ display: "block", color: "var(--ink)", fontSize: 17 }}>
            Sua sacola está vazia
          </b>
          <p>Que tal dar uma olhada nos mais vendidos?</p>
          <Link
            className="btn btn--primary"
            to="/colecao/$col"
            params={{ col: "mais-vendidos" }}
            onClick={close}
          >
            Ver mais vendidos
          </Link>
        </div>
      ) : (
        cart.resolved.map((l) => {
          const key = lineKey(l.line);
          return (
            <div className="cart-item" key={key}>
              <Link to="/p/$slug" params={{ slug: l.product.slug }} onClick={close}>
                <img src={imgSmall(l.product)} alt={l.product.name} referrerPolicy="no-referrer" />
              </Link>
              <div>
                {l.line.kit && (
                  <span
                    className="tag tag--kit"
                    style={{ display: "inline-block", marginBottom: 4 }}
                  >
                    Kit {KIT_UNITS} unidades
                  </span>
                )}
                <Link
                  className="cart-item__name"
                  to="/p/$slug"
                  params={{ slug: l.product.slug }}
                  onClick={close}
                >
                  {l.product.name}
                </Link>
                <div className="cart-item__opts">
                  {l.line.kit ? l.detail.split(" | ").map((d) => <div key={d}>{d}</div>) : l.detail}
                </div>
                <div className="cart-item__row">
                  <div className="qty">
                    <button
                      type="button"
                      aria-label="Diminuir"
                      onClick={() => cart.setQty(key, l.line.qty - 1)}
                    >
                      −
                    </button>
                    <span>{l.line.qty}</span>
                    <button
                      type="button"
                      aria-label="Aumentar"
                      onClick={() => cart.setQty(key, l.line.qty + 1)}
                    >
                      +
                    </button>
                  </div>
                  <b>{brl(l.total)}</b>
                </div>
                <button type="button" className="cart-item__rm" onClick={() => cart.remove(key)}>
                  Remover
                </button>
              </div>
            </div>
          );
        })
      )}
    </Drawer>
  );
}

function Footer() {
  const shoes = ["sandalias", "chinelos", "tenis", "sapatilhas", "sapatos", "botas"];
  return (
    <footer className="footer">
      <div className="footer__perks container">
        <div>
          <span>
            <IconLock />
          </span>
          <b>Compra 100% segura</b>
          <small>Pagamento via Pix com aprovação na hora</small>
        </div>
        <div>
          <span>
            <IconBadgeCheck />
          </span>
          <b>Produtos originais</b>
          <small>Revendedora das marcas que você ama</small>
        </div>
        <div>
          <span>
            <IconGift />
          </span>
          <b>{brand.coupon.pct}% na 1ª compra</b>
          <small>Use o cupom {brand.coupon.code}</small>
        </div>
        <div>
          <span>
            <IconInstagram />
          </span>
          <b>@{brand.instagram.handle}</b>
          <small>Novidades toda semana no Instagram</small>
        </div>
      </div>
      <div className="footer__cols container">
        <div>
          <Logo />
          <p className="footer__about">
            Calçados femininos, bolsas e acessórios das marcas que você ama, com atendimento próximo
            e carinhoso.
          </p>
        </div>
        <div>
          <h5>Calçados</h5>
          {shoes.map((s) => (
            <Link key={s} to="/c/$cat" params={{ cat: s }}>
              {CAT.get(s)?.name}
            </Link>
          ))}
        </div>
        <div>
          <h5>Bolsas & mais</h5>
          {CAT.get("bolsas")?.subs.map((s) => (
            <Link key={s.slug} to="/c/$cat/$sub" params={{ cat: "bolsas", sub: s.slug }}>
              {s.name}
            </Link>
          ))}
          <Link to="/c/$cat" params={{ cat: "infantil" }}>
            Infantil
          </Link>
        </div>
        <div>
          <h5>Coleções</h5>
          {(
            [
              ["mais-vendidos", "Mais vendidos"],
              ["kits", `Kits com ${KIT_UNITS} unidades`],
              ["novidades", "Novidades"],
              ["conforto", "Linha conforto"],
              ["couro", "Couro legítimo"],
              ["ofertas", "Ofertas"],
            ] as const
          ).map(([col, label]) => (
            <Link key={col} to="/colecao/$col" params={{ col }}>
              {label}
            </Link>
          ))}
        </div>
        <div>
          <h5>Atendimento</h5>
          <Link to="/rastreio">Rastrear pedido</Link>
          <Link to="/contato">Fale conosco</Link>
          <Link to="/faq">Perguntas frequentes</Link>
          <Link to="/politica-envio">Envio e entrega</Link>
          <Link to="/politica-reembolso">Trocas e devoluções</Link>
          <Link to="/politica-privacidade">Privacidade</Link>
        </div>
      </div>
      <div className="footer__bottom container">
        <span>
          © {new Date().getFullYear()} {brand.company.legalName || brand.name}
          {brand.company.cnpj && ` · CNPJ ${brand.company.cnpj}`} — Todos os direitos reservados.
        </span>
        <span>Preços e estoque sujeitos a alteração.</span>
      </div>
    </footer>
  );
}

/** Layout da vitrine: faixa de avisos, cabeçalho, menu, sacola e rodapé. */
export function StoreLayout({ children }: { children: ReactNode }) {
  const cart = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setMenuOpen(false);
    setSearchOpen(false);
    cart.setDrawerOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const tenis = PRICING.promos["tenis"];
  const notes = (
    <>
      <span>
        <IconTag /> <b>{brand.coupon.pct}% OFF</b> na primeira compra com o cupom <b>{brand.coupon.code}</b>
      </span>
      {tenis && (
        <span>
          <IconShoe /> <b>Tênis: 1 por {brl(tenis.price)}</b> · 2 por {brl(tenis.kits[2] ?? 0)} · 3 por{" "}
          {brl(tenis.kits[3] ?? 0)} — <b>frete grátis levando 2</b>
        </span>
      )}
      <span>
        <IconTruck /> <b>Frete grátis</b> acima de {brl(FREE_SHIPPING_MIN)}
      </span>
    </>
  );

  return (
    <div className="vf">
      <div className="topbar">
        <div className="topbar__track">
          {notes}
          <span aria-hidden className="topbar__dup">
            {notes}
          </span>
        </div>
      </div>
      <header className="header">
        <div className="header__main container">
          <div className="header__left">
            <button
              type="button"
              className="icon-btn only-mobile"
              onClick={() => setMenuOpen(true)}
              aria-label="Abrir menu"
            >
              <IconMenu />
            </button>
            <button
              type="button"
              className="icon-btn only-mobile"
              onClick={() => setSearchOpen((v) => !v)}
              aria-label="Buscar"
            >
              <IconSearch />
            </button>
            <Search open={searchOpen} />
          </div>
          <Link to="/" className="header__logo" aria-label={`${brand.name} - página inicial`}>
            <Logo />
          </Link>
          <div className="header__actions">
            <Link className="icon-btn" to="/favoritos" aria-label="Favoritos">
              <IconHeart />
              {cart.favs.size > 0 && <span className="badge">{cart.favs.size}</span>}
            </Link>
            <button
              type="button"
              className="icon-btn"
              onClick={() => cart.setDrawerOpen(true)}
              aria-label="Abrir sacola"
            >
              <IconBag />
              {cart.count > 0 && <span className="badge">{cart.count}</span>}
            </button>
          </div>
        </div>
        <Nav />
      </header>
      <main>{children}</main>
      <Footer />
      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
      <CartDrawer />
    </div>
  );
}
