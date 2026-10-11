import { useEffect, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  DollarSign,
  Loader2,
  Megaphone,
  Percent,
  RefreshCw,
  Settings2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  getProfitReport,
  getProfitSettings,
  saveProfitSettings,
  setManualAdSpend,
  type AccountStatus,
} from "@/lib/profit.functions";
import type { CampaignProfit, ProfitDay, ProfitTotals } from "@/lib/profit";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

export interface ProfitTabProps {
  password: string;
}

const PERIODS = [
  { days: 1, label: "Hoje" },
  { days: 7, label: "7d" },
  { days: 30, label: "30d" },
  { days: 90, label: "90d" },
] as const;

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDay = (d: string) => {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
};

const profitCls = (v: number) => (v > 0 ? "text-green-700" : v < 0 ? "text-red-600" : "");

/** Aba de lucro: faturamento − gasto com ads (Meta + manual) − imposto do Meta − taxa do gateway. */
export function ProfitTab({ password }: ProfitTabProps) {
  const reportFn = useServerFn(getProfitReport);
  const [days, setDays] = useState<number>(7);
  const [rows, setRows] = useState<ProfitDay[]>([]);
  const [totals, setTotals] = useState<ProfitTotals | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignProfit[]>([]);
  const [accounts, setAccounts] = useState<AccountStatus[]>([]);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await reportFn({ data: { password, days } });
      setRows(r.rows);
      setTotals(r.totals);
      setCampaigns(r.campaigns);
      setAccounts(r.accounts);
      setMetaError(r.metaError);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [password, days]);

  const t = totals;
  const adsTotal = t ? t.metaSpend + t.manualSpend + t.adsTax : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {PERIODS.map((p) => (
          <Button
            key={p.days}
            size="sm"
            variant={days === p.days ? "default" : "outline"}
            onClick={() => setDays(p.days)}
          >
            {p.label}
          </Button>
        ))}
        <Button size="sm" variant="outline" className="ml-auto" onClick={load} disabled={loading}>
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Atualizar
        </Button>
      </div>

      {metaError && (
        <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Gasto do Meta não carregou: {metaError}. Confira o token em “Configurar” abaixo.
        </p>
      )}
      {accounts
        .filter((a) => a.error)
        .map((a) => (
          <p
            key={a.id}
            className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
          >
            Conta {a.name} não carregou: {a.error}
          </p>
        ))}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Stat
          icon={<DollarSign className="w-5 h-5" />}
          label="Faturamento"
          value={brl(t?.revenue ?? 0)}
          helper={`${t?.orders ?? 0} pedidos pagos`}
        />
        <Stat
          icon={<Megaphone className="w-5 h-5" />}
          label="Gasto com ads"
          value={brl(adsTotal)}
          helper={t ? `inclui ${brl(t.adsTax)} de imposto` : undefined}
        />
        <Stat
          icon={<Percent className="w-5 h-5" />}
          label="Taxa gateway"
          value={brl(t?.gatewayFees ?? 0)}
        />
        <Stat
          icon={
            (t?.profit ?? 0) < 0 ? (
              <TrendingDown className="w-5 h-5" />
            ) : (
              <TrendingUp className="w-5 h-5" />
            )
          }
          label={(t?.profit ?? 0) < 0 ? "Prejuízo" : "Lucro"}
          value={brl(t?.profit ?? 0)}
          valueCls={profitCls(t?.profit ?? 0)}
          helper={t?.margin != null ? `margem ${t.margin.toLocaleString("pt-BR")}%` : undefined}
        />
        <Stat
          icon={<TrendingUp className="w-5 h-5" />}
          label="ROAS"
          value={t?.roas != null ? t.roas.toLocaleString("pt-BR") : "—"}
          helper="faturamento ÷ ads"
        />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="px-4 py-2 font-medium">Dia</th>
                <th className="px-4 py-2 font-medium">Pagos</th>
                <th className="px-4 py-2 font-medium">Faturamento</th>
                <th className="px-4 py-2 font-medium">Meta Ads</th>
                <th className="px-4 py-2 font-medium">Imposto Meta</th>
                <th className="px-4 py-2 font-medium">Outros ads</th>
                <th className="px-4 py-2 font-medium">Taxa gateway</th>
                <th className="px-4 py-2 font-medium">Lucro</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.day} className="border-t">
                  <td className="px-4 py-2 whitespace-nowrap">{fmtDay(r.day)}</td>
                  <td className="px-4 py-2 tabular-nums">{r.orders}</td>
                  <td className="px-4 py-2 tabular-nums whitespace-nowrap">{brl(r.revenue)}</td>
                  <td className="px-4 py-2 tabular-nums whitespace-nowrap">{brl(r.metaSpend)}</td>
                  <td className="px-4 py-2 tabular-nums whitespace-nowrap text-muted-foreground">
                    {brl(r.adsTax)}
                  </td>
                  <td className="px-4 py-2">
                    <ManualSpendInput
                      password={password}
                      day={r.day}
                      value={r.manualSpend}
                      onSaved={load}
                    />
                  </td>
                  <td className="px-4 py-2 tabular-nums whitespace-nowrap text-muted-foreground">
                    {brl(r.gatewayFees)}
                  </td>
                  <td
                    className={`px-4 py-2 tabular-nums whitespace-nowrap font-medium ${profitCls(r.profit)}`}
                  >
                    {brl(r.profit)}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && !loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    Sem dados no período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      <CampaignsTable campaigns={campaigns} loading={loading} />

      <p className="text-xs text-muted-foreground">
        Lucro = faturamento dos pedidos pagos − Meta Ads − imposto do Meta − outros ads − taxa do
        gateway. Não desconta custo do produto nem frete.
      </p>

      <ProfitSettingsCard password={password} accounts={accounts} onSaved={load} />
    </div>
  );
}

