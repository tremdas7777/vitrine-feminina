// Gasto do Meta Ads (API de Marketing) e configurações de lucro. Somente servidor.
// Tudo fica em private_settings (só service role) e é gerenciado pelo /admin.
import type { CampaignSpendRow, ProfitSettings } from "./profit";

const KEYS = {
  disabledAccounts: "meta_ads_disabled_accounts",
  token: "meta_ads_token",
  capiToken: "meta_access_token",
  adsTaxPct: "profit_ads_tax_pct",
  gatewayPct: "profit_gateway_pct",
  gatewayFixed: "profit_gateway_fixed",
  manualSpend: "profit_manual_spend",
  campaignFilter: "profit_campaign_filter",
} as const;

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function readAll(): Promise<Map<string, string | null>> {
  const { data, error } = await (
    await db()
  )
    .from("private_settings")
    .select("key,value")
    .in("key", Object.values(KEYS));
  if (error) throw new Error(error.message);
  return new Map((data ?? []).map((r) => [r.key, r.value]));
}

async function upsert(rows: { key: string; value: string }[]) {
  const now = new Date().toISOString();
  const { error } = await (
    await db()
  )
    .from("private_settings")
    .upsert(rows.map((r) => ({ ...r, updated_at: now })));
  if (error) throw new Error(error.message);
}

const num = (v: string | null | undefined, fallback: number) => {
  const n = Number(v);
  return v != null && v !== "" && Number.isFinite(n) ? n : fallback;
};

export type ProfitConfig = {
  /** Contas desmarcadas no /admin. As demais (inclusive novas) entram no cálculo. */
  disabledAccounts: string[];
  /** Token próprio de ads ou, sem ele, o token da API de Conversões. */
  token: string | null;
  tokenSource: "ads" | "capi" | null;
  settings: ProfitSettings;
  manualSpend: Record<string, number>;
  /** Termos do nome das campanhas desta oferta, separados por vírgula. Vazio = todas. */
  campaignFilter: string;
};

export async function getProfitConfig(): Promise<ProfitConfig> {
  const m = await readAll();
  const adsToken = m.get(KEYS.token) || null;
  const capiToken = m.get(KEYS.capiToken) || null;
  return {
    disabledAccounts: parseJson<string[]>(m.get(KEYS.disabledAccounts), []),
    token: adsToken ?? capiToken,
    tokenSource: adsToken ? "ads" : capiToken ? "capi" : null,
    settings: {
      adsTaxPct: num(m.get(KEYS.adsTaxPct), 13),
      gatewayPct: num(m.get(KEYS.gatewayPct), 0),
      gatewayFixed: num(m.get(KEYS.gatewayFixed), 0),
    },
    manualSpend: parseJson<Record<string, number>>(m.get(KEYS.manualSpend), {}),
    campaignFilter: m.get(KEYS.campaignFilter) ?? "",
  };
}

function parseJson<T>(v: string | null | undefined, fallback: T): T {
  try {
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback; // valor corrompido: ignora
  }
}

export async function saveProfitConfig(c: {
  disabledAccounts: string[];
  campaignFilter: string;
  token?: string;
  settings: ProfitSettings;
}) {
  const rows: { key: string; value: string }[] = [
    { key: KEYS.disabledAccounts, value: JSON.stringify(c.disabledAccounts) },
    { key: KEYS.campaignFilter, value: c.campaignFilter },
    { key: KEYS.adsTaxPct, value: String(c.settings.adsTaxPct) },
    { key: KEYS.gatewayPct, value: String(c.settings.gatewayPct) },
    { key: KEYS.gatewayFixed, value: String(c.settings.gatewayFixed) },
  ];
  // Token só é substituído quando um novo é digitado.
  if (c.token) rows.push({ key: KEYS.token, value: c.token });
  await upsert(rows);
}

/** Grava (ou apaga, com 0) o gasto manual de um dia. */
export async function saveManualSpend(day: string, value: number) {
  const { manualSpend } = await getProfitConfig();
  if (value > 0) manualSpend[day] = value;
  else delete manualSpend[day];
  await upsert([{ key: KEYS.manualSpend, value: JSON.stringify(manualSpend) }]);
}

const GRAPH = "https://graph.facebook.com/v21.0";

type GraphPage<T> = { data?: T[]; paging?: { next?: string }; error?: { message?: string } };

/** Busca todas as páginas de um endpoint do Graph. Lança com a mensagem do Meta. */
async function graphAll<T>(url: string): Promise<T[]> {
  const out: T[] = [];
  let next: string | undefined = url;
  for (let i = 0; next && i < 50; i++) {
    const res = await fetch(next);
    const json = (await res.json().catch(() => ({}))) as GraphPage<T>;
    if (!res.ok || json.error) throw new Error(json.error?.message ?? `HTTP ${res.status}`);
    out.push(...(json.data ?? []));
    next = json.paging?.next;
  }
  return out;
}

export type AdAccount = { id: string; name: string; currency: string; active: boolean };

/** Contas de anúncios que o token enxerga (detectadas automaticamente). */
export async function listAdAccounts(token: string): Promise<AdAccount[]> {
  const params = new URLSearchParams({
    fields: "account_id,name,currency,account_status",
    limit: "200",
    access_token: token,
  });
  const rows = await graphAll<{
    account_id: string;
    name?: string;
    currency?: string;
    account_status?: number;
  }>(`${GRAPH}/me/adaccounts?${params}`);
  return rows.map((r) => ({
    id: r.account_id,
    name: r.name || r.account_id,
    currency: r.currency ?? "BRL",
    active: r.account_status === 1,
  }));
}

/** Gasto por campanha e por dia de uma conta (sem imposto), na moeda da conta. */
export async function fetchCampaignSpend(
  account: AdAccount,
  token: string,
  since: string,
  until: string,
): Promise<CampaignSpendRow[]> {
  const params = new URLSearchParams({
    fields: "campaign_id,campaign_name,spend",
    level: "campaign",
    time_increment: "1",
    time_range: JSON.stringify({ since, until }),
    limit: "500",
    access_token: token,
  });
  const rows = await graphAll<{
    campaign_id?: string;
    campaign_name?: string;
    spend?: string;
    date_start?: string;
  }>(`${GRAPH}/act_${encodeURIComponent(account.id)}/insights?${params}`);
  return rows
    .filter((r) => r.campaign_id && r.date_start)
    .map((r) => ({
      accountId: account.id,
      accountName: account.name,
      campaignId: r.campaign_id!,
      campaignName: r.campaign_name ?? r.campaign_id!,
      day: r.date_start!,
      spend: Number(r.spend ?? 0) || 0,
    }));
}
