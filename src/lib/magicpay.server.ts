// Gateway Pix MagicPay. Somente servidor.
// Duas chaves (pública pk_… e secreta sk_…), autenticação Basic. Cadastradas no /admin
// (private_settings, só service role); os secrets MAGICPAY_PUBLIC_KEY / MAGICPAY_SECRET_KEY do
// Lovable servem de reserva. Nunca coloque chaves no código.
export const MAGICPAY_API = (process.env["MAGICPAY_API_URL"] || "https://api.dashboardmagicpay.com")
  .trim()
  .replace(/\/$/, "");

const PUBLIC = "magicpay_public_key";
const SECRET = "magicpay_secret_key";
const CACHE_MS = 60_000;
let cache: { value: MagicPayKeys | null; at: number } | null = null;

export type MagicPayKeys = { publicKey: string; secretKey: string };

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function savedKeys(): Promise<MagicPayKeys | null> {
  const { data } = await (
    await db()
  )
    .from("private_settings")
    .select("key,value")
    .in("key", [PUBLIC, SECRET]);
  const map = new Map((data ?? []).map((r: { key: string; value: unknown }) => [r.key, r.value]));
  const publicKey = String(map.get(PUBLIC) ?? "").trim();
  const secretKey = String(map.get(SECRET) ?? "").trim();
  return publicKey && secretKey ? { publicKey, secretKey } : null;
}

function envKeys(): MagicPayKeys | null {
  const publicKey = (process.env["MAGICPAY_PUBLIC_KEY"] || "").trim();
  const secretKey = (process.env["MAGICPAY_SECRET_KEY"] || "").trim();
  return publicKey && secretKey ? { publicKey, secretKey } : null;
}

/** Chaves em uso: as do /admin ou, sem elas, os secrets do Lovable. */
export async function getMagicPayKeys(): Promise<MagicPayKeys | null> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  const value = (await savedKeys()) || envKeys();
  cache = { value, at: Date.now() };
  return value;
}

/** De onde vêm as chaves em uso (para mostrar no /admin). */
export async function getMagicPayKeySource(): Promise<{
  key: string | null;
  source: "admin" | "secret" | null;
}> {
  const saved = await savedKeys();
  if (saved) return { key: saved.secretKey, source: "admin" };
  const env = envKeys();
  return { key: env?.secretKey ?? null, source: env ? "secret" : null };
}

export async function saveMagicPayKeys(k: MagicPayKeys): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await (await db()).from("private_settings").upsert([
    { key: PUBLIC, value: k.publicKey.trim(), updated_at: now },
    { key: SECRET, value: k.secretKey.trim(), updated_at: now },
  ]);
  if (error) throw new Error(error.message);
  cache = null;
}

