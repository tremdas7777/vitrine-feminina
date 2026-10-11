(() => {
  "use strict";

  const WHATSAPP = "5513997712047";
  const INSTAGRAM = "https://instagram.com/samisapatilhasecia";
  const COUPONS = { PRIMEIRA10: 0.10 };
  const PAGE = 24;
  const KIT_PRICE = 99;
  const KIT_UNITS = 3;

  const { categories: CATS, products: ALL, banners: BANNERS } = window.STORE;
  const BY_SLUG = new Map(ALL.map(p => [p.slug, p]));
  const BY_ID = new Map(ALL.map(p => [p.id, p]));
  const CAT = new Map(CATS.map(c => [c.slug, c]));

  // ---------- helpers ----------
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const norm = s => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const slugify = s => norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const money = v => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };
  const subName = (cat, sub) => CAT.get(cat)?.subs.find(s => s.slug === sub)?.name || "";

  // brands
  const BRANDS = (() => {
    const m = new Map();
    ALL.forEach(p => m.set(p.brand, (m.get(p.brand) || 0) + 1));
    return [...m].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, slug: slugify(name), count }));
  })();
  const BRAND_BY_SLUG = new Map(BRANDS.map(b => [b.slug, b]));

  // color families
  const COLOR_FAMILIES = [
    ["Preto", "#1d1a1b", /pret|black|onix|ônix/],
    ["Branco & Off", "#f7f5f0", /branc|white|off|gelo|perola|pérola|bone|marfim/],
    ["Nude & Bege", "#e1c3a6", /nude|bege|areia|creme|natural|baunilha|amendoa|almond|sand|cream|palha|champagne/],
    ["Marrom & Caramelo", "#9a6038", /marrom|caramel|camel|conhaque|cacau|cafe|chocolate|tan|whisky|castanh|doce de leite|nocciola|avela|mel|tabaco|brown|canela|cognac|terra|capuccino|cappuccino|amendo/],
    ["Rosa", "#ef9ab4", /rosa|pink|chiclete|blush|rose|berry|gelato|lilas|lavanda|lilac/],
    ["Vermelho & Vinho", "#a3243b", /vermelh|red|vinho|bordo|marsala|cereja|coral|laranja|telha/],
    ["Azul", "#3a63b8", /azul|blue|jeans|navy|marinho|royal|turquesa/],
    ["Verde", "#5b8a5a", /verde|green|militar|oliva|menta|luna|limao|lima/],
    ["Dourado & Prata", "linear-gradient(135deg,#e7c873,#b8935a 50%,#d9d9d9 50%,#9a9a9a)", /dourad|ouro|gold|prata|silver|metal|bronze|cobre|glitter|grafite|chumbo/],
    ["Cinza", "#9a9a9e", /cinza|grey|gray|fume|mescla/],
    ["Amarelo", "#eccb50", /amarel|yellow|mostarda/],
  ];
  const colorFamily = name => {
    const n = norm(name);
    for (const [fam, , rx] of COLOR_FAMILIES) if (rx.test(n)) return fam;
    return "Outras cores";
  };
  const famHex = fam => (COLOR_FAMILIES.find(f => f[0] === fam) || [, "conic-gradient(#ef9ab4,#eccb50,#5b8a5a,#3a63b8,#ef9ab4)"])[1];
  const colorHex = name => famHex(colorFamily(name));
  ALL.forEach(p => { p.fams = [...new Set(p.colors.map(colorFamily))]; p.search = norm(`${p.name} ${p.brand} ${subName(p.cat, p.sub)} ${CAT.get(p.cat)?.name} ${p.colors.join(" ")} ${p.sku}`); });

  const bestSellers = [...ALL].filter(p => p.inStock).sort((a, b) => a.rank - b.rank);
  const TOP_IDS = new Set(bestSellers.slice(0, 12).map(p => p.id));
  const topRank = new Map(bestSellers.slice(0, 50).map((p, i) => [p.id, i + 1]));

  // kit 3 unidades: produtos com mais de uma cor, quando o kit sai mais barato que 3 avulsos
  const hasKit = p => p.inStock && p.colors.length > 1 && p.price * KIT_UNITS > KIT_PRICE;
  const unitPrice = i => (i.kit ? KIT_PRICE : BY_ID.get(i.id)?.price || 0);

  const COLLECTIONS = {
    "kits": { name: `Kit ${KIT_UNITS} por ${money(KIT_PRICE)}`, sub: "Leve 3 unidades e escolha a cor e a numeração de cada uma.", filter: hasKit, sort: "vendidos" },
    "mais-vendidos": { name: "Mais Vendidos", sub: "Os queridinhos das nossas clientes — ranking atualizado pelas vendas da loja.", filter: p => p.inStock, sort: "vendidos" },
    "novidades": { name: "Novidades", sub: "Acabaram de chegar na Vitrine.", filter: () => true, sort: "novos" },
    "ofertas": { name: "Ofertas & Achadinhos", sub: "Produtos em promoção e achadinhos até R$ 99,90.", filter: p => p.inStock && (p.regular || p.price < 100), sort: "preco-asc" },
    "conforto": { name: "Linha Conforto", sub: "Palmilhas macias, modelos ortopédicos e ultra conforto para o dia todo.", filter: p => p.comfort, sort: "vendidos" },
    "couro": { name: "Couro Legítimo", sub: "Bolsas e calçados em couro legítimo.", filter: p => p.leather, sort: "vendidos" },
    "favoritos": { name: "Meus Favoritos", sub: "Os produtos que você salvou.", filter: p => favs.has(p.id), sort: "vendidos" },
  };

  // ---------- state ----------
  let cart = store.get("sami_cart", []);
  const favs = new Set(store.get("sami_favs", []));
  let coupon = store.get("sami_coupon", null);
  let listLimit = PAGE;
  let lastListKey = "";

  // ---------- router ----------
  function parseHash() {
    const h = location.hash.slice(1) || "/";
    const [path, qs] = h.split("?");
    const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
    const q = Object.fromEntries(new URLSearchParams(qs || ""));
    return { parts, q, path };
  }
  function setQuery(patch) {
    const { path, q } = parseHash();
    const next = { ...q, ...patch };
    Object.keys(next).forEach(k => (next[k] === "" || next[k] == null) && delete next[k]);
    const qs = new URLSearchParams(next).toString();
    history.replaceState(null, "", "#" + path + (qs ? "?" + qs : ""));
    render(false, true);
  }

  function render(scroll = true, keepDrawers = false) {
    const { parts, q } = parseHash();
    const app = $("#app");
    if (!keepDrawers) closeAll();
    hideSearch();
    let html;
    const [r, a, b] = parts;
    if (!r) html = viewHome();
    else if (r === "p" && BY_SLUG.has(a)) html = viewProduct(BY_SLUG.get(a));
    else if (r === "c" && CAT.has(a)) html = viewListing({ cat: a, sub: b || q.sub }, q);
    else if (r === "marca" && BRAND_BY_SLUG.has(a)) html = viewListing({ brand: a }, q);
    else if (r === "colecao" && COLLECTIONS[a]) html = viewListing({ col: a }, q);
    else if (r === "busca") html = viewListing({ search: q.q || "" }, q);
    else html = viewNotFound();
    app.innerHTML = html;
    afterRender(parts);
    markNav(parts);
    if (scroll) { window.scrollTo({ top: 0, behavior: "instant" }); app.focus({ preventScroll: true }); }
  }

  // ---------- components ----------
  const heart = `<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-9.2-8.6C1.3 8.4 3 5 6.3 5c2 0 3.2 1.1 3.7 2 .5-.9 1.7-2 3.7-2C17 5 18.7 8.4 17.2 11.4 15 15.6 12 20 12 20z" transform="translate(1.5 0)"/></svg>`;
  const chevL = `<svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>`;
  const chevR = `<svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>`;
  const img = (src, alt, cls = "") => `<img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" ${cls ? `class="${cls}"` : ""}>`;

  function priceHtml(p) {
    if (!p.inStock && !p.price) return `<div class="price"><b>Esgotado</b></div>`;
    const off = p.regular ? `<s>${money(p.regular)}</s>` : "";
    return `<div class="price"><b>${money(p.price)}</b>${off}</div>`;
  }

  function card(p, opts = {}) {
    const tags = [];
    if (!p.inStock) tags.push(`<span class="tag tag--out">Esgotado</span>`);
    else {
      if (p.regular) tags.push(`<span class="tag tag--sale">-${Math.round((1 - p.price / p.regular) * 100)}%</span>`);
      if (TOP_IDS.has(p.id) && !opts.ranked) tags.push(`<span class="tag tag--best">Mais vendido</span>`);
      if (hasKit(p)) tags.push(`<span class="tag tag--kit">Kit 3 por R$ 99</span>`);
      if (p.comfort && tags.length < 2) tags.push(`<span class="tag tag--comfort">Conforto</span>`);
    }
    const second = p.imgs[1] ? img(p.imgs[1].s, p.name, "alt") : "";
    const dots = p.colors.slice(0, 5).map(c => `<i class="dot" style="background:${colorHex(c)}" title="${esc(c)}"></i>`).join("");
    const more = p.colors.length > 5 ? `+${p.colors.length - 5}` : (p.colors.length > 1 ? `${p.colors.length} cores` : "");
    const media = `${p.imgs[0] ? img(p.imgs[0].s, p.name) : ""}${second}`;
    return `<article class="card ${p.inStock ? "" : "card--out"} ${opts.ranked ? "card--ranked" : ""}">
      <a class="card__media" href="#/p/${p.slug}" aria-label="${esc(p.name)}">
        ${opts.ranked ? `<div class="clip">${media}</div><span class="rank">${opts.ranked}</span>` : media}
        <div class="card__tags">${tags.join("")}</div>
        <span class="card__quick">${p.inStock ? "Escolher tamanho e cor" : "Ver detalhes"}</span>
      </a>
      <button class="card__fav ${favs.has(p.id) ? "is-on" : ""}" data-fav="${p.id}" aria-label="Favoritar">${heart}</button>
      <div class="card__body">
        <span class="card__brand">${esc(p.brand)}</span>
        <a class="card__name" href="#/p/${p.slug}">${esc(p.name)}</a>
        ${dots ? `<div class="card__colors">${dots}<span>${more}</span></div>` : ""}
        ${priceHtml(p)}
        ${hasKit(p) ? `<span class="card__kit">ou <b>3 por ${money(KIT_PRICE)}</b></span>` : ""}
      </div>
    </article>`;
  }

  const rail = (items, opts = {}) => `<div class="rail">
      <button class="rail__btn rail__btn--prev" data-rail="-1" aria-label="Anterior">${chevL}</button>
      <div class="rail__track">${items.map((p, i) => card(p, opts.ranked ? { ranked: i + 1 } : {})).join("")}</div>
      <button class="rail__btn rail__btn--next" data-rail="1" aria-label="Próximo">${chevR}</button>
    </div>`;

  const head = (eyebrow, title, sub, link) => `<div class="section__head">
      <div><div class="eyebrow">${eyebrow}</div><h2 class="title">${title}</h2>${sub ? `<p class="section__sub">${sub}</p>` : ""}</div>
      ${link ? `<a class="link" href="${link[0]}">${link[1]} →</a>` : ""}
    </div>`;

  const catCover = slug => {
    const p = ALL.filter(x => x.cat === slug && x.inStock).sort((a, b) => a.rank - b.rank)[0] || ALL.find(x => x.cat === slug);
    return p?.imgs[0]?.s || "";
  };

  // ---------- views ----------
  function viewHome() {
    const top = bestSellers.slice(0, 12);
    const news = [...ALL].filter(p => p.inStock).sort((a, b) => b.id - a.id).slice(0, 8);
    const tabsCats = ["sandalias", "tenis", "bolsas", "sapatilhas", "botas"];
    const comfortImg = bestSellers.find(p => p.comfort && p.cat === "tenis")?.imgs[0]?.l;
    const leatherImg = bestSellers.find(p => p.leather && p.cat === "bolsas")?.imgs[0]?.l;
    const pjImg = bestSellers.find(p => p.brand === "Petite Jolie" && p.cat === "chinelos")?.imgs[0]?.l;

    return `
    <section class="hero" id="hero">
      <div class="hero__track">${BANNERS.map((b, i) => `<a class="hero__slide" href="#/colecao/novidades"><img src="${b}" alt="Banner ${i + 1}" ${i ? 'loading="lazy"' : ""} referrerpolicy="no-referrer"></a>`).join("")}</div>
      <button class="hero__arrow hero__arrow--prev" data-hero="-1" aria-label="Anterior">${chevL}</button>
      <button class="hero__arrow hero__arrow--next" data-hero="1" aria-label="Próximo">${chevR}</button>
      <div class="hero__dots">${BANNERS.map((_, i) => `<button data-dot="${i}" aria-label="Banner ${i + 1}"></button>`).join("")}</div>
    </section>
    <div class="perks container">
      <div><span>💬</span><p><b>Compre pelo WhatsApp</b>Atendimento rápido e humanizado</p></div>
      <div><span>✅</span><p><b>Marcas originais</b>Beira Rio, Modare, Petite Jolie…</p></div>
      <div><span>🎁</span><p><b>10% OFF</b>na 1ª compra: PRIMEIRA10</p></div>
      <div><span>👣</span><p><b>Linha conforto</b>Ortopédicos e ultra macios</p></div>
    </div>

    <section class="section">
      <div class="container">
        ${head("Navegue por", "Categorias", "")}
        <div class="cat-circles">
          <a class="cat-circle" href="#/colecao/mais-vendidos"><div class="cat-circle__img cat-circle__img--hot"><span>★</span><b>TOP</b></div><b>Mais Vendidos</b><small>Ranking da loja</small></a>
          ${CATS.map(c => `<a class="cat-circle" href="#/c/${c.slug}"><div class="cat-circle__img">${img(catCover(c.slug), c.name)}</div><b>${esc(c.name)}</b><small>${c.count} itens</small></a>`).join("")}
        </div>
      </div>
    </section>

    <section class="section section--tint">
      <div class="container">
        ${head("Ranking da loja", "Os <em>mais vendidos</em>", "Os modelos que mais saem na Vitrine Feminina — escolha certeira.", ["#/colecao/mais-vendidos", "Ver ranking completo"])}
        ${rail(top, { ranked: true })}
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="kit-band">
          <div><span class="eyebrow" style="color:#fff">Monte o seu</span><h2 class="title">Kit com 3 por <em>${money(KIT_PRICE)}</em></h2><p>Escolha a cor e a numeração de cada unidade. Válido para todos os modelos com mais de uma cor.</p></div>
          <a class="btn" href="#/colecao/kits">Montar meu kit →</a>
        </div>
        ${rail(bestSellers.filter(hasKit).slice(0, 12))}
      </div>
    </section>

    <section class="section" style="padding-top:0">
      <div class="container">
        <div class="tiles">
          <a class="tile" href="#/colecao/conforto">${img(comfortImg, "Linha conforto")}<div><h3>Linha Conforto</h3><p>Ortopédicos, ultra macios e leves para o dia a dia.</p><span>Comprar agora</span></div></a>
          <a class="tile" href="#/colecao/couro">${img(leatherImg, "Bolsas de couro")}<div><h3>Couro Legítimo</h3><p>Bolsas que duram anos e combinam com tudo.</p><span>Ver bolsas</span></div></a>
          <a class="tile" href="#/marca/petite-jolie">${img(pjImg, "Petite Jolie")}<div><h3>Petite Jolie</h3><p>Chinelos, tênis e bolsas da marca queridinha.</p><span>Ver coleção</span></div></a>
        </div>
      </div>
    </section>

    <section class="section section--cream">
      <div class="container">
        <div class="section__head">
          <div><div class="eyebrow">Escolha por categoria</div><h2 class="title">Destaques da semana</h2></div>
          <div class="tabs" id="homeTabs">${tabsCats.map((c, i) => `<button class="${i ? "" : "is-active"}" data-tab="${c}">${esc(CAT.get(c).name)}</button>`).join("")}</div>
        </div>
        <div id="tabPanel">${tabPanel(tabsCats[0])}</div>
      </div>
    </section>

    <section class="section">
      <div class="container">
        ${head("Acabou de chegar", "Novidades", "", ["#/colecao/novidades", "Ver todas"])}
        <div class="grid">${news.map(p => card(p)).join("")}</div>
      </div>
    </section>

    <section class="section section--tint">
      <div class="container">
        ${head("As marcas que você ama", "Compre por marca", "")}
        <div class="brands">${BRANDS.filter(b => b.count >= 2).map(b => `<a class="brand-card" href="#/marca/${b.slug}"><b>${esc(b.name)}</b><small>${b.count} produtos</small></a>`).join("")}</div>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="coupon">
          <div><h3>Primeira compra na Vitrine?</h3><p>Ganhe 10% de desconto em todo o site. Aplique o cupom na sacola.</p></div>
          <div class="coupon__code">PRIMEIRA10 <button data-copy="PRIMEIRA10">Copiar</button></div>
        </div>
      </div>
    </section>`;
  }

  function tabPanel(cat) {
    const items = ALL.filter(p => p.cat === cat && p.inStock).sort((a, b) => a.rank - b.rank).slice(0, 8);
    return `<div class="grid">${items.map(p => card(p)).join("")}</div>
      <div style="text-align:center;margin-top:30px"><a class="btn btn--outline" href="#/c/${cat}">Ver todos em ${esc(CAT.get(cat).name)}</a></div>`;
  }

  // ---------- listing ----------
  const PRICE_RANGES = [["0-100", "Até R$ 100", 0, 100], ["100-150", "R$ 100 a R$ 150", 100, 150], ["150-200", "R$ 150 a R$ 200", 150, 200], ["200-300", "R$ 200 a R$ 300", 200, 300], ["300-", "Acima de R$ 300", 300, Infinity]];
  const SORTS = [["vendidos", "Mais vendidos"], ["novos", "Novidades"], ["preco-asc", "Menor preço"], ["preco-desc", "Maior preço"], ["az", "A – Z"]];
  const list = v => (v ? String(v).split(",").filter(Boolean) : []);

  function sortItems(items, s) {
    const out = [...items];
    const stockFirst = (a, b) => (b.inStock - a.inStock);
    const fn = {
      vendidos: (a, b) => stockFirst(a, b) || a.rank - b.rank,
      novos: (a, b) => stockFirst(a, b) || b.id - a.id,
      "preco-asc": (a, b) => stockFirst(a, b) || a.price - b.price,
      "preco-desc": (a, b) => stockFirst(a, b) || b.price - a.price,
      az: (a, b) => a.name.localeCompare(b.name, "pt-BR"),
    }[s] || ((a, b) => a.rank - b.rank);
    return out.sort(fn);
  }

  function viewListing(ctx, q) {
    // base set + context
    let base = ALL, title = "", sub = "", crumbs = [["#/", "Início"]], chips = "";
    if (ctx.cat) {
      const c = CAT.get(ctx.cat);
      base = ALL.filter(p => p.cat === ctx.cat);
      title = c.name; crumbs.push([`#/c/${c.slug}`, c.name]);
      if (ctx.sub) { title = subName(ctx.cat, ctx.sub) || c.name; crumbs.push([null, title]); }
      chips = `<a class="chip ${ctx.sub ? "" : "is-active"}" href="#/c/${c.slug}">Todos<small>${c.count}</small></a>` +
        c.subs.map(s => `<a class="chip ${ctx.sub === s.slug ? "is-active" : ""}" href="#/c/${c.slug}/${s.slug}">${esc(s.name)}<small>${s.count}</small></a>`).join("");
      if (ctx.sub) base = base.filter(p => p.sub === ctx.sub);
    } else if (ctx.brand) {
      const b = BRAND_BY_SLUG.get(ctx.brand);
      base = ALL.filter(p => p.brand === b.name);
      title = b.name; sub = `Todos os produtos ${b.name} disponíveis na Vitrine Feminina.`;
      crumbs.push([null, "Marcas"], [null, b.name]);
    } else if (ctx.col) {
      const col = COLLECTIONS[ctx.col];
      base = ALL.filter(col.filter); title = col.name; sub = col.sub; crumbs.push([null, col.name]);
      if (ctx.col === "mais-vendidos") base = base.filter(p => topRank.has(p.id));
    } else if ("search" in ctx) {
      const terms = norm(ctx.search).split(/\s+/).filter(Boolean);
      base = terms.length ? ALL.filter(p => terms.every(t => p.search.includes(t) || p.search.includes(t.replace(/s$/, "")))) : [];
      title = ctx.search ? `Resultados para “${esc(ctx.search)}”` : "Busca";
      crumbs.push([null, "Busca"]);
    }

    // filters
    const f = {
      cat: list(q.cat), marca: list(q.marca), tam: list(q.tam), cor: list(q.cor), preco: list(q.preco), disp: q.disp === "1",
    };
    const applyFilters = (items, skip) => items.filter(p =>
      (skip === "cat" || !f.cat.length || f.cat.includes(p.cat)) &&
      (skip === "marca" || !f.marca.length || f.marca.includes(slugify(p.brand))) &&
      (skip === "tam" || !f.tam.length || p.sizes.some(s => f.tam.includes(s))) &&
      (skip === "cor" || !f.cor.length || p.fams.some(c => f.cor.includes(slugify(c)))) &&
      (skip === "preco" || !f.preco.length || f.preco.some(k => { const r = PRICE_RANGES.find(x => x[0] === k); return r && p.price >= r[2] && p.price < r[3]; })) &&
      (!f.disp || p.inStock));

    const defaultSort = ctx.col ? COLLECTIONS[ctx.col].sort : "vendidos";
    const sort = q.ordem || defaultSort;
    const filtered = sortItems(applyFilters(base), sort);

    const key = JSON.stringify([ctx, q]);
    if (key !== lastListKey) { listLimit = PAGE; lastListKey = key; }
    const shown = filtered.slice(0, listLimit);

    // facet counts
    const count = (skip, pred) => applyFilters(base, skip).filter(pred).length;
    const groups = [];
    if (!ctx.cat) {
      const cats = CATS.map(c => ({ v: c.slug, label: c.name, n: count("cat", p => p.cat === c.slug) })).filter(x => x.n || f.cat.includes(x.v));
      if (cats.length > 1) groups.push(checkGroup("Categoria", "cat", cats, f.cat));
    }
    if (!ctx.brand) {
      const brands = BRANDS.map(b => ({ v: b.slug, label: b.name, n: count("marca", p => p.brand === b.name) })).filter(x => x.n || f.marca.includes(x.v));
      if (brands.length > 1) groups.push(checkGroup("Marca", "marca", brands, f.marca, 8));
    }
    const sizeSet = new Set(); base.forEach(p => p.sizes.forEach(s => sizeSet.add(s)));
    const sizes = [...sizeSet].filter(s => /^\d+$/.test(s)).sort((a, b) => a - b);
    if (sizes.length) groups.push(`<div class="fgroup"><h4>Tamanho</h4><div class="fsizes">${sizes.map(s => `<button class="${f.tam.includes(s) ? "is-active" : ""}" data-toggle="tam" data-v="${s}">${s}</button>`).join("")}</div></div>`);
    const fams = [...COLOR_FAMILIES.map(c => c[0]), "Outras cores"].map(name => ({ v: slugify(name), label: name, n: count("cor", p => p.fams.includes(name)), dot: famHex(name) })).filter(x => x.n || f.cor.includes(x.v));
    if (fams.length > 1) groups.push(checkGroup("Cor", "cor", fams, f.cor));
    const prices = PRICE_RANGES.map(([v, label, lo, hi]) => ({ v, label, n: count("preco", p => p.price >= lo && p.price < hi) })).filter(x => x.n || f.preco.includes(x.v));
    groups.push(checkGroup("Preço", "preco", prices, f.preco));
    groups.push(`<div class="fgroup"><label class="fcheck"><input type="checkbox" data-disp ${f.disp ? "checked" : ""}> Somente disponíveis</label></div>`);
    const filtersHtml = groups.join("");

    // active chips
    const act = [];
    const labelOf = (k, v) => ({
      cat: () => CAT.get(v)?.name, marca: () => BRAND_BY_SLUG.get(v)?.name, tam: () => `Tam. ${v}`,
      cor: () => fams.find(x => x.v === v)?.label || v, preco: () => PRICE_RANGES.find(x => x[0] === v)?.[1],
    }[k]());
    ["cat", "marca", "tam", "cor", "preco"].forEach(k => f[k].forEach(v => act.push(`<button data-toggle="${k}" data-v="${esc(v)}">${esc(labelOf(k, v))} ✕</button>`)));
    if (f.disp) act.push(`<button data-disp-off>Disponíveis ✕</button>`);
    if (act.length) act.push(`<button class="clear" data-clear>Limpar tudo</button>`);

    $("#filterDrawerBody").innerHTML = filtersHtml;

    const emptyMsg = ctx.col === "favoritos"
      ? `<div class="empty"><b>Nenhum favorito ainda</b>Toque no coração dos produtos para salvá-los aqui.<br><br><a class="btn btn--primary" href="#/colecao/mais-vendidos">Ver mais vendidos</a></div>`
      : `<div class="empty"><b>Nenhum produto encontrado</b>Tente remover alguns filtros ou buscar por outro termo.<br><br><a class="btn btn--outline" href="#/colecao/mais-vendidos">Ver mais vendidos</a></div>`;

    const ranked = ctx.col === "mais-vendidos" && sort === "vendidos" && !act.length;
    return `
    <div class="container">
      <nav class="crumbs">${crumbs.map(([h, l], i) => (i ? "<span>" : "") + (h ? `<a href="${h}">${esc(l)}</a>` : esc(l)) + (i ? "</span>" : "")).join(" ")}</nav>
      <div class="listing__head">
        <div><h1 class="title">${title}</h1>${sub ? `<p class="section__sub">${sub}</p>` : ""}</div>
        ${chips ? `<div class="listing__subs">${chips}</div>` : ""}
      </div>
      <div class="listing">
        <aside class="filters" aria-label="Filtros">${filtersHtml}</aside>
        <div>
          <div class="toolbar">
            <button class="btn btn--outline filter-btn" id="openFilters" style="height:42px;padding:0 18px">Filtrar${act.length ? ` (${act.length - 1})` : ""}</button>
            <span class="toolbar__count only-desktop">${filtered.length} ${filtered.length === 1 ? "produto" : "produtos"}</span>
            <select class="select" id="sortSel" aria-label="Ordenar">${SORTS.map(([v, l]) => `<option value="${v}" ${v === sort ? "selected" : ""}>${l}</option>`).join("")}</select>
          </div>
          ${act.length ? `<div class="factive">${act.join("")}</div>` : ""}
          ${filtered.length ? `<div class="grid">${shown.map((p, i) => card(p, ranked ? { ranked: i + 1 } : {})).join("")}</div>` : emptyMsg}
          ${filtered.length > shown.length ? `<div class="more"><span>Mostrando ${shown.length} de ${filtered.length}</span><div class="more__bar"><i style="width:${(shown.length / filtered.length) * 100}%"></i></div><button class="btn btn--outline" id="loadMore">Carregar mais</button></div>` : ""}
        </div>
      </div>
    </div>`;
  }

  function checkGroup(title, key, items, active, limit = 99) {
    const rows = items.map((x, i) => `<label class="fcheck" ${i >= limit && !active.includes(x.v) ? 'data-extra hidden' : ""}>
        <input type="checkbox" data-toggle="${key}" data-v="${esc(x.v)}" ${active.includes(x.v) ? "checked" : ""}>
        ${x.dot ? `<i class="dot" style="background:${x.dot}"></i>` : ""}${esc(x.label)}<small>${x.n}</small></label>`).join("");
    const more = items.length > limit ? `<button class="fmore" data-more>+ Ver todas (${items.length})</button>` : "";
    return `<div class="fgroup"><h4>${title}</h4>${rows}${more}</div>`;
  }

  // ---------- product page ----------
  let sel = {};
  function viewProduct(p) {
    const only = arr => (arr.length === 1 ? arr[0] : null);
    sel = { id: p.id, color: only(p.colors), size: only(p.sizes), qty: 1, img: 0, mode: "single",
      units: Array.from({ length: KIT_UNITS }, () => ({ color: only(p.colors), size: only(p.sizes) })) };
    const c = CAT.get(p.cat);
    const rk = topRank.get(p.id);
    const related = ALL.filter(x => x.id !== p.id && x.inStock && x.cat === p.cat && (x.sub === p.sub || x.brand === p.brand)).sort((a, b) => a.rank - b.rank).slice(0, 8);
    const alsoBest = bestSellers.filter(x => x.id !== p.id && !related.includes(x)).slice(0, 8);
    const sizeOpts = p.sizes.length ? `<div class="opt" id="optSize"><div class="opt__label"><span>Tamanho: <b id="selSize">${esc(sel.size || "selecione")}</b></span>${/^\d+$/.test(p.sizes[0]) ? `<a class="link" href="https://wa.me/${WHATSAPP}?text=${encodeURIComponent("Olá! Tenho dúvida sobre o tamanho do produto: " + p.name)}" target="_blank" rel="noopener" style="font-size:13px">Dúvida no tamanho?</a>` : ""}</div>
        <div class="opt__list">${p.sizes.map(s => `<button data-size="${esc(s)}" class="${sel.size === s ? "is-active" : ""}">${esc(s)}</button>`).join("")}</div><div class="opt__err">Escolha um tamanho</div></div>` : "";
    const kit = hasKit(p);
    const modes = kit ? `<div class="modes" role="radiogroup" aria-label="Como você quer comprar">
        <button class="mode is-active" data-mode="single" role="radio" aria-checked="true"><b>1 unidade</b><span>${money(p.price)}</span><small>Escolha cor e tamanho</small></button>
        <button class="mode" data-mode="kit" role="radio" aria-checked="false"><em>Economize ${money(p.price * KIT_UNITS - KIT_PRICE)}</em><b>Kit com ${KIT_UNITS} unidades</b><span>${money(KIT_PRICE)}</span><small>${money(KIT_PRICE / KIT_UNITS)} cada · cor e nº à sua escolha</small></button>
      </div>` : "";
    const kitOpts = kit ? `<div class="kit-units" id="kitOpts" hidden>
        <div class="opt__label"><span>Monte seu kit: escolha <b>cor${p.sizes.length ? " e tamanho" : ""}</b> de cada unidade</span></div>
        ${sel.units.map((u, n) => `<div class="kit-unit" data-unit-row="${n}">
          <span class="kit-unit__n">${n + 1}</span>
          <select class="kselect" data-unit="${n}" data-ufield="color" aria-label="Cor da unidade ${n + 1}"><option value="">Cor</option>${p.colors.map(cl => `<option ${u.color === cl ? "selected" : ""}>${esc(cl)}</option>`).join("")}</select>
          ${p.sizes.length ? `<select class="kselect" data-unit="${n}" data-ufield="size" aria-label="Tamanho da unidade ${n + 1}"><option value="">Tamanho</option>${p.sizes.map(sz => `<option ${u.size === sz ? "selected" : ""}>${esc(sz)}</option>`).join("")}</select>` : ""}
        </div>`).join("")}
        <div class="opt__err" id="kitErr">Escolha cor${p.sizes.length ? " e tamanho" : ""} das ${KIT_UNITS} unidades</div>
      </div>` : "";
    const colorOpts = p.colors.length ? `<div class="opt" id="optColor"><div class="opt__label"><span>Cor: <b id="selColor">${esc(sel.color || "selecione")}</b></span></div>
        <div class="opt__list">${p.colors.map(cl => `<button data-color="${esc(cl)}" class="${sel.color === cl ? "is-active" : ""}"><i class="dot" style="background:${colorHex(cl)}"></i>${esc(cl)}</button>`).join("")}</div><div class="opt__err">Escolha uma cor</div></div>` : "";

    return `
    <div class="container">
      <nav class="crumbs"><a href="#/">Início</a> <span><a href="#/c/${c.slug}">${esc(c.name)}</a></span> <span><a href="#/c/${c.slug}/${p.sub}">${esc(subName(p.cat, p.sub))}</a></span></nav>
      <div class="pdp">
        <div class="gallery">
          <div class="gallery__thumbs">${p.imgs.map((im, i) => `<button data-img="${i}" class="${i ? "" : "is-active"}" aria-label="Foto ${i + 1}">${img(im.s, "")}</button>`).join("")}</div>
          <div class="gallery__main" id="gMain">
            ${p.imgs[0] ? `<img id="gImg" src="${esc(p.imgs[0].l)}" alt="${esc(p.name)}" referrerpolicy="no-referrer">` : ""}
            ${p.imgs.length > 1 ? `<button class="gallery__nav gallery__nav--prev" data-gnav="-1" aria-label="Foto anterior">${chevL}</button><button class="gallery__nav gallery__nav--next" data-gnav="1" aria-label="Próxima foto">${chevR}</button>` : ""}
          </div>
        </div>
        <div class="pinfo">
          <a class="pinfo__brand" href="#/marca/${slugify(p.brand)}">${esc(p.brand)}</a>
          <h1>${esc(p.name)}</h1>
          <div class="pinfo__meta">
            ${rk && rk <= 20 ? `<span class="tag tag--best">#${rk} mais vendido</span>` : ""}
            ${p.comfort ? `<span class="tag tag--comfort">Linha conforto</span>` : ""}
            ${p.sku ? `<span>Ref.: ${esc(p.sku)}</span>` : ""}
          </div>
          ${p.inStock ? `<div id="pPrice">${priceHtml(p)}</div>` : `<div class="price"><b style="color:var(--muted)">Produto esgotado</b></div>`}
          ${modes}
          <div id="singleOpts">${colorOpts}${sizeOpts}</div>
          ${kitOpts}
          ${p.inStock ? `
          <div class="buy">
            <div class="qty"><button data-qty="-1" aria-label="Diminuir">−</button><span id="qtyVal">1</span><button data-qty="1" aria-label="Aumentar">+</button></div>
            <button class="btn btn--primary" id="addCart">Adicionar à sacola</button>
          </div>` : `
          <div class="buy"><a class="btn btn--wa" style="grid-column:1/-1" target="_blank" rel="noopener" href="https://wa.me/${WHATSAPP}?text=${encodeURIComponent("Olá! Quero ser avisada quando chegar: " + p.name)}">Avise-me quando chegar (WhatsApp)</a></div>`}
          <div class="pinfo__note"><span>💬</span><span>Ficou em dúvida sobre numeração, cor ou disponibilidade? Fale com a gente no WhatsApp — respondemos rapidinho.</span></div>
          <div class="acc">
            ${p.short ? `<details open><summary>Sobre o produto</summary><div class="acc__body">${esc(p.short)}</div></details>` : ""}
            ${p.desc && p.desc !== p.short ? `<details ${p.short ? "" : "open"}><summary>Descrição completa</summary><div class="acc__body">${esc(p.desc)}</div></details>` : ""}
            <details><summary>Cores e tamanhos disponíveis</summary><div class="acc__body">${p.colors.length ? "Cores: " + esc(p.colors.join(", ")) : ""}${p.sizes.length ? "\nTamanhos: " + esc(p.sizes.join(", ")) : ""}</div></details>
          </div>
        </div>
      </div>
    </div>
    ${related.length ? `<section class="section section--cream"><div class="container">${head("Você também vai gostar", "Produtos relacionados", "", [`#/c/${p.cat}/${p.sub}`, "Ver mais"])}${rail(related)}</div></section>` : ""}
    <section class="section"><div class="container">${head("Ranking da loja", "Mais vendidos", "", ["#/colecao/mais-vendidos", "Ver todos"])}${rail(alsoBest)}</div></section>`;
  }

  function viewNotFound() {
    return `<div class="container"><div class="empty" style="padding:100px 20px"><b>Página não encontrada</b>O produto pode ter saído do catálogo.<br><br><a class="btn btn--primary" href="#/">Voltar para a loja</a></div></div>`;
  }

  // ---------- after render ----------
  let heroTimer;
  function afterRender(parts) {
    clearInterval(heroTimer);
    const hero = $("#hero");
    if (hero) {
      let i = 0; const n = BANNERS.length; const track = $(".hero__track", hero);
      const go = k => { i = (k + n) % n; track.style.transform = `translateX(-${i * 100}%)`; $$(".hero__dots button", hero).forEach((d, j) => d.classList.toggle("is-active", i === j)); };
      go(0);
      const auto = () => { clearInterval(heroTimer); heroTimer = setInterval(() => go(i + 1), 5500); };
      auto();
      hero.addEventListener("click", e => {
        const b = e.target.closest("[data-hero],[data-dot]"); if (!b) return;
        e.preventDefault(); go(b.dataset.dot != null ? +b.dataset.dot : i + +b.dataset.hero); auto();
      });
      let sx = null;
      hero.addEventListener("touchstart", e => { sx = e.touches[0].clientX; }, { passive: true });
      hero.addEventListener("touchend", e => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 40) { go(i + (dx < 0 ? 1 : -1)); auto(); } sx = null; });
    }
    $$(".rail").forEach(updateRail);
    $$(".rail__track").forEach(t => t.addEventListener("scroll", () => updateRail(t.parentElement), { passive: true }));
  }
  function updateRail(r) {
    const t = $(".rail__track", r);
    $(".rail__btn--prev", r).disabled = t.scrollLeft < 8;
    $(".rail__btn--next", r).disabled = t.scrollLeft + t.clientWidth >= t.scrollWidth - 8;
  }

  // ---------- nav / menus ----------
  function buildNav() {
    const featured = slug => ALL.filter(p => p.cat === slug && p.inStock).sort((a, b) => a.rank - b.rank).slice(0, 3);
    const brandsIn = slug => { const m = new Map(); ALL.filter(p => p.cat === slug).forEach(p => m.set(p.brand, (m.get(p.brand) || 0) + 1)); return [...m].sort((a, b) => b[1] - a[1]).slice(0, 10); };
    const SHORT = { chinelos: "Chinelos", sapatilhas: "Sapatilhas", sapatos: "Sapatos", bolsas: "Bolsas" };
    const items = CATS.map(c => `<li class="nav__item"><a class="nav__link" data-nav="c/${c.slug}" href="#/c/${c.slug}">${esc(SHORT[c.slug] || c.name)}</a>
      <div class="mega"><div class="mega__inner">
        <div class="mega__links"><h4>${esc(c.name)}</h4>${c.subs.map(s => `<a href="#/c/${c.slug}/${s.slug}">${esc(s.name)}<small>${s.count}</small></a>`).join("")}<a class="mega__all" href="#/c/${c.slug}">Ver tudo em ${esc(c.name)} →</a></div>
        <div><h4>Marcas</h4><div class="mega__brands">${brandsIn(c.slug).map(([b]) => `<a href="#/c/${c.slug}?marca=${slugify(b)}">${esc(b)}</a>`).join("")}</div></div>
        <div><h4>Mais vendidos</h4><div class="mega__feat">${featured(c.slug).map(p => `<a href="#/p/${p.slug}">${img(p.imgs[0]?.s, p.name)}<span>${esc(p.name)}</span><b>${money(p.price)}</b></a>`).join("")}</div></div>
      </div></div></li>`).join("");
    $("#nav").innerHTML = `<ul class="nav__list">
      <li class="nav__item"><a class="nav__link nav__link--hot" data-nav="colecao/mais-vendidos" href="#/colecao/mais-vendidos">Mais Vendidos</a></li>
      <li class="nav__item"><a class="nav__link nav__link--kit" data-nav="colecao/kits" href="#/colecao/kits">Kit 3 por 99</a></li>
      ${items}
      <li class="nav__item"><span class="nav__link" tabindex="0" style="cursor:default">Marcas</span>
        <div class="mega mega--brands"><div class="mega__inner"><div><h4>Todas as marcas</h4><div class="brand-grid">${BRANDS.map(b => `<a href="#/marca/${b.slug}">${esc(b.name)}<small>${b.count} produtos</small></a>`).join("")}</div></div></div></div></li>
      <li class="nav__item"><a class="nav__link" data-nav="colecao/ofertas" href="#/colecao/ofertas">Ofertas</a></li>
    </ul>`;

    $("#mobileMenu").innerHTML = `
      <div class="mm-section"><a class="mm-hot" href="#/colecao/mais-vendidos">★ Mais Vendidos</a></div>
      <div class="mm-section"><a class="mm-hot" href="#/colecao/kits">Kit 3 por ${money(KIT_PRICE)}</a></div>
      <div class="mm-section"><a href="#/colecao/novidades">Novidades</a></div>
      ${CATS.map(c => `<div class="mm-section"><button>${esc(c.name)}</button><div class="mm-sub"><a href="#/c/${c.slug}"><b>Ver tudo</b><small>${c.count}</small></a>${c.subs.map(s => `<a href="#/c/${c.slug}/${s.slug}">${esc(s.name)}<small>${s.count}</small></a>`).join("")}</div></div>`).join("")}
      <div class="mm-section"><button>Marcas</button><div class="mm-sub">${BRANDS.map(b => `<a href="#/marca/${b.slug}">${esc(b.name)}<small>${b.count}</small></a>`).join("")}</div></div>
      <div class="mm-section"><a href="#/colecao/conforto">Linha Conforto</a></div>
      <div class="mm-section"><a href="#/colecao/ofertas">Ofertas</a></div>
      <div class="mm-section"><a href="#/colecao/favoritos">Meus favoritos</a></div>
      <div style="margin-top:20px;display:grid;gap:10px">
        <a class="btn btn--wa btn--block" href="https://wa.me/${WHATSAPP}" target="_blank" rel="noopener">Falar no WhatsApp</a>
        <a class="btn btn--outline btn--block" href="${INSTAGRAM}" target="_blank" rel="noopener">Instagram @samisapatilhasecia</a>
      </div>`;

    $("#footerCols").innerHTML = `
      <div><span class="logo"><span class="logo__script">Vitrine</span><span class="logo__sub">Feminina</span></span>
        <p class="footer__about">Calçados femininos, bolsas e acessórios das marcas que você ama, com atendimento próximo e carinhoso.</p></div>
      <div><h5>Calçados</h5>${["sandalias", "chinelos", "tenis", "sapatilhas", "sapatos", "botas"].map(s => `<a href="#/c/${s}">${esc(CAT.get(s).name)}</a>`).join("")}</div>
      <div><h5>Bolsas & mais</h5>${CAT.get("bolsas").subs.map(s => `<a href="#/c/bolsas/${s.slug}">${esc(s.name)}</a>`).join("")}<a href="#/c/infantil">Infantil</a></div>
      <div><h5>Coleções</h5><a href="#/colecao/mais-vendidos">Mais vendidos</a><a href="#/colecao/kits">Kit 3 por R$ 99</a><a href="#/colecao/novidades">Novidades</a><a href="#/colecao/conforto">Linha conforto</a><a href="#/colecao/couro">Couro legítimo</a><a href="#/colecao/ofertas">Ofertas</a></div>
      <div><h5>Atendimento</h5><a href="https://wa.me/${WHATSAPP}" target="_blank" rel="noopener">WhatsApp (13) 99771-2047</a><a href="${INSTAGRAM}" target="_blank" rel="noopener">Instagram</a><a href="#/colecao/favoritos">Meus favoritos</a></div>`;
    $("#year").textContent = new Date().getFullYear();
    $("#waFloat").href = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent("Olá! Vim pelo site da Vitrine Feminina 💕")}`;
  }

  function markNav(parts) {
    const cur = parts.slice(0, 2).join("/");
    $$(".nav__link").forEach(a => a.classList.toggle("is-current", !!cur && a.dataset.nav === cur));
  }

  // ---------- drawers ----------
  function openDrawer(id) {
    closeAll();
    $(id).classList.add("is-open"); $(id).setAttribute("aria-hidden", "false");
    $("#overlay").classList.add("is-open"); document.body.classList.add("lock");
  }
  function closeAll() {
    $$(".drawer.is-open").forEach(d => { d.classList.remove("is-open"); d.setAttribute("aria-hidden", "true"); });
    $("#overlay").classList.remove("is-open"); document.body.classList.remove("lock");
  }

  // ---------- favorites ----------
  function toggleFav(id) {
    favs.has(id) ? favs.delete(id) : favs.add(id);
    store.set("sami_favs", [...favs]);
    $$(`[data-fav="${id}"]`).forEach(b => b.classList.toggle("is-on", favs.has(id)));
    updateBadges();
    toast(favs.has(id) ? "Adicionado aos favoritos ♥" : "Removido dos favoritos");
  }

  // ---------- cart ----------
  const cartKey = i => (i.kit ? `${i.id}|kit|${JSON.stringify(i.units)}` : `${i.id}|${i.color || ""}|${i.size || ""}`);
  const unitsText = (i, sep) => i.units.map((u, n) => `${n + 1}) ${[u.color, u.size && "Tam " + u.size].filter(Boolean).join(" · ")}`).join(sep);
  function addToCart(item) {
    const k = cartKey(item);
    const ex = cart.find(i => cartKey(i) === k);
    ex ? (ex.qty += item.qty) : cart.push(item);
    saveCart();
  }
  function saveCart() { store.set("sami_cart", cart); renderCart(); updateBadges(); }
  function totals() {
    const sub = cart.reduce((s, i) => s + unitPrice(i) * i.qty, 0);
    const disc = coupon && COUPONS[coupon] ? sub * COUPONS[coupon] : 0;
    return { sub, disc, total: sub - disc };
  }
  function renderCart() {
    cart = cart.filter(i => BY_ID.has(i.id));
    const body = $("#cartBody"), foot = $("#cartFoot");
    if (!cart.length) {
      body.innerHTML = `<div class="cart-empty"><svg viewBox="0 0 24 24"><path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg><b style="display:block;color:var(--ink);font-size:17px">Sua sacola está vazia</b><p>Que tal dar uma olhada nos mais vendidos?</p><a class="btn btn--primary" href="#/colecao/mais-vendidos">Ver mais vendidos</a></div>`;
      foot.innerHTML = ""; return;
    }
    body.innerHTML = cart.map((i, idx) => { const p = BY_ID.get(i.id); return `<div class="cart-item">
        <a href="#/p/${p.slug}">${img(p.imgs[0]?.s, p.name)}</a>
        <div>${i.kit ? `<span class="tag tag--kit" style="display:inline-block;margin-bottom:4px">Kit ${KIT_UNITS} unidades</span>` : ""}<a class="cart-item__name" href="#/p/${p.slug}">${esc(p.name)}</a>
          <div class="cart-item__opts">${i.kit ? esc(unitsText(i, "\n")).replace(/\n/g, "<br>") : [i.color && "Cor: " + esc(i.color), i.size && "Tam: " + esc(i.size)].filter(Boolean).join(" · ")}</div>
          <div class="cart-item__row"><div class="qty"><button data-cq="${idx}" data-d="-1" aria-label="Diminuir">−</button><span>${i.qty}</span><button data-cq="${idx}" data-d="1" aria-label="Aumentar">+</button></div><b>${money(unitPrice(i) * i.qty)}</b></div>
          <button class="cart-item__rm" data-rm="${idx}">Remover</button></div></div>`; }).join("");
    const t = totals();
    foot.innerHTML = `
      <form class="cart-coupon" id="couponForm"><input name="c" placeholder="Cupom de desconto" value="${esc(coupon || "")}" aria-label="Cupom"><button>${coupon ? "Trocar" : "Aplicar"}</button></form>
      ${coupon ? `<div class="cart-ok">Cupom ${esc(coupon)} aplicado ✓ <button class="link" data-uncoupon style="font-size:12px">remover</button></div>` : ""}
      <div class="cart-sum"><span>Subtotal</span><span>${money(t.sub)}</span></div>
      ${t.disc ? `<div class="cart-sum" style="color:var(--green)"><span>Desconto</span><span>− ${money(t.disc)}</span></div>` : ""}
      <div class="cart-sum cart-sum--total"><span>Total</span><span>${money(t.total)}</span></div>
      <button class="btn btn--wa btn--block" id="checkout" style="margin-top:12px">Finalizar pedido pelo WhatsApp</button>
      <p class="cart-foot__hint">O frete é calculado no atendimento, conforme seu CEP.</p>`;
  }
  function checkoutMsg(items) {
    const t = items === cart ? totals() : null;
    const lines = items.map(i => {
      const p = BY_ID.get(i.id);
      if (i.kit) return `• ${i.qty}x KIT ${KIT_UNITS} UNIDADES — ${p.name} — ${money(unitPrice(i) * i.qty)}\n   ${unitsText(i, "\n   ")}`;
      return `• ${i.qty}x ${p.name}${i.color ? ` | Cor: ${i.color}` : ""}${i.size ? ` | Tam: ${i.size}` : ""} — ${money(p.price * i.qty)}`;
    });
    let msg = `Olá, Vitrine Feminina! 💕 Quero fazer este pedido pelo site:\n\n${lines.join("\n")}\n`;
    if (t) {
      msg += `\nSubtotal: ${money(t.sub)}`;
      if (t.disc) msg += `\nCupom ${coupon}: −${money(t.disc)}`;
      msg += `\n*Total: ${money(t.total)}*`;
    }
    msg += `\n\nMeu CEP para o frete: `;
    return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`;
  }

  function updateBadges() {
    const n = cart.reduce((s, i) => s + i.qty, 0);
    const c = $("#cartCount"); c.textContent = n; c.hidden = !n;
    const f = $("#favCount"); f.textContent = favs.size; f.hidden = !favs.size;
  }

  let toastT;
  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.classList.add("is-show");
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("is-show"), 2200);
  }

  // ---------- search ----------
  let sIdx = -1;
  function searchResults(q) {
    const terms = norm(q).split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    return ALL.filter(p => terms.every(t => p.search.includes(t))).sort((a, b) => b.inStock - a.inStock || a.rank - b.rank);
  }
  function showSearch() {
    const q = $("#searchInput").value.trim(); const box = $("#searchResults");
    if (q.length < 2) { box.hidden = true; return; }
    const r = searchResults(q); sIdx = -1;
    box.innerHTML = r.length
      ? r.slice(0, 6).map(p => `<a class="search__item" href="#/p/${p.slug}">${img(p.imgs[0]?.s, "")}<div><b>${esc(p.name)}</b><small>${esc(p.brand)} · ${p.inStock ? money(p.price) : "Esgotado"}</small></div></a>`).join("") + `<a class="search__all" href="#/busca?q=${encodeURIComponent(q)}">Ver todos os ${r.length} resultados</a>`
      : `<div class="search__empty">Nenhum produto para “${esc(q)}”</div>`;
    box.hidden = false;
  }
  function hideSearch() { const b = $("#searchResults"); if (b) b.hidden = true; $("#searchForm")?.classList.remove("is-open"); }

  // ---------- events ----------
  document.addEventListener("click", e => {
    const t = e.target;
    const fav = t.closest("[data-fav]"); if (fav) { e.preventDefault(); toggleFav(+fav.dataset.fav); return; }
    const rb = t.closest("[data-rail]"); if (rb) { const tr = $(".rail__track", rb.parentElement); tr.scrollBy({ left: tr.clientWidth * 0.9 * +rb.dataset.rail, behavior: "smooth" }); return; }
    const tab = t.closest("[data-tab]"); if (tab) { $$("#homeTabs button").forEach(b => b.classList.toggle("is-active", b === tab)); $("#tabPanel").innerHTML = tabPanel(tab.dataset.tab); return; }
    const cp = t.closest("[data-copy]"); if (cp) { navigator.clipboard?.writeText(cp.dataset.copy).catch(() => {}); coupon = cp.dataset.copy; store.set("sami_coupon", coupon); renderCart(); toast("Cupom copiado e aplicado na sacola!"); return; }
    if (t.closest("[data-close]") || t === $("#overlay")) { closeAll(); return; }
    if (t.closest("#menuBtn")) { openDrawer("#menuDrawer"); return; }
    if (t.closest("#cartBtn")) { renderCart(); openDrawer("#cartDrawer"); return; }
    if (t.closest("#openFilters")) { openDrawer("#filterDrawer"); return; }
    if (t.closest("#searchToggle")) { const f = $("#searchForm"); f.classList.toggle("is-open"); if (f.classList.contains("is-open")) $("#searchInput").focus(); return; }
    const mm = t.closest(".mm-section > button"); if (mm) { mm.parentElement.classList.toggle("is-open"); return; }
    if (t.closest("#mobileMenu a")) { closeAll(); }

    // filters
    const tg = t.closest("button[data-toggle]"); if (tg) { toggleFilter(tg.dataset.toggle, tg.dataset.v); return; }
    if (t.closest("[data-disp-off]")) { setQuery({ disp: "" }); return; }
    if (t.closest("[data-clear]")) { setQuery({ cat: "", marca: "", tam: "", cor: "", preco: "", disp: "" }); return; }
    const more = t.closest("[data-more]"); if (more) { $$("[data-extra]", more.parentElement).forEach(x => x.hidden = false); more.remove(); return; }
    if (t.closest("#loadMore")) { listLimit += PAGE; const y = scrollY; render(false, true); scrollTo(0, y); return; }

    // pdp
    const th = t.closest("[data-img]"); if (th) { setImg(+th.dataset.img); return; }
    const gn = t.closest("[data-gnav]"); if (gn) { e.stopPropagation(); const n = BY_ID.get(sel.id).imgs.length; setImg((sel.img + +gn.dataset.gnav + n) % n); return; }
    if (t.closest("#gMain")) { $("#gMain").classList.toggle("zoom"); return; }
    const cb = t.closest("[data-color]"); if (cb) { sel.color = cb.dataset.color; $$("[data-color]").forEach(b => b.classList.toggle("is-active", b === cb)); $("#selColor").textContent = sel.color; $("#optColor").classList.remove("is-error"); return; }
    const sb = t.closest("[data-size]"); if (sb) { sel.size = sb.dataset.size; $$("[data-size]").forEach(b => b.classList.toggle("is-active", b === sb)); $("#selSize").textContent = sel.size; $("#optSize").classList.remove("is-error"); return; }
    const mb = t.closest("[data-mode]"); if (mb) { setMode(mb.dataset.mode); return; }
    const qb = t.closest("[data-qty]"); if (qb) { sel.qty = Math.max(1, Math.min(10, sel.qty + +qb.dataset.qty)); $("#qtyVal").textContent = sel.qty; return; }
    if (t.closest("#addCart")) {
      if (!validateSel()) return;
      const item = sel.mode === "kit"
        ? { id: sel.id, kit: true, units: sel.units.map(u => ({ ...u })), qty: sel.qty }
        : { id: sel.id, color: sel.color, size: sel.size, qty: sel.qty };
      addToCart(item); renderCart(); openDrawer("#cartDrawer"); toast(item.kit ? "Kit adicionado à sacola" : "Produto adicionado à sacola"); return;
    }

    // cart
    const cq = t.closest("[data-cq]"); if (cq) { const i = cart[+cq.dataset.cq]; i.qty += +cq.dataset.d; if (i.qty < 1) cart.splice(+cq.dataset.cq, 1); saveCart(); return; }
    const rm = t.closest("[data-rm]"); if (rm) { cart.splice(+rm.dataset.rm, 1); saveCart(); return; }
    if (t.closest("[data-uncoupon]")) { coupon = null; store.set("sami_coupon", null); renderCart(); return; }
    if (t.closest("#checkout")) { window.open(checkoutMsg(cart), "_blank", "noopener"); return; }

    if (!t.closest("#searchForm")) hideSearch();
  });

  document.addEventListener("change", e => {
    const t = e.target;
    if (t.matches("input[data-toggle]")) toggleFilter(t.dataset.toggle, t.dataset.v);
    else if (t.matches("[data-disp]")) setQuery({ disp: t.checked ? "1" : "" });
    else if (t.id === "sortSel") setQuery({ ordem: t.value });
    else if (t.matches("[data-ufield]")) {
      sel.units[+t.dataset.unit][t.dataset.ufield] = t.value || null;
      const row = t.closest(".kit-unit"); const u = sel.units[+t.dataset.unit];
      if (u.color && (u.size || !BY_ID.get(sel.id).sizes.length)) row.classList.remove("is-error");
      if (!$$(".kit-unit.is-error").length) $("#kitOpts").classList.remove("is-error");
    }
  });

  document.addEventListener("submit", e => {
    if (e.target.id === "couponForm") {
      e.preventDefault();
      const v = e.target.c.value.trim().toUpperCase();
      if (COUPONS[v]) { coupon = v; store.set("sami_coupon", v); toast("Cupom aplicado!"); }
      else toast("Cupom inválido");
      renderCart();
    } else if (e.target.id === "searchForm") {
      e.preventDefault();
      const q = $("#searchInput").value.trim();
      const active = $$(".search__item")[sIdx];
      if (active) location.hash = active.getAttribute("href");
      else if (q) location.hash = `#/busca?q=${encodeURIComponent(q)}`;
      $("#searchInput").blur();
    }
  });

  $("#searchInput").addEventListener("input", showSearch);
  $("#searchInput").addEventListener("focus", showSearch);
  $("#searchInput").addEventListener("keydown", e => {
    const items = $$(".search__item"); if (!items.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      sIdx = (sIdx + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items.forEach((it, i) => it.classList.toggle("is-active", i === sIdx));
    } else if (e.key === "Escape") hideSearch();
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeAll(); });

  function toggleFilter(key, v) {
    const cur = list(parseHash().q[key]);
    const next = cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v];
    setQuery({ [key]: next.join(",") });
  }
  function setImg(i) {
    const p = BY_ID.get(sel.id); sel.img = i;
    $("#gImg").src = p.imgs[i].l;
    $("#gMain").classList.remove("zoom");
    $$("[data-img]").forEach((b, j) => b.classList.toggle("is-active", j === i));
  }
  function setMode(mode) {
    const p = BY_ID.get(sel.id); sel.mode = mode;
    $$("[data-mode]").forEach(b => { const on = b.dataset.mode === mode; b.classList.toggle("is-active", on); b.setAttribute("aria-checked", on); });
    $("#singleOpts").hidden = mode === "kit";
    $("#kitOpts").hidden = mode !== "kit";
    $("#pPrice").innerHTML = mode === "kit"
      ? `<div class="price"><b>${money(KIT_PRICE)}</b><s>${money(p.price * KIT_UNITS)}</s><small>Kit com ${KIT_UNITS} unidades · ${money(KIT_PRICE / KIT_UNITS)} cada</small></div>`
      : priceHtml(p);
  }
  function validateSel() {
    const p = BY_ID.get(sel.id); let ok = true;
    if (sel.mode === "kit") {
      sel.units.forEach((u, n) => {
        const bad = !u.color || (p.sizes.length && !u.size);
        $(`[data-unit-row="${n}"]`).classList.toggle("is-error", !!bad);
        if (bad) ok = false;
      });
      $("#kitOpts").classList.toggle("is-error", !ok);
      if (!ok) { $("#kitOpts").scrollIntoView({ behavior: "smooth", block: "center" }); toast("Escolha cor e tamanho das 3 unidades"); }
      return ok;
    }
    if (p.colors.length && !sel.color) { $("#optColor").classList.add("is-error"); ok = false; }
    if (p.sizes.length && !sel.size) { $("#optSize").classList.add("is-error"); ok = false; }
    if (!ok) { ($(".opt.is-error") || {}).scrollIntoView?.({ behavior: "smooth", block: "center" }); toast("Escolha cor e tamanho"); }
    return ok;
  }

  // ---------- boot ----------
  // duplicate topbar content for mobile marquee
  const tb = $(".topbar__track"); tb.innerHTML += tb.innerHTML;
  buildNav();
  renderCart();
  updateBadges();
  window.addEventListener("hashchange", () => render(true));
  render(false);
})();
