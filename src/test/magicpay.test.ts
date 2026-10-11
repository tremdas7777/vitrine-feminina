import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// private_settings: o painel escolheu a MagicPay; chaves vêm dos secrets.
vi.mock("@/integrations/supabase/client.server", () => {
  let key = "";
  const chain = {
    select: () => chain,
    eq: (_c: string, v: string) => ((key = v), chain),
    in: () => Promise.resolve({ data: [] }),
    maybeSingle: async () => ({ data: key === "pix_gateway" ? { value: "magicpay" } : null }),
  };
  return { supabaseAdmin: { from: () => chain } };
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("MagicPay como gateway escolhido", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env["MAGICPAY_PUBLIC_KEY"] = "pk_teste_publica_123";
    process.env["MAGICPAY_SECRET_KEY"] = "sk_teste_secreta_123";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env["MAGICPAY_PUBLIC_KEY"];
    delete process.env["MAGICPAY_SECRET_KEY"];
  });

  it("gera o Pix na MagicPay em centavos, com Basic auth, prefixo mp_ e webhook ?gw=mp", async () => {
    const fetchMock = vi.fn(async () =>
      json({ data: { id: "mp123", status: "waiting_payment", pix: { qrcode: "000201mp" } } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { createPix } = await import("@/lib/pix-gateway.server");
    const pix = await createPix({
      amount: 9990,
      customer: { name: "Ana", email: "a@b.com", phone: "5511999999999", cpf: "529.982.247-25" },
      description: "Pedido Vitrine Feminina",
      origin: "https://loja.com.br/checkout",
      address: {
        street: "Rua A",
        number: "10",
        neighborhood: "Centro",
        city: "São Paulo",
        state: "sp",
        zipcode: "01310100",
      },
    });
    expect(pix).toEqual({ id: "mp_mp123", qrcode: "000201mp", status: "waiting_payment" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.dashboardmagicpay.com/v1/transactions");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(
      `Basic ${btoa("pk_teste_publica_123:sk_teste_secreta_123")}`,
    );
    const body = JSON.parse(String(init.body));
    expect(body.amount).toBe(9990);
    expect(body.paymentMethod).toBe("pix");
    expect(body.postbackUrl).toBe("https://loja.com.br/api/public/pix-webhook?gw=mp");
    expect(body.customer.document).toEqual({ type: "cpf", number: "52998224725" });
    expect(body.customer.phone).toBe("11999999999");
    expect(body.customer.address.state).toBe("SP");
  });

  it("consulta o pedido mp_ na MagicPay; 'approved' conta como pago", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ data: { id: "mp123", status: "approved", amount: 9990 } })),
    );
    const { fetchGatewayStatus, isPaidStatus } = await import("@/lib/pix-orders.server");
    const r = await fetchGatewayStatus("mp_mp123");
    expect(r).toEqual({ status: "paid", amount: 9990 });
    expect(isPaidStatus(r.status)).toBe(true);
  });
});
