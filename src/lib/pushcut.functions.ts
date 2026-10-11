import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const pw = z.object({ password: z.string().min(1).max(200) });

function assertAdmin(password: string) {
  if (password !== process.env["ADMIN_PASSWORD"]) throw new Error("Não autorizado");
}

/** A URL do Pushcut tem um token secreto no caminho: mostra só o começo e o fim. */
function mask(url: string): string | null {
  if (!url) return null;
  return url.length <= 40 ? `${url.slice(0, 28)}…` : `${url.slice(0, 34)}…${url.slice(-6)}`;
}

/** URLs cadastradas (mascaradas). */
export const getPushcutStatus = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => pw.parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    const { getPushcutUrls } = await import("@/lib/pushcut.server");
    const urls = await getPushcutUrls();
    return { pending: mask(urls.pending), paid: mask(urls.paid) };
  });

/** Salva as URLs. Campo vazio mantém a URL atual; `clear` apaga as duas. */
export const savePushcutFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    pw
      .extend({
        pending: z.string().trim().max(500).default(""),
        paid: z.string().trim().max(500).default(""),
        clear: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    const { getPushcutUrls, savePushcutUrls } = await import("@/lib/pushcut.server");
    if (data.clear) {
      await savePushcutUrls({ pending: "", paid: "" });
      return { ok: true };
    }
    const cur = await getPushcutUrls();
    await savePushcutUrls({
      pending: data.pending || cur.pending,
      paid: data.paid || cur.paid,
    });
    return { ok: true };
  });

/** Envia uma notificação de teste (valor de exemplo), sem criar pedido. */
export const testPushcutFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => pw.extend({ kind: z.enum(["pending", "paid"]) }).parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    const { notifyPushcut } = await import("@/lib/pushcut.server");
    return notifyPushcut(data.kind, {
      amountCents: 9990,
      orderId: "TESTE123",
    });
  });
