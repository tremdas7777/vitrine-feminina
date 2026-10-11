// Notificações de venda no celular pelo Pushcut. Somente servidor.
// Duas URLs de notificação (cadastradas no /admin, guardadas em private_settings):
// - "pending": Pix gerado (aguardando pagamento)
// - "paid": Pix pago (venda aprovada)
// Se só uma URL estiver cadastrada, ela recebe os dois avisos.
import { brl } from "@/lib/shipping";

export type PushcutKind = "pending" | "paid";

const KEYS: Record<PushcutKind, string> = {
  pending: "pushcut_pending_url",
  paid: "pushcut_paid_url",
};

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Só aceita URLs de notificação do próprio Pushcut (evita mandar dados de venda para outro lugar). */
export function isPushcutUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return (
      u.protocol === "https:" &&
      u.hostname === "api.pushcut.io" &&
      u.pathname.includes("/notifications/")
    );
  } catch {
    return false;
  }
}

export async function getPushcutUrls(): Promise<Record<PushcutKind, string>> {
  const { data } = await (
    await db()
  )
    .from("private_settings")
    .select("key,value")
    .in("key", Object.values(KEYS));
  const map = new Map((data ?? []).map((r: { key: string; value: unknown }) => [r.key, r.value]));
  return {
    pending: String(map.get(KEYS.pending) ?? "").trim(),
    paid: String(map.get(KEYS.paid) ?? "").trim(),
  };
}

/** Salva as URLs (vazio = apaga aquela URL). */
export async function savePushcutUrls(urls: Record<PushcutKind, string>): Promise<void> {
  const client = await db();
  const now = new Date().toISOString();
  for (const kind of ["pending", "paid"] as const) {
    const value = urls[kind].trim();
    if (value && !isPushcutUrl(value)) {
      throw new Error(
        "Use a URL de notificação do Pushcut (https://api.pushcut.io/.../notifications/...).",
      );
    }
    const { error } = value
      ? await client.from("private_settings").upsert({ key: KEYS[kind], value, updated_at: now })
      : await client.from("private_settings").delete().eq("key", KEYS[kind]);
    if (error) throw new Error(error.message);
  }
}

/** URL usada para cada aviso: a própria ou, sem ela, a outra. */
const urlFor = (urls: Record<PushcutKind, string>, kind: PushcutKind) =>
  kind === "paid" ? urls.paid || urls.pending : urls.pending || urls.paid;

/** Texto da notificação, sempre com o valor da venda. */
export function pushcutMessage(
  kind: PushcutKind,
  o: { amountCents: number; orderId: string },
) {
  const value = brl(o.amountCents / 100);
  const order = o.orderId
    .replace(/^(pg_|mp_)/, "")
    .slice(-8)
    .toUpperCase();
  return {
    title: kind === "paid" ? `Venda aprovada: ${value}` : `Pix gerado: ${value}`,
    text:
      kind === "paid"
        ? `${value} · pedido ${order}`
        : `${value} aguardando pagamento · pedido ${order}`,
    // Valor numérico (ex.: "99.90") para usar em automações do Pushcut.
    input: (o.amountCents / 100).toFixed(2),
  };
}

export type PushcutResult = { ok: boolean; skipped?: string; status?: number; error?: string };

/** Envia a notificação. Nunca lança erro: falha no Pushcut não pode atrapalhar a venda. */
export async function notifyPushcut(
  kind: PushcutKind,
  o: { amountCents: number; orderId: string },
  urls?: Record<PushcutKind, string>,
): Promise<PushcutResult> {
  try {
    const url = urlFor(urls ?? (await getPushcutUrls()), kind);
    if (!url) return { ok: true, skipped: "Pushcut sem URL" };
    if (!isPushcutUrl(url)) return { ok: false, error: "URL do Pushcut inválida" };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(url, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pushcutMessage(kind, o)),
      });
      return res.ok
        ? { ok: true, status: res.status }
        : { ok: false, status: res.status, error: (await res.text()).slice(0, 200) };
    } finally {
      clearTimeout(timer);
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha de rede" };
  }
}
