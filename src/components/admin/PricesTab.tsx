import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { brl } from "@/lib/shipping";
import { ORDER_BUMPS } from "@/lib/order-bump";
import { EXPRESS_SHIPPING, INSOLE_OFFER, SHIPPING_INSURANCE } from "@/lib/upsell";
import { DEFAULT_PRICES, priceConfigSchema, type PriceConfig } from "@/lib/prices";
import { getPrices, resetPrices, savePrices } from "@/lib/prices.functions";

/** Campo de dinheiro em texto ("6.490,00"), para digitar como no Brasil. */
type Draft = Record<string, string>;

const fmt = (n: number | null | undefined) =>
  n == null
    ? ""
    : n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "6.490,00" / "6490" / "6490.5" → número (ou null se vazio). */
function parse(v: string): number | null {
  const t = v.trim().replace(/[R$\s]/g, "");
  if (!t) return null;
  const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

function toDraft(p: PriceConfig): Draft {
  return {
    kit: fmt(p.kit),
    tenis: fmt(p.tenis.price),
    tenis2: fmt(p.tenis.kit2),
    tenis3: fmt(p.tenis.kit3),
    bump: fmt(p.bump.price),
    bumpde: fmt(p.bump.compareAt),
    bump2: fmt((p.bump2 ?? DEFAULT_PRICES.bump2)?.price),
    bump2de: fmt((p.bump2 ?? DEFAULT_PRICES.bump2)?.compareAt),
    palmilha: fmt((p.palmilha ?? DEFAULT_PRICES.palmilha)?.price),
    palmilhade: fmt((p.palmilha ?? DEFAULT_PRICES.palmilha)?.compareAt),
    upsellPct: String(p.upsellPct),
    seguro: fmt(p.seguro),
    expresso: fmt(p.expresso),
  };
}

function fromDraft(d: Draft) {
  const n = (k: string) => parse(d[k] ?? "");
  const offer = (a: string, b: string) => ({ price: n(a) ?? NaN, compareAt: n(b) });
  return {
    kit: n("kit") ?? NaN,
    tenis: { price: n("tenis") ?? NaN, kit2: n("tenis2") ?? NaN, kit3: n("tenis3") ?? NaN },
    bump: offer("bump", "bumpde"),
    bump2: offer("bump2", "bump2de"),
    palmilha: offer("palmilha", "palmilhade"),
    upsellPct: Number((d["upsellPct"] ?? "").replace(/\D/g, "")) || NaN,
    seguro: n("seguro") ?? NaN,
    expresso: n("expresso") ?? NaN,
  };
}

/** Aba de preços: kits, promoção dos tênis, oferta do checkout, upsell, seguro e envio expresso. */
export function PricesTab({ password }: { password: string }) {
  const loadFn = useServerFn(getPrices);
  const saveFn = useServerFn(savePrices);
  const resetFn = useServerFn(resetPrices);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saved, setSaved] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = () =>
    loadFn()
      .then((p) => {
        const d = toDraft(p);
        setDraft(d);
        setSaved(d);
      })
      .catch(() => setMsg({ ok: false, text: "Não foi possível carregar os preços." }));

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!draft) return <p className="text-sm text-muted-foreground">Carregando preços…</p>;

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDraft({ ...draft, [k]: e.target.value });
  const check = priceConfigSchema.safeParse(fromDraft(draft));
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  const save = async () => {
    if (!check.success) return;
    setBusy(true);
    setMsg(null);
    try {
      const p = await saveFn({ data: { password, prices: check.data } });
      const d = toDraft(p);
      setDraft(d);
      setSaved(d);
      setMsg({
        ok: true,
        text: "Preços salvos. A loja, o checkout e as cobranças já usam os novos valores.",
      });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Não foi possível salvar." });
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (!confirm("Voltar todos os preços aos valores de fábrica?")) return;
    setBusy(true);
    setMsg(null);
    try {
      const p = await resetFn({ data: { password } });
      const d = toDraft(p);
      setDraft(d);
      setSaved(d);
      setMsg({ ok: true, text: "Preços de fábrica restaurados." });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Não foi possível restaurar." });
    } finally {
      setBusy(false);
    }
  };

  const bump = ORDER_BUMPS[0];
  const bump2 = ORDER_BUMPS[1];
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Preços (ticket)</h2>
        <p className="text-sm text-muted-foreground">
          O valor salvo aqui é o que a loja mostra e o que é cobrado no Pix (SagacePay, PixGate ou
          MagicPay). Pix já gerados continuam com o valor da hora em que foram criados. O preço "de"
          é o valor riscado; deixe vazio para não mostrar desconto.
        </p>
      </div>

      <Card className="p-5">
        <h3 className="mb-1 font-medium">Kits e promoções</h3>
        <p className="mb-4 text-xs text-muted-foreground">
          O preço de cada produto vem do catálogo. Aqui ficam o kit com 3 unidades e a promoção que
          vale para a categoria Tênis inteira (levando 2 ou mais tênis, o frete é grátis).
        </p>
        <div className="space-y-4">
          <Row
            title="Kit com 3 unidades"
            sub="Modelos com mais de uma cor (fora Tênis)"
            price={draft.kit!}
            onPrice={set("kit")}
            fallback={{ price: DEFAULT_PRICES.kit, compareAt: null }}
          />
          <Row
            title="Tênis — 1 unidade"
            sub="Preço de todos os tênis"
            price={draft.tenis!}
            onPrice={set("tenis")}
            fallback={{ price: DEFAULT_PRICES.tenis.price, compareAt: null }}
          />
          <Row
            title="Tênis — 2 unidades"
            sub="Qualquer tênis, cor e numeração à escolha"
            price={draft.tenis2!}
            onPrice={set("tenis2")}
            fallback={{ price: DEFAULT_PRICES.tenis.kit2, compareAt: null }}
          />
          <Row
            title="Tênis — 3 unidades"
            sub="Qualquer tênis, cor e numeração à escolha"
            price={draft.tenis3!}
            onPrice={set("tenis3")}
            fallback={{ price: DEFAULT_PRICES.tenis.kit3, compareAt: null }}
          />
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="mb-4 font-medium">Ofertas</h3>
        <div className="space-y-4">
          {bump && (
            <Row
              title="Oferta do checkout (order bump)"
              sub={bump.fullName}
              price={draft.bump!}
              de={draft.bumpde!}
              onPrice={set("bump")}
              onDe={set("bumpde")}
              fallback={DEFAULT_PRICES.bump}
            />
          )}
          {bump2 && (
            <Row
              title="Oferta do checkout 2 (order bump)"
              sub={bump2.fullName}
              price={draft.bump2!}
              de={draft.bump2de!}
              onPrice={set("bump2")}
              onDe={set("bump2de")}
              fallback={DEFAULT_PRICES.bump2!}
            />
          )}
          <div className="grid gap-3 border-b pb-4 md:grid-cols-[1fr_160px_160px_90px] md:items-end">
            <div>
              <div className="text-sm font-medium">Upsell depois da compra</div>
              <div className="text-xs text-muted-foreground">
                Mais 1 unidade igual ao item principal do pedido · padrão {DEFAULT_PRICES.upsellPct}
                %
              </div>
            </div>
            <label className="text-xs text-muted-foreground">
              Desconto (%)
              <Input
                inputMode="numeric"
                value={draft.upsellPct}
                onChange={set("upsellPct")}
                className="mt-1"
              />
            </label>
          </div>
          <Row
            title={INSOLE_OFFER.fullName}
            sub="Oferecida na tela depois da compra"
            price={draft.palmilha!}
            de={draft.palmilhade!}
            onPrice={set("palmilha")}
            onDe={set("palmilhade")}
            fallback={DEFAULT_PRICES.palmilha!}
          />
          <Row
            title={SHIPPING_INSURANCE.name}
            sub="Oferecido na tela depois da compra"
            price={draft.seguro!}
            onPrice={set("seguro")}
            fallback={{ price: DEFAULT_PRICES.seguro, compareAt: null }}
          />
          <Row
            title={EXPRESS_SHIPPING.name}
            sub="Página própria depois das ofertas"
            price={draft.expresso!}
            onPrice={set("expresso")}
            fallback={{ price: DEFAULT_PRICES.expresso, compareAt: null }}
          />
        </div>
      </Card>

      {!check.success && (
        <p className="text-sm text-destructive">
          {check.error.issues.find((i) => i.message.startsWith('O preço "de"'))?.message ??
            "Confira os valores: todo preço precisa ser um número maior que zero e o desconto do upsell, de 1 a 90%."}
        </p>
      )}
      {msg && (
        <p className={`text-sm ${msg.ok ? "text-emerald-600" : "text-destructive"}`}>{msg.text}</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy || !dirty || !check.success} onClick={save}>
          {busy ? "Salvando…" : "Salvar preços"}
        </Button>
        <Button variant="outline" disabled={busy || !dirty} onClick={() => setDraft(saved)}>
          Desfazer alterações
        </Button>
        <Button variant="ghost" disabled={busy} onClick={reset}>
          Voltar aos preços de fábrica
        </Button>
      </div>
    </div>
  );
}

