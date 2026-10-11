// PixGate: pagamentos via Pix. Somente servidor.
// Chave cadastrada no /admin (private_settings, só service role). O secret PIXGATE_API_KEY do
// Lovable serve de reserva.
export const PIXGATE_API = "https://app.pixgateip.com/api";

const KEY = "pixgate_api_key";
// A tela do pedido consulta o status a cada poucos segundos: guarda a chave por 1 minuto.
const CACHE_MS = 60_000;
let cache: { value: string | null; at: number } | null = null;

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Chave salva no /admin (se houver). */
async function savedKey(): Promise<string | null> {
  const { data } = await (
    await db()
  )
    .from("private_settings")
    .select("value")
    .eq("key", KEY)
    .maybeSingle();
  return (data?.value as string | null) || null;
}

/** Chave em uso: a do /admin ou, sem ela, o secret do Lovable. */
export async function getPixgateKey(): Promise<string | null> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  const value = (await savedKey()) || process.env["PIXGATE_API_KEY"] || null;
  cache = { value, at: Date.now() };
  return value;
}

/** De onde vem a chave em uso (para mostrar no /admin). */
export async function getPixgateKeySource(): Promise<{
  key: string | null;
  source: "admin" | "secret" | null;
}> {
  const saved = await savedKey();
  if (saved) return { key: saved, source: "admin" };
  const env = process.env["PIXGATE_API_KEY"] || null;
  return { key: env, source: env ? "secret" : null };
}

export async function savePixgateKey(value: string): Promise<void> {
  const { error } = await (
    await db()
  )
    .from("private_settings")
    .upsert({ key: KEY, value, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  cache = null;
}

export async function deletePixgateKey(): Promise<void> {
  const { error } = await (await db()).from("private_settings").delete().eq("key", KEY);
  if (error) throw new Error(error.message);
  cache = null;
}

/**
 * Testa a chave sem criar cobrança: consulta um Pix inexistente.
 * 401/403 ("Client id inválido") = chave recusada; qualquer outra resposta = chave aceita.
 */
export async function testPixgateKey(): Promise<{
  ok: boolean;
  status?: number | undefined;
  error?: string | undefined;
}> {
  const key = await getPixgateKey();
  if (!key) return { ok: false, error: "Nenhuma chave cadastrada" };
  try {
    const res = await fetch(`${PIXGATE_API}/stats/00000000-0000-0000-0000-000000000000`, {
      headers: { Apikey: key, Accept: "application/json" },
    });
    if (res.status === 401 || res.status === 403)
      return { ok: false, status: res.status, error: "Chave recusada pela PixGate" };
    return { ok: res.status < 500, status: res.status };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha de conexão" };
  }
}

async function pixgateKeyOrThrow(): Promise<string> {
  const key = await getPixgateKey();
  if (!key) throw new Error("Pagamento indisponível no momento.");
  return key;
}

/** Gera a cobrança Pix na PixGate (POST /v1/cashin). Valor em centavos; a PixGate recebe reais. */
export async function pixgateCashin(o: {
  amountCents: number;
  customer: { name: string; cpf: string };
  description: string;
  postbackUrl: string;
}): Promise<{ id: string; qrcode: string; status: string }> {
  const valor = Number((o.amountCents / 100).toFixed(2));
  const res = await fetch(`${PIXGATE_API}/v1/cashin`, {
    method: "POST",
    headers: {
      Apikey: await pixgateKeyOrThrow(),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      nome: o.customer.name,
      cpf: o.customer.cpf,
      valor,
      descricao: o.description,
      postback: o.postbackUrl,
    }),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- resposta do gateway sem tipo
  const json = (await res.json().catch(() => null)) as any;
  const txId = json?.id;
  const qrcode = json?.pix;
  if (!res.ok || !txId || !qrcode) {
    console.error("PixGate error", res.status, JSON.stringify(json)?.slice(0, 500));
    throw new Error("Não foi possível gerar o Pix. Confira seus dados e tente novamente.");
  }
  return {
    id: String(txId),
    qrcode: String(qrcode),
    status: String(json?.status ?? "pending").toLowerCase(),
  };
}

/** Status real na PixGate (GET /stats/:id). Valor devolvido em centavos. */
export async function pixgateStatus(id: string): Promise<{ status: string; amount: number }> {
  const res = await fetch(`${PIXGATE_API}/stats/${encodeURIComponent(id)}`, {
    headers: { Apikey: await pixgateKeyOrThrow(), Accept: "application/json" },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- resposta do gateway sem tipo
  const json = (await res.json().catch(() => null)) as any;
  // Só status e nomes dos campos no log (sem dados pessoais), para auditar a regra de "pago".
  console.log(
    "pixgate-status",
    id,
    JSON.stringify(json?.status),
    Object.keys(json ?? {}).join(","),
  );
  return {
    status: String(json?.status ?? "pending").toLowerCase(),
    amount: Math.round(Number(json?.value ?? 0) * 100),
  };
}