/** Gasto de cada campanha do Meta e as vendas que a UTM atribui a ela. */
function CampaignsTable({ campaigns, loading }: { campaigns: CampaignProfit[]; loading: boolean }) {
  const multiAccount = new Set(campaigns.map((c) => c.accountName)).size > 1;
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Por campanha
      </h2>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="px-4 py-2 font-medium">Campanha</th>
                <th className="px-4 py-2 font-medium">Gasto</th>
                <th className="px-4 py-2 font-medium">Imposto</th>
                <th className="px-4 py-2 font-medium">Vendas</th>
                <th className="px-4 py-2 font-medium">Faturamento</th>
                <th className="px-4 py-2 font-medium">ROAS</th>
                <th className="px-4 py-2 font-medium">Lucro</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr
                  key={c.campaignId}
                  className={`border-t ${c.included ? "" : "text-muted-foreground opacity-60"}`}
                >
                  <td className="px-4 py-2">
                    <div className="font-medium">
                      {c.campaignName}
                      {!c.included && (
                        <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal uppercase">
                          outra oferta · não conta
                        </span>
                      )}
                    </div>
                    {multiAccount && (
                      <div className="text-xs text-muted-foreground">{c.accountName}</div>
                    )}
                  </td>
                  <td className="px-4 py-2 tabular-nums whitespace-nowrap">{brl(c.spend)}</td>
                  <td className="px-4 py-2 tabular-nums whitespace-nowrap text-muted-foreground">
                    {brl(c.adsTax)}
                  </td>
                  <td className="px-4 py-2 tabular-nums">{c.orders}</td>
                  <td className="px-4 py-2 tabular-nums whitespace-nowrap">{brl(c.revenue)}</td>
                  <td className="px-4 py-2 tabular-nums">
                    {c.roas != null ? c.roas.toLocaleString("pt-BR") : "—"}
                  </td>
                  <td
                    className={`px-4 py-2 tabular-nums whitespace-nowrap font-medium ${profitCls(c.profit)}`}
                  >
                    {brl(c.profit)}
                  </td>
                </tr>
              ))}
              {campaigns.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhuma campanha com gasto no período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="text-xs text-muted-foreground">
        Vendas por campanha vêm da utm_campaign do pedido (padrão UTMify “nome|id”). Vendas sem UTM
        entram no total do período, mas não em nenhuma campanha. Campanhas em cinza não passam no
        filtro da oferta (em “Configurar”) e não entram no lucro.
      </p>
    </section>
  );
}

/** Gasto com ads fora do Meta, editável por dia (salva ao sair do campo). */
function ManualSpendInput({
  password,
  day,
  value,
  onSaved,
}: {
  password: string;
  day: string;
  value: number;
  onSaved: () => void;
}) {
  const saveFn = useServerFn(setManualAdSpend);
  const [text, setText] = useState(value ? String(value).replace(".", ",") : "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setText(value ? String(value).replace(".", ",") : "");
  }, [value]);

  const save = async () => {
    // "1.234,56" ou "12.5": com vírgula, o ponto é separador de milhar.
    const norm = text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text;
    const n = Number(norm) || 0;
    if (n === value) return;
    setBusy(true);
    try {
      await saveFn({ data: { password, day, value: n } });
      onSaved();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Input
      className="h-8 w-24"
      inputMode="decimal"
      placeholder="0,00"
      value={text}
      disabled={busy}
      onChange={(e) => setText(e.target.value.replace(/[^\d.,]/g, ""))}
      onBlur={save}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
    />
  );
}

