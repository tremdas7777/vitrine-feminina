import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { periodStart } from "./admin.functions";
import {
  fetchCampaignSpend,
  getProfitConfig,
  listAdAccounts,
  saveManualSpend,
  saveProfitConfig,
  type AdAccount,
} from "./meta-ads.server";
import {
  campaignInOffer,
  computeCampaigns,
  computeProfit,
  lastDays,
  spendByDay,
  type CampaignProfit,
  type CampaignSpendRow,
  type ProfitDay,
  type ProfitTotals,
} from "./profit";

function assertAdmin(password: string) {
  if (password !== process.env["ADMIN_PASSWORD"]) throw new Error("Não autorizado");
}

const pwd = z.string().min(1).max(200);

export type AccountStatus = AdAccount & { enabled: boolean; error: string | null };

/**
 * Faturamento (pedidos pagos) − gasto com ads − imposto do Meta − taxa do gateway, por dia e
 * por campanha. As contas de anúncios são detectadas pelo token.
 */
export const getProfitReport = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ password: pwd, days: z.number().int().min(1).max(365).default(7) }).parse(d),
  )
  .handler(
    async ({
      data,
    }): Promise<{
      rows: ProfitDay[];
      totals: ProfitTotals;
      campaigns: CampaignProfit[];
      accounts: AccountStatus[];
      metaError: string | null;
    }> => {
      assertAdmin(data.password);
      const cfg = await getProfitConfig();
      const days = lastDays(data.days);
      const since = days[0]!;
      const until = days[days.length - 1]!;

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      // Tabela pix_orders ainda não presente nos tipos gerados.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabaseAdmin as unknown as { from: (t: string) => any };
      const ordersQuery = db
        .from("pix_orders")
        .select("created_at,amount_cents,utm")
        .eq("status", "paid")
        .gte("created_at", periodStart(data.days))
        .limit(10000);

      // Contas detectadas → gasto por campanha de cada conta marcada.
      let metaError: string | null = null;
      const accounts: AccountStatus[] = [];
      const spendRows: CampaignSpendRow[] = [];
      const loadMeta = async () => {
        if (!cfg.token) {
          metaError = "Token do Meta não configurado";
          return;
        }
        try {
          const found = await listAdAccounts(cfg.token);
          if (!found.length) metaError = "O token não enxerga nenhuma conta de anúncios";
          await Promise.all(
            found.map(async (a) => {
              const st: AccountStatus = {
                ...a,
                enabled: !cfg.disabledAccounts.includes(a.id),
                error: null,
              };
              accounts.push(st);
              if (!st.enabled) return;
              try {
                spendRows.push(...(await fetchCampaignSpend(a, cfg.token!, since, until)));
              } catch (e) {
                st.error = e instanceof Error ? e.message : "Falha ao consultar";
              }
            }),
          );
        } catch (e) {
          metaError = e instanceof Error ? e.message : "Falha ao consultar o Meta";
        }
      };

      const [orders] = await Promise.all([ordersQuery, loadMeta()]);
      if (orders.error) throw new Error(orders.error.message);
      const paidOrders = orders.data ?? [];

      const { rows, totals } = computeProfit({
        days,
        paidOrders,
        // Só o gasto das campanhas desta oferta entra no lucro.
        metaSpend: spendByDay(
          spendRows.filter((r) => campaignInOffer(r.campaignName, cfg.campaignFilter)),
        ),
        manualSpend: cfg.manualSpend,
        settings: cfg.settings,
      });
      return {
        rows: rows.reverse(),
        totals,
        campaigns: computeCampaigns({
          spendRows,
          paidOrders,
          settings: cfg.settings,
          filter: cfg.campaignFilter,
        }),
        accounts: accounts.sort((a, b) => a.name.localeCompare(b.name)),
        metaError,
      };
    },
  );

export const getProfitSettings = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ password: pwd }).parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    const c = await getProfitConfig();
    return {
      disabledAccounts: c.disabledAccounts,
      campaignFilter: c.campaignFilter,
      tokenSource: c.tokenSource,
      tokenHint: c.token ? `••••${c.token.slice(-4)}` : "",
      ...c.settings,
    };
  });

export const saveProfitSettings = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        password: pwd,
        disabledAccounts: z.array(z.string().regex(/^\d{1,25}$/)).max(500),
        campaignFilter: z.string().trim().max(300).default(""),
        token: z.string().trim().max(600).optional(),
        adsTaxPct: z.number().min(0).max(100),
        gatewayPct: z.number().min(0).max(100),
        gatewayFixed: z.number().min(0).max(1000),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    await saveProfitConfig({
      disabledAccounts: data.disabledAccounts,
      campaignFilter: data.campaignFilter,
      token: data.token || undefined,
      settings: {
        adsTaxPct: data.adsTaxPct,
        gatewayPct: data.gatewayPct,
        gatewayFixed: data.gatewayFixed,
      },
    });
    return { ok: true };
  });

/** Gasto com ads fora do Meta (TikTok, Google, influenciador…) lançado à mão por dia. */
export const setManualAdSpend = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        password: pwd,
        day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        value: z.number().min(0).max(1_000_000),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    await saveManualSpend(data.day, Math.round(data.value * 100) / 100);
    return { ok: true };
  });
