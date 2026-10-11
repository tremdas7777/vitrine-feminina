// Cálculo de lucro/prejuízo por dia. Funções puras (sem banco nem rede).

export type ProfitSettings = {
  /** Imposto que o Meta cobra sobre o gasto (ex.: 13). */
  adsTaxPct: number;
  /** Taxa do gateway sobre cada venda paga (%). */
  gatewayPct: number;
  /** Taxa fixa do gateway por venda paga (R$). */
  gatewayFixed: number;
};

export type ProfitDay = {
  day: string; // AAAA-MM-DD (horário de Brasília)
  orders: number;
  revenue: number;
  metaSpend: number;
  manualSpend: number;
  adsTax: number;
  gatewayFees: number;
  profit: number;
};

export type ProfitTotals = Omit<ProfitDay, "day"> & {
  /** Faturamento ÷ (ads + imposto). null quando não houve gasto. */
  roas: number | null;
  /** Lucro ÷ faturamento, em %. null quando não houve faturamento. */
  margin: number | null;
};

const BRT = 3 * 60 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

/** Dia (AAAA-MM-DD) no horário de Brasília de um instante ISO. */
export function brtDay(iso: string | number): string {
  const t = typeof iso === "number" ? iso : new Date(iso).getTime();
  return new Date(t - BRT).toISOString().slice(0, 10);
}

/** Os últimos N dias (horário de Brasília), do mais antigo para hoje. */
export function lastDays(days: number, now = Date.now()): string[] {
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) out.push(brtDay(now - i * DAY));
  return out;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

export function computeProfit(input: {
  days: string[];
  paidOrders: { created_at: string; amount_cents: number }[];
  metaSpend: Record<string, number>;
  manualSpend: Record<string, number>;
  settings: ProfitSettings;
}): { rows: ProfitDay[]; totals: ProfitTotals } {
  const { settings: s } = input;
  const byDay = new Map<string, { orders: number; revenue: number }>();
  for (const o of input.paidOrders) {
    const d = brtDay(o.created_at);
    const cur = byDay.get(d) ?? { orders: 0, revenue: 0 };
    cur.orders++;
    cur.revenue += o.amount_cents / 100;
    byDay.set(d, cur);
  }

  const rows = input.days.map((day): ProfitDay => {
    const sales = byDay.get(day) ?? { orders: 0, revenue: 0 };
    const metaSpend = input.metaSpend[day] ?? 0;
    const manualSpend = input.manualSpend[day] ?? 0;
    // O imposto do Meta incide só sobre o gasto do Meta.
    const adsTax = (metaSpend * s.adsTaxPct) / 100;
    const gatewayFees = (sales.revenue * s.gatewayPct) / 100 + sales.orders * s.gatewayFixed;
    const profit = sales.revenue - metaSpend - manualSpend - adsTax - gatewayFees;
    return {
      day,
      orders: sales.orders,
      revenue: round2(sales.revenue),
      metaSpend: round2(metaSpend),
      manualSpend: round2(manualSpend),
      adsTax: round2(adsTax),
      gatewayFees: round2(gatewayFees),
      profit: round2(profit),
    };
  });

  const sum = (k: keyof Omit<ProfitDay, "day">) => round2(rows.reduce((t, r) => t + r[k], 0));
  const revenue = sum("revenue");
  const adsTotal = sum("metaSpend") + sum("manualSpend") + sum("adsTax");
  const profit = sum("profit");
  return {
    rows,
    totals: {
      orders: rows.reduce((t, r) => t + r.orders, 0),
      revenue,
      metaSpend: sum("metaSpend"),
      manualSpend: sum("manualSpend"),
      adsTax: sum("adsTax"),
      gatewayFees: sum("gatewayFees"),
      profit,
      roas: adsTotal > 0 ? round2(revenue / adsTotal) : null,
      margin: revenue > 0 ? round2((profit / revenue) * 100) : null,
    },
  };
}

export type CampaignSpendRow = {
  accountId: string;
  accountName: string;
  campaignId: string;
  campaignName: string;
  day: string;
  spend: number;
};

export type CampaignProfit = {
  campaignId: string;
  /** Passa no filtro de nome da oferta (só estas entram no lucro). */
  included: boolean;
  campaignName: string;
  accountName: string;
  spend: number;
  adsTax: number;
  /** Vendas pagas cuja utm_campaign aponta para esta campanha. */
  orders: number;
  revenue: number;
  profit: number;
  roas: number | null;
};

const fold = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

/**
 * A campanha é desta oferta? O filtro é uma lista separada por vírgula ("glico, glicomax"):
 * basta o nome conter um dos termos (sem diferenciar maiúscula nem acento). Vazio = todas.
 */
export function campaignInOffer(name: string, filter: string | null | undefined): boolean {
  const terms = (filter ?? "").split(",").map(fold).filter(Boolean);
  if (!terms.length) return true;
  const n = fold(name);
  return terms.some((t) => n.includes(t));
}

/** Gasto do Meta somado por dia (todas as campanhas e contas). */
export function spendByDay(rows: CampaignSpendRow[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) out[r.day] = (out[r.day] ?? 0) + r.spend;
  return out;
}

/**
 * A utm_campaign aponta para a campanha? Aceita o padrão da UTMify ("nome|id"),
 * só o id ou só o nome.
 */
export function utmMatchesCampaign(utm: string | null | undefined, id: string, name: string) {
  if (!utm) return false;
  const v = utm.trim().toLowerCase();
  const parts = v.split("|").map((p) => p.trim());
  return parts.includes(id) || parts.includes(name.trim().toLowerCase());
}

/** Gasto, vendas atribuídas pela UTM e lucro de cada campanha, da que mais gastou para a que menos. */
export function computeCampaigns(input: {
  spendRows: CampaignSpendRow[];
  paidOrders: { amount_cents: number; utm?: Record<string, string | null> | null }[];
  settings: ProfitSettings;
  /** Filtro de nome da oferta (ver campaignInOffer). */
  filter?: string;
}): CampaignProfit[] {
  const s = input.settings;
  const byId = new Map<string, CampaignProfit>();
  for (const r of input.spendRows) {
    const c: CampaignProfit = byId.get(r.campaignId) ?? {
      campaignId: r.campaignId,
      included: campaignInOffer(r.campaignName, input.filter),
      campaignName: r.campaignName,
      accountName: r.accountName,
      spend: 0,
      adsTax: 0,
      orders: 0,
      revenue: 0,
      profit: 0,
      roas: null,
    };
    c.spend += r.spend;
    byId.set(r.campaignId, c);
  }
  const campaigns = [...byId.values()];
  for (const o of input.paidOrders) {
    const utm = o.utm?.["utm_campaign"];
    const c = campaigns.find((x) => utmMatchesCampaign(utm, x.campaignId, x.campaignName));
    if (!c) continue;
    c.orders++;
    c.revenue += o.amount_cents / 100;
  }
  for (const c of campaigns) {
    c.adsTax = round2((c.spend * s.adsTaxPct) / 100);
    const fees = (c.revenue * s.gatewayPct) / 100 + c.orders * s.gatewayFixed;
    c.profit = round2(c.revenue - c.spend - c.adsTax - fees);
    c.roas = c.spend > 0 ? round2(c.revenue / (c.spend + c.adsTax)) : null;
    c.spend = round2(c.spend);
    c.revenue = round2(c.revenue);
  }
  return campaigns
    .filter((c) => c.spend > 0 || c.orders > 0)
    .sort((a, b) => Number(b.included) - Number(a.included) || b.spend - a.spend);
}
