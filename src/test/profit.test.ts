import { describe, expect, it } from "vitest";
import {
  brtDay,
  campaignInOffer,
  computeCampaigns,
  computeProfit,
  lastDays,
  spendByDay,
  utmMatchesCampaign,
} from "@/lib/profit";

describe("profit", () => {
  it("usa o dia de Brasília", () => {
    expect(brtDay("2026-10-09T02:59:00Z")).toBe("2026-10-08");
    expect(brtDay("2026-10-09T03:00:00Z")).toBe("2026-10-09");
    expect(lastDays(3, Date.parse("2026-10-09T12:00:00Z"))).toEqual([
      "2026-10-07",
      "2026-10-08",
      "2026-10-09",
    ]);
  });

  it("desconta ads, imposto do Meta e taxa do gateway", () => {
    const { rows, totals } = computeProfit({
      days: ["2026-10-08", "2026-10-09"],
      paidOrders: [
        { created_at: "2026-10-08T15:00:00Z", amount_cents: 10000 },
        { created_at: "2026-10-08T16:00:00Z", amount_cents: 10000 },
        { created_at: "2026-10-09T15:00:00Z", amount_cents: 5000 },
      ],
      metaSpend: { "2026-10-08": 100, "2026-10-09": 100 },
      manualSpend: { "2026-10-09": 10 },
      settings: { adsTaxPct: 13, gatewayPct: 2, gatewayFixed: 1 },
    });
    // 200 − 100 − 13 − (4 + 2) = 81
    expect(rows[0]).toMatchObject({
      orders: 2,
      revenue: 200,
      adsTax: 13,
      gatewayFees: 6,
      profit: 81,
    });
    // 50 − 100 − 13 − 10 − (1 + 1) = −75 (prejuízo)
    expect(rows[1]).toMatchObject({ orders: 1, revenue: 50, gatewayFees: 2, profit: -75 });
    expect(totals.profit).toBe(6);
    expect(totals.roas).toBe(1.06); // 250 / (200 + 26 + 10)
    expect(totals.margin).toBe(2.4);
  });

  it("sem gasto, ROAS fica vazio", () => {
    const { totals } = computeProfit({
      days: ["2026-10-09"],
      paidOrders: [],
      metaSpend: {},
      manualSpend: {},
      settings: { adsTaxPct: 13, gatewayPct: 0, gatewayFixed: 0 },
    });
    expect(totals.roas).toBeNull();
    expect(totals.margin).toBeNull();
  });
});

describe("campanhas", () => {
  const settings = { adsTaxPct: 13, gatewayPct: 0, gatewayFixed: 0 };
  const row = (campaignId: string, campaignName: string, day: string, spend: number) => ({
    accountId: "1",
    accountName: "Conta",
    campaignId,
    campaignName,
    day,
    spend,
  });

  it("reconhece utm_campaign no padrão nome|id, só id ou só nome", () => {
    expect(utmMatchesCampaign("GLICO CBO|120200", "120200", "GLICO CBO")).toBe(true);
    expect(utmMatchesCampaign("120200", "120200", "outra")).toBe(true);
    expect(utmMatchesCampaign("glico cbo", "999", "GLICO CBO")).toBe(true);
    expect(utmMatchesCampaign("outra|555", "120200", "GLICO CBO")).toBe(false);
    expect(utmMatchesCampaign(null, "120200", "GLICO CBO")).toBe(false);
  });

  it("soma gasto por dia e atribui vendas pela UTM", () => {
    const spendRows = [
      row("1", "A", "2026-10-08", 50),
      row("1", "A", "2026-10-09", 50),
      row("2", "B", "2026-10-09", 30),
    ];
    expect(spendByDay(spendRows)).toEqual({ "2026-10-08": 50, "2026-10-09": 80 });
    const campaigns = computeCampaigns({
      spendRows,
      paidOrders: [
        { amount_cents: 20000, utm: { utm_campaign: "A|1" } },
        { amount_cents: 9900, utm: { utm_campaign: null } },
      ],
      settings,
    });
    expect(campaigns.map((c) => c.campaignId)).toEqual(["1", "2"]);
    // 200 − 100 − 13 = 87
    expect(campaigns[0]).toMatchObject({ spend: 100, orders: 1, revenue: 200, profit: 87 });
    expect(campaigns[1]).toMatchObject({ spend: 30, orders: 0, profit: -33.9 });
  });
});

describe("filtro da oferta", () => {
  it("compara pelo nome, sem maiúscula nem acento; vazio = todas", () => {
    expect(campaignInOffer("[CBO] GlicoMax - Público Frio", "glico")).toBe(true);
    expect(campaignInOffer("Glicómax teste", "glicomax")).toBe(true);
    expect(campaignInOffer("Lentes - Remarketing", "glico, glicomax")).toBe(false);
    expect(campaignInOffer("Qualquer", "")).toBe(true);
    expect(campaignInOffer("Qualquer", " , ")).toBe(true);
  });

  it("marca campanhas fora da oferta e põe por último", () => {
    const campaigns = computeCampaigns({
      spendRows: [
        {
          accountId: "1",
          accountName: "C",
          campaignId: "1",
          campaignName: "Lentes",
          day: "2026-10-09",
          spend: 500,
        },
        {
          accountId: "1",
          accountName: "C",
          campaignId: "2",
          campaignName: "GLICO",
          day: "2026-10-09",
          spend: 50,
        },
      ],
      paidOrders: [],
      settings: { adsTaxPct: 13, gatewayPct: 0, gatewayFixed: 0 },
      filter: "glico",
    });
    expect(campaigns.map((c) => [c.campaignId, c.included])).toEqual([
      ["2", true],
      ["1", false],
    ]);
  });
});