export async function deleteMagicPayKeys(): Promise<void> {
  const { error } = await (
    await db()
  )
    .from("private_settings")
    .delete()
    .in("key", [PUBLIC, SECRET]);
  if (error) throw new Error(error.message);
  cache = null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- resposta do gateway sem tipo
type Json = Record<string, any>;

async function request(path: string, init?: RequestInit, keys?: MagicPayKeys | null) {
  const k = keys ?? (await getMagicPayKeys());
  if (!k) throw new Error("Pagamento indisponível no momento.");
  const auth = btoa(`${k.publicKey}:${k.secretKey}`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(`${MAGICPAY_API}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    const raw = await res.text();
    let data: Json = {};
    try {
      data = raw ? (JSON.parse(raw) as Json) : {};
    } catch {
      data = { message: raw };
    }
    return { ok: res.ok, status: res.status, data };
  } finally {
    clearTimeout(timer);
  }
}

/** A API às vezes devolve a transação dentro de "data". */
const unwrap = (d: Json): Json => (d?.data && (d.data.id || d.data.status) ? d.data : d);

/** Código Pix copia-e-cola (a MagicPay usa nomes de campo diferentes conforme a versão). */
function pixCode(d: Json): string {
  const c = [
    d?.pix?.qrcode,
    d?.pix?.qrCode,
    d?.pix?.emv,
    d?.pix?.copyPaste,
    d?.pix?.copy_paste,
    d?.pix?.payload,
    d?.qrcode,
    d?.qrCode,
    d?.emv,
  ].map((v) => String(v ?? "").trim());
  return c.find((v) => v.startsWith("000201")) ?? c.find(Boolean) ?? "";
}

/**
 * Status da MagicPay no vocabulário da loja. "approved" na MagicPay é Pix pago: vira "paid"
 * (a regra única de "pago" fica em pix-status.ts e não aceita "approved" por causa da PixGate).
 */
function normalizeStatus(s: unknown): string {
  const v = String(s ?? "pending")
    .trim()
    .toLowerCase();
  return v === "approved" || v === "aprovado" ? "paid" : v;
}

const onlyDigits = (v: unknown) => String(v ?? "").replace(/\D/g, "");

export type MagicPayAddress = {
  street: string;
  number: string;
  complement?: string | undefined;
  neighborhood: string;
  city: string;
  state: string;
  zipcode: string;
};

/** Gera a cobrança Pix (POST /v1/transactions). Valor em centavos (a MagicPay usa centavos). */
export async function magicpayCashin(o: {
  amountCents: number;
  customer: { name: string; cpf: string; email?: string; phone?: string };
  address?: MagicPayAddress | undefined;
  description: string;
  postbackUrl: string;
  externalRef: string;
  ip?: string | null | undefined;
}): Promise<{ id: string; qrcode: string; status: string }> {
  const doc = onlyDigits(o.customer.cpf);
  const phone = onlyDigits(o.customer.phone);
  const a = o.address;
  const res = await request("/v1/transactions", {
    method: "POST",
    body: JSON.stringify({
      amount: o.amountCents,
      currency: "BRL",
      paymentMethod: "pix",
      description: o.description,
      externalRef: o.externalRef,
      ...(o.ip ? { ip: o.ip } : {}),
      postbackUrl: o.postbackUrl,
      customer: {
        name: o.customer.name,
        email: o.customer.email ?? "",
        phone: phone.startsWith("55") && phone.length >= 12 ? phone.slice(2) : phone,
        document: { type: doc.length === 14 ? "cnpj" : "cpf", number: doc },
        ...(a
          ? {
              address: {
                street: a.street,
                streetNumber: a.number,
                complement: a.complement ?? "",
                zipCode: onlyDigits(a.zipcode),
                neighborhood: a.neighborhood,
                city: a.city,
                state: a.state.slice(0, 2).toUpperCase(),
                country: "BR",
              },
            }
          : {}),
      },
      items: [
        {
          title: o.description,
          quantity: 1,
          unitPrice: o.amountCents,
          tangible: true,
          externalRef: o.externalRef,
        },
      ],
    }),
  });
  const d = unwrap(res.data);
  const txId = String(d?.id ?? d?.transactionId ?? "").trim();
  const qrcode = pixCode(d);
  if (!res.ok || !txId || !qrcode) {
    console.error("MagicPay error", res.status, JSON.stringify(res.data)?.slice(0, 500));
    throw new Error("Não foi possível gerar o Pix. Confira seus dados e tente novamente.");
  }
  return { id: txId, qrcode, status: normalizeStatus(d?.status) };
}

/** Status real da transação (GET /v1/transactions/:id). Valor em centavos. */
export async function magicpayStatus(id: string): Promise<{ status: string; amount: number }> {
  const res = await request(`/v1/transactions/${encodeURIComponent(id)}`);
  const d = unwrap(res.data);
  console.log("magicpay-status", id, res.status, JSON.stringify(d?.status));
  if (!res.ok) throw new Error(`MagicPay HTTP ${res.status}`);
  return { status: normalizeStatus(d?.status), amount: Math.round(Number(d?.amount ?? 0)) };
}

/** Testa as chaves sem criar cobrança (GET /v1/transactions?limit=1). */
export async function testMagicPayKeys(): Promise<{
  ok: boolean;
  status?: number | undefined;
  error?: string | undefined;
}> {
  const keys = await getMagicPayKeys();
  if (!keys) return { ok: false, error: "Nenhuma chave cadastrada" };
  try {
    const res = await request("/v1/transactions?page=1&limit=1", { method: "GET" }, keys);
    if (res.status === 401 || res.status === 403)
      return { ok: false, status: res.status, error: "Chaves recusadas pela MagicPay" };
    if (res.ok || res.status === 404) return { ok: true, status: res.status };
    return {
      ok: false,
      status: res.status,
      error: String(res.data?.message ?? res.data?.error ?? `HTTP ${res.status}`).slice(0, 200),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha de conexão" };
  }
}
