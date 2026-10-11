import json, re, html, sys, unicodedata

DL, OUT = sys.argv[1], sys.argv[2]

raw = []
for i in (1, 2, 3):
    raw += json.load(open(f"{DL}/p{i}.json", encoding="utf-8"))
pop = []
for i in (1, 2, 3):
    pop += [x["id"] for x in json.load(open(f"{DL}/pop{i}.json"))]
rank = {pid: i + 1 for i, pid in enumerate(pop)}


def strip_acc(s):
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn").lower()


def slugify(s):
    return re.sub(r"[^a-z0-9]+", "-", strip_acc(s)).strip("-")


FIXES = [
    (r"https?://\S+", ""),
    (r"\bTêns\b", "Tênis"), (r"\bSandáia\b", "Sandália"), (r"\bRasteria\b", "Rasteira"),
    (r"\bFemina\b", "Feminina"), (r"\bConoforto\b", "Conforto"), (r"\bPapate\b", "Papete"),
    (r"calce Facial", "Calce Fácil"), (r"\bRasterinha\b", "Rasteirinha"), (r"\bSlid\b", "Slide"),
    (r"\bAnabella\b", "Anabela"), (r"\bSandalia\b", "Sandália"), (r"\bTenis\b", "Tênis"),
    (r"\bBeira Conforto\b", "Beira Rio Conforto"), (r"\bRe\.4323", "Ref.4323"),
    (r"Ref\.(\d{4}\.\d+)(Elegância e Conforto)", r"Ref.\1"), (r"estile casual", "estilo casual"),
    (r"CALCADO CROCS CROCBAND INFANTIL", "Calçado Crocs Crocband Infantil"),
    (r"Feminino Beira Rio Feminino", "Feminino Beira Rio"), (r"\s+", " "),
]


def clean_name(n):
    n = html.unescape(n)
    for a, b in FIXES:
        n = re.sub(a, b, n)
    return n.strip(" –-")


def plain(h, limit=None):
    h = html.unescape(h or "")
    h = re.sub(r"<\s*(br|/p|/li|/h\d)\s*/?>", "\n", h, flags=re.I)
    h = re.sub(r"<li[^>]*>", "• ", h, flags=re.I)
    h = re.sub(r"<[^>]+>", "", h)
    h = re.sub(r"[ \t\xa0]+", " ", h)
    h = re.sub(r"\n\s*\n+", "\n", h).strip()
    if limit and len(h) > limit:
        h = h[:limit].rsplit(" ", 1)[0] + "…"
    return h


BRANDS = [
    ("Petite Jolie", r"petite jolie|\bpj\d"), ("Beira Rio", r"beira rio|beira conforto|\bbeira\b"),
    ("Modare", r"modare"), ("Molekinha", r"molekinh"), ("Moleca", r"moleca"),
    ("Vizzano", r"vizzano"), ("Via Uno", r"via uno"), ("Dakota", r"dakota"),
    ("Havaianas", r"havaianas"), ("Crocs", r"crocs"), ("Mississipi", r"mississipi"),
    ("Ramarim", r"ramarim"), ("Olympikus", r"olympikus"), ("Actvitta", r"actvitta"),
    ("Ortopasso", r"ortopasso"), ("Ana Capri", r"ana capri"), ("Mormaii", r"mormaii"),
]


def brand_of(n):
    s = strip_acc(n)
    for b, rx in BRANDS:
        if re.search(rx, s):
            return b
    # sapatos/sandalias com "Ref.8xxx/4xxx/9xxx" sem marca sao linha Beira Rio
    if re.search(r"ref\.? ?(8|4|9)\d{3}\.|ref\.80\d{3}", s):
        return "Beira Rio"
    if re.search(r"ref\.? ?7\d{3}\.", s):
        return "Modare"
    if re.search(r"ref\.? ?6\d{3}\.", s):
        return "Vizzano"
    if "couro" in s or "classe" in s:
        return "Couro Legítimo"
    return "Sami"