function Row(p: {
  title: string;
  sub: string;
  price: string;
  de?: string;
  onPrice: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDe?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fallback: { price: number; compareAt: number | null };
}) {
  const price = parse(p.price);
  const de = p.de === undefined ? null : parse(p.de);
  const off =
    price && de && Number.isFinite(price) && Number.isFinite(de) && de > price
      ? Math.round((1 - price / de) * 100)
      : null;
  return (
    <div className="grid gap-3 border-b pb-4 last:border-0 last:pb-0 md:grid-cols-[1fr_160px_160px_90px] md:items-end">
      <div>
        <div className="text-sm font-medium">{p.title}</div>
        <div className="text-xs text-muted-foreground">
          {p.sub} · padrão {brl(p.fallback.price)}
        </div>
      </div>
      <label className="text-xs text-muted-foreground">
        Preço de venda (R$)
        <Input inputMode="decimal" value={p.price} onChange={p.onPrice} className="mt-1" />
      </label>
      {p.onDe ? (
        <label className="text-xs text-muted-foreground">
          Preço "de" (R$)
          <Input
            inputMode="decimal"
            value={p.de}
            onChange={p.onDe}
            placeholder="sem desconto"
            className="mt-1"
          />
        </label>
      ) : (
        <span />
      )}
      <span className="text-sm text-emerald-600">{off ? `${off}% off` : ""}</span>
    </div>
  );
}
