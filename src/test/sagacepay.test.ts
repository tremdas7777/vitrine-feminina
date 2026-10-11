import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Sem chave salva no painel: a integração usa o secret SAGACEPAY_API_KEY.
vi.mock("@/integrations/supabase/client.server", () => {
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: async () => ({ data: null }),
  };
  return { supabaseAdmin: { from: () => chain } };
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("SagacePay", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env["SAGACEPAY_API_KEY"] = "sk_live_teste_123456";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env["SAGACEPAY_API_KEY"];
  });

  it("gera o Pix em reais, com idempotência, webhook da loja e chave no header", async () => {
    const fetchMock = vi.fn(async () =>
      json({ data: { id: "sale_abc", pixCode: "000201pix", status: "pending" } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { createPix } = await import("@/lib/pix-gateway.server");
    const pix = await createPix({
      amount: 649000,
      customer: {
        name: "Ana Souza",
        email: "ana@ex.com",
        phone: "11999999999",
        cpf: "52998224725",
      },
      description: "Pedido Vitrine Feminina",
      origin: "https://loja.com.br/checkout?plano=2",
    });
    expect(pix).toEqual({ id: "sale_abc", qrcode: "000201pix", status: "pending" });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://sagacepay.com/api/sales");
    const headers = init.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("sk_live_teste_123456");
    expect(headers["idempotency-key"]).toBeTruthy();
    const body = JSON.parse(String(init.body));
    expect(body.amount).toBe(6490);
    expect(body.customer.document).toBe("52998224725");
    expect(body.postbackUrl).toBe("https://loja.com.br/api/public/pix-webhook");
    expect(body.externalId).toBe(headers["idempotency-key"]);
    expect(body.expirationInSeconds).toBe(1800);
  });

  it("falha com mensagem amigável quando a SagacePay não devolve o Pix", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ message: "invalid" }, 422)),
    );
    const { createPix } = await import("@/lib/pix-gateway.server");
    await expect(
      createPix({
        amount: 100,
        customer: { name: "Ana", email: "a@b.com", phone: "11999999999", cpf: "52998224725" },
        description: "Pedido Vitrine Feminina",
        origin: "https://loja.com.br",
      }),
    ).rejects.toThrow("Não foi possível gerar o Pix");
  });

  it("status: só 'paid' é pago e o valor volta em centavos", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ id: "sale_abc", status: "PAID", amount: 6490.5 })),
    );
    const { fetchGatewayStatus, isPaidStatus } = await import("@/lib/pix-orders.server");
    const r = await fetchGatewayStatus("sale_abc");
    expect(r).toEqual({ status: "paid", amount: 649050 });
    expect(isPaidStatus(r.status)).toBe(true);
    expect(isPaidStatus("pending")).toBe(false);
    expect(isPaidStatus("expired")).toBe(false);
    expect(isPaidStatus("refunded")).toBe(false);
  });

  it("teste da chave consulta a lista de vendas sem gerar cobrança", async () => {
    const fetchMock = vi.fn(async () => json({ data: [] }));
    vi.stubGlobal("fetch", fetchMock);
    const { testSagacePayKey } = await import("@/lib/sagacepay.server");
    await expect(testSagacePayKey()).resolves.toMatchObject({ ok: true });
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toContain("/sales?page=1&limit=1");
  });
});