# ---- nova arvore de categorias ----
TREE = [
    ("sandalias", "Sandálias", [
        ("rasteirinhas", "Rasteirinhas"), ("salto", "Salto Bloco & Fino"), ("anabela", "Anabela"),
        ("plataforma", "Plataforma & Flatform"), ("papetes", "Papetes"), ("tamancos", "Tamancos"),
    ]),
    ("chinelos", "Chinelos & Slides", [
        ("chinelos", "Chinelos"), ("slides", "Slides & Nuvem"), ("crocs", "Crocs & Clogs"),
    ]),
    ("tenis", "Tênis", [
        ("casual", "Casual"), ("esportivo", "Esportivo & Corrida"), ("ortopedico", "Ortopédico & Conforto"),
    ]),
    ("sapatilhas", "Sapatilhas & Mules", [
        ("sapatilhas", "Sapatilhas"), ("mules", "Mules & Clogs"), ("alpargatas", "Alpargatas & Slip On"),
    ]),
    ("sapatos", "Scarpins & Mocassins", [
        ("scarpins", "Scarpins"), ("mocassins", "Mocassins"), ("peep-toe", "Peep Toe"),
    ]),
    ("botas", "Botas", [
        ("cano-curto", "Cano Curto"), ("coturnos", "Coturnos"), ("cano-alto", "Cano Alto"),
    ]),
    ("bolsas", "Bolsas & Acessórios", [
        ("couro", "Bolsas de Couro Legítimo"), ("bolsas", "Bolsas"), ("transversais", "Transversais & Crossbody"),
        ("carteiras", "Carteiras & Acessórios"), ("mochilas-malas", "Mochilas & Malas"),
        ("meias", "Meias"),
    ]),
    ("infantil", "Infantil", [
        ("tenis", "Tênis Infantil"), ("chinelos", "Chinelos & Sandálias"), ("meias", "Meias Infantis"),
    ]),
]


def classify(n):
    s = strip_acc(n)
    has = lambda *ks: any(re.search(k, s) for k in ks)
    if has(r"infantil", r"\bkids\b", r"molekinh", r"ortopasso", r"menin"):
        if has(r"\bmeia"):
            return "infantil", "meias"
        if has(r"tenis"):
            return "infantil", "tenis"
        return "infantil", "chinelos"
    if has(r"\bmeia"):
        return "bolsas", "meias"
    if has(r"\bbolsa", r"carteira", r"mochila", r"\bmala\b", r"lenco"):
        if has(r"carteira", r"lenco", r"phone case"):
            return "bolsas", "carteiras"
        if has(r"mochila", r"\bmala\b"):
            return "bolsas", "mochilas-malas"
        if has(r"couro", r"classe"):
            return "bolsas", "couro"
        if has(r"transversal", r"crossbody", r"tira colo"):
            return "bolsas", "transversais"
        return "bolsas", "bolsas"
    if has(r"\bbota\b"):
        if has(r"coturno"):
            return "botas", "coturnos"
        if has(r"cano alto", r"montaria"):
            return "botas", "cano-alto"
        return "botas", "cano-curto"
    if has(r"scarpin"):
        return "sapatos", "scarpins"
    if has(r"peep toe"):
        return "sapatos", "peep-toe"
    if has(r"mocassim") and not has(r"sapatilha"):
        return "sapatos", "mocassins"
    if has(r"\bmule\b", r"clog") and not has(r"crocs"):
        return "sapatilhas", "mules"
    if has(r"sapatilha"):
        if has(r"alpargata", r"\bslip\b"):
            return "sapatilhas", "alpargatas"
        return "sapatilhas", "sapatilhas"
    if has(r"alpargata"):
        return "sapatilhas", "alpargatas"
    if has(r"tenis"):
        if has(r"esportiv", r"corrida", r"running", r"olympikus", r"actvitta"):
            return "tenis", "esportivo"
        if has(r"ortopedic", r"ultra ?conforto"):
            return "tenis", "ortopedico"
        return "tenis", "casual"
    if has(r"crocs"):
        return "chinelos", "crocs"
    if has(r"slide", r"nuvem", r"\bhug\b") and not has(r"papete"):
        return "chinelos", "slides"
    if has(r"chinelo") and not has(r"rasteir"):
        return "chinelos", "chinelos"
    # sandalias
    if has(r"anabela"):
        return "sandalias", "anabela"
    if has(r"papete", r"birken"):
        return "sandalias", "papetes"
    if has(r"tamanco"):
        return "sandalias", "tamancos"
    if has(r"plataforma", r"flatform", r"tratorad"):
        return "sandalias", "plataforma"
    if has(r"salto", r"\bbloco\b"):
        return "sandalias", "salto"
    if has(r"rasteir", r"de dedo", r"calce facil", r"veste facil", r"\bflat\b"):
        return "sandalias", "rasteirinhas"
    return "sandalias", "rasteirinhas"