/** Token do Meta, contas detectadas (marcar/desmarcar) e taxas usadas no cálculo. */
function ProfitSettingsCard({
  password,
  accounts,
  onSaved,
}: {
  password: string;
  accounts: AccountStatus[];
  onSaved: () => void;
}) {
  const loadFn = useServerFn(getProfitSettings);
  const saveFn = useServerFn(saveProfitSettings);
  const [disabled, setDisabled] = useState<string[]>([]);
  const [campaignFilter, setCampaignFilter] = useState("");
  const [token, setToken] = useState("");
  const [tokenHint, setTokenHint] = useState("");
  const [tokenSource, setTokenSource] = useState<"ads" | "capi" | null>(null);
  const [adsTaxPct, setAdsTaxPct] = useState("13");
  const [gatewayPct, setGatewayPct] = useState("0");
  const [gatewayFixed, setGatewayFixed] = useState("0");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!password) return;
    loadFn({ data: { password } })
      .then((r) => {
        setDisabled(r.disabledAccounts);
        setCampaignFilter(r.campaignFilter);
        setTokenHint(r.tokenHint);
        setTokenSource(r.tokenSource);
        setAdsTaxPct(String(r.adsTaxPct).replace(".", ","));
        setGatewayPct(String(r.gatewayPct).replace(".", ","));
        setGatewayFixed(String(r.gatewayFixed).replace(".", ","));
      })
      .catch(() => setMsg("Não foi possível carregar."));
  }, [password, loadFn]);

  const toNum = (v: string) => Number(v.replace(",", ".")) || 0;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await saveFn({
        data: {
          password,
          disabledAccounts: disabled,
          campaignFilter,
          token: token || undefined,
          adsTaxPct: toNum(adsTaxPct),
          gatewayPct: toNum(gatewayPct),
          gatewayFixed: toNum(gatewayFixed),
        },
      });
      if (token) {
        setTokenHint(`••••${token.slice(-4)}`);
        setTokenSource("ads");
      }
      setToken("");
      setMsg("Salvo.");
      onSaved();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-5">
      <div className="flex items-center gap-3 mb-4">
        <Settings2 className="w-5 h-5 text-muted-foreground" aria-hidden />
        <div>
          <div className="font-medium">Configurar</div>
          <div className="text-xs text-muted-foreground">
            As contas de anúncios são detectadas pelo token, que precisa da permissão ads_read
            {tokenSource === "capi" && " — hoje está usando o token do Pixel"}.
          </div>
        </div>
      </div>
      <form onSubmit={save} className="grid gap-3 md:grid-cols-4">
        <div className="md:col-span-4 space-y-1">
          <div className="text-xs text-muted-foreground">Contas detectadas</div>
          {accounts.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhuma conta encontrada ainda. Salve um token com ads_read e clique em Atualizar.
            </p>
          )}
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {accounts.map((a) => (
              <label key={a.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={!disabled.includes(a.id)}
                  onCheckedChange={(on) =>
                    setDisabled((d) => (on ? d.filter((x) => x !== a.id) : [...d, a.id]))
                  }
                />
                <span>
                  {a.name}{" "}
                  <span className="text-xs text-muted-foreground">
                    ({a.id}
                    {a.currency !== "BRL" && ` · ${a.currency}`}
                    {!a.active && " · inativa"})
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>
        <label className="md:col-span-4 text-xs text-muted-foreground space-y-1">
          <span>
            Campanhas desta oferta — o nome contém (separe por vírgula; vazio = todas as campanhas)
          </span>
          <Input
            value={campaignFilter}
            onChange={(e) => setCampaignFilter(e.target.value)}
            placeholder="vitrine, tenis"
          />
        </label>
        <label className="text-xs text-muted-foreground space-y-1">
          <span>Token {tokenHint && `(atual ${tokenHint})`}</span>
          <Input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={tokenHint ? "Deixe vazio para manter" : "EAA..."}
            autoComplete="off"
          />
        </label>
        <label className="text-xs text-muted-foreground space-y-1">
          <span>Imposto do Meta (%)</span>
          <Input
            inputMode="decimal"
            value={adsTaxPct}
            onChange={(e) => setAdsTaxPct(e.target.value)}
          />
        </label>
        <label className="text-xs text-muted-foreground space-y-1">
          <span>Taxa do gateway (%)</span>
          <Input
            inputMode="decimal"
            value={gatewayPct}
            onChange={(e) => setGatewayPct(e.target.value)}
          />
        </label>
        <label className="text-xs text-muted-foreground space-y-1">
          <span>Taxa fixa por venda (R$)</span>
          <Input
            inputMode="decimal"
            value={gatewayFixed}
            onChange={(e) => setGatewayFixed(e.target.value)}
          />
        </label>
        <div className="md:col-span-4 flex flex-wrap items-center gap-3">
          <Button type="submit" size="sm" disabled={busy}>
            Salvar
          </Button>
          {msg && <span className="text-xs text-foreground">{msg}</span>}
        </div>
      </form>
    </Card>
  );
}

function Stat({
  icon,
  label,
  value,
  helper,
  valueCls = "",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  helper?: string;
  valueCls?: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        {icon}
        <span className="text-xs uppercase tracking-wider">{label}</span>
      </div>
      <div className={`text-2xl font-display tabular-nums ${valueCls}`}>{value}</div>
      {helper && <div className="text-xs text-muted-foreground mt-1">{helper}</div>}
    </Card>
  );
}
