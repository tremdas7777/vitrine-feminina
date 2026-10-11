import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// private_settings: o painel escolheu a PixGate; nenhuma chave salva (vale o secret).
vi.mock("@/integrations/supabase/client.server", () => {
  let key = "";
  const chain = {
    select: () => chain,
    eq: (_col: string, v: string) => ((key = v), chain),
    maybeSingle: async () => ({ data: key === "pix_gateway" ? { value: "pixgate" } : null }),
  };
  return { supabaseAdmin: { from: () => chain } };
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("PixGate como gateway escolhido", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env["PIXGATE_API_KEY"] = "pg_chave_teste_123456";
    process.env["SAGACEPAY_API_KEY"] = "sk_live_teste_123456";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env["PIXGATE_API_KEY"];
    delete process.env["SAGACEPAY_API_KEY"];
  });

  it("gera o Pix na PixGate, com prefixo pg_ e webhook ?gw=pg", async () => {
    const fetchMock = vi.fn(async () => json({ id: "tx9", pix: "000201pg", status: "pending" }));
    vi.stubGlobal("fetch", fetchMock);
    const { createPix } = await import("@/lib/pix-gateway.server");
    const pix = await createPix({
      amount: 9990,
      customer: { name: "Ana", email: "a@b.com", phone: "11999999999", cpf: "52998224725" },
      description: "Pedido Vitrine Feminina",
      origin: "https://loja.com.br/checkout",
    });
    expect(pix).toEqual({ id: "pg_tx9", qrcode: "000201pg", status: "pending" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://app.pixgateip.com/api/v1/cashin");
    const body = JSON.parse(String(init.body));
    expect(body.valor).toBe(99.9);
    expect(body.postback).toBe("https://loja.com.br/api/public/pix-webhook?gw=pg");
  });

  it("consulta cada pedido no gateway em que nasceu", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      String(url).includes("pixgateip")
        ? json({ status: "paid", value: 99.9 })
        : json({ id: "sale1", status: "pending", amount: 69.9 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { fetchGatewayStatus } = await import("@/lib/pix-orders.server");
    expect(await fetchGatewayStatus("pg_tx9")).toEqual({ status: "paid", amount: 9990 });
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toContain("/stats/tx9");
    expect(await fetchGatewayStatus("sale1")).toEqual({ status: "pending", amount: 6990 });
    expect(String((fetchMock.mock.calls[1] as unknown[])[0])).toContain(
      "sagacepay.com/api/sales/sale1",
    );
  });
});