def pick(srcset, size):
    m = re.search(r"(\S+-%s\.\w+) " % size, srcset or "")
    return m.group(1) if m else None


products = []
for p in raw:
    name = clean_name(p["name"])
    pr = p["prices"]
    price = int(pr["price"]) / 100
    reg = int(pr["regular_price"]) / 100
    rng = pr.get("price_range")
    if price == 0 and rng and int(rng["max_amount"]):
        price = reg = int(rng["max_amount"]) / 100
    imgs = []
    for im in p["images"][:10]:
        imgs.append({
            "s": pick(im["srcset"], "449x449") or im["thumbnail"],
            "l": im["thumbnail"] or im["src"],
        })
    colors, sizes = [], []
    for a in p["attributes"]:
        terms = [html.unescape(t["name"]) for t in a["terms"]]
        if a["name"] == "Cor":
            colors = terms
        elif a["name"] == "Tamanho":
            sizes = terms
    try:
        sizes.sort(key=lambda x: float(x.replace(",", ".")))
    except ValueError:
        pass
    cat, sub = classify(name)
    s = strip_acc(name)
    products.append({
        "id": p["id"],
        "slug": p["slug"],
        "name": name,
        "brand": brand_of(name),
        "cat": cat,
        "sub": sub,
        "price": price,
        "regular": reg if reg > price else None,
        "inStock": bool(p["is_in_stock"]) and price > 0,
        "rank": rank.get(p["id"], 999),
        "imgs": imgs,
        "colors": colors,
        "sizes": sizes,
        "comfort": bool(re.search(r"conforto|ortoped|macia|soft", s)),
        "leather": bool(re.search(r"couro", s)),
        "short": plain(p["short_description"], 400),
        "desc": plain(p["description"], 2500),
        "sku": p["sku"],
    })

# coerencia de nome curto para cards
cats = [{"slug": c, "name": n, "subs": [{"slug": s, "name": sn} for s, sn in subs]} for c, n, subs in TREE]
counts = {}
for p in products:
    counts.setdefault(p["cat"], {}).setdefault(p["sub"], 0)
    counts[p["cat"]][p["sub"]] += 1
for c in cats:
    c["subs"] = [s for s in c["subs"] if counts.get(c["slug"], {}).get(s["slug"])]
    for s in c["subs"]:
        s["count"] = counts[c["slug"]][s["slug"]]
    c["count"] = sum(s["count"] for s in c["subs"])

banners = [
    "https://samisapatilhasecia.com.br/wp-content/uploads/2026/06/chatgpt-image-2-de-jun.-de-2026-18-22-2-1500x630.jpg",
    "https://samisapatilhasecia.com.br/wp-content/uploads/2026/06/chatgpt-image-2-de-jun.-de-2026-18-33-3-1500x630.jpg",
    "https://samisapatilhasecia.com.br/wp-content/uploads/2026/06/chatgpt-image-2-de-jun.-de-2026-18-39-2-1500x630.jpg",
    "https://samisapatilhasecia.com.br/wp-content/uploads/2026/06/chatgpt-image-2-de-jun.-de-2026-17-57-5-1500x630.jpg",
    "https://samisapatilhasecia.com.br/wp-content/uploads/2026/06/chatgpt-image-2-de-jun.-de-2026-18-17-5-1500x630.jpg",
]

data = {"categories": cats, "products": products, "banners": banners}
with open(OUT, "w", encoding="utf-8") as f:
    f.write("window.STORE=" + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n")

for c in cats:
    print(c["name"], c["count"], [(s["name"], s["count"]) for s in c["subs"]])
print(len(products), "produtos")
import collections
print(collections.Counter(p["brand"] for p in products).most_common())
