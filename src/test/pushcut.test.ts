import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: () => ({}) } }));

import { isPushcutUrl, notifyPushcut, pushcutMessage } from "@/lib/pushcut.server";

const URLS = {
  pending: "https://api.pushcut.io/abc123/notifications/Venda%20pendente",
  paid: "https://api.pushcut.io/abc123/notifications/Venda%20paga",
};

describe("Pushcut", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("a notificação leva o valor da venda", () => {
    const paid = pushcutMessage("paid", {
      amountCents: 9990,
      orderId: "mp_abcdef123456",
    });
    expect(paid.title).toBe("Venda aprovada: R$ 99,90");
    expect(paid.text).toContain("R$ 99,90");
    expect(paid.text).not.toMatch(/Kit|aparelho/);
    expect(paid.text).toContain("EF123456");
    expect(paid.input).toBe("99.90");
    const pending = pushcutMessage("pending", {
      amountCents: 6990,
      orderId: "x1",
    });
    expect(pending.title).toBe("Pix gerado: R$ 69,90");
    expect(pending.text).toContain("aguardando pagamento");
  });

  it("só aceita URL de notificação do Pushcut", () => {
    expect(isPushcutUrl(URLS.paid)).toBe(true);
    expect(isPushcutUrl("https://exemplo.com/notifications/x")).toBe(false);
    expect(isPushcutUrl("http://api.pushcut.io/a/notifications/x")).toBe(false);
  });

  it("manda venda paga para o webhook de venda paga e pendente para o de pendente", async () => {
    const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await notifyPushcut("paid", { amountCents: 9990, orderId: "1" }, URLS);
    await notifyPushcut("pending", { amountCents: 6990, orderId: "2" }, URLS);
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toBe(URLS.paid);
    expect(String((fetchMock.mock.calls[1] as unknown[])[0])).toBe(URLS.pending);
    const body = JSON.parse(
      String(((fetchMock.mock.calls[0] as unknown[])[1] as RequestInit).body),
    );
    expect(body.input).toBe("99.90");
  });

  it("com um só webhook, ele recebe os dois avisos; sem nenhum, não envia nada", async () => {
    const fetchMock = vi.fn(async () => new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);
    await notifyPushcut(
      "paid",
      { amountCents: 100, orderId: "1" },
      { pending: URLS.pending, paid: "" },
    );
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toBe(URLS.pending);
    const r = await notifyPushcut(
      "paid",
      { amountCents: 100, orderId: "1" },
      { pending: "", paid: "" },
    );
    expect(r.skipped).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falha no Pushcut não lança erro (não atrapalha a venda)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("rede caiu");
      }),
    );
    const r = await notifyPushcut("paid", { amountCents: 100, orderId: "1" }, URLS);
    expect(r.ok).toBe(false);
  });
});
