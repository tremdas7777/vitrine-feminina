// Gateway do Pix escolhido no /admin: SagacePay (padrão), PixGate ou MagicPay. Somente servidor.
// A escolha vale para os próximos Pix. Cada pedido guarda no id qual gateway gerou o Pix
// (PixGate "pg_", MagicPay "mp_", SagacePay sem prefixo), então a consulta de status e o webhook
// continuam no gateway certo mesmo depois de uma troca.
import { getPixgateKey, pixgateCashin, pixgateStatus } from "@/lib/pixgate.server";
import {
  getMagicPayKeys,
  magicpayCashin,
  magicpayStatus,
  type MagicPayAddress,
} from "@/lib/magicpay.server";
import { getSagacePayKey, sagaceCashin, sagaceStatus } from "@/lib/sagacepay.server";

export const PIX_GATEWAYS = ["sagacepay", "pixgate", "magicpay"] as const;
export type PixGateway = (typeof PIX_GATEWAYS)[number];
export const PIX_GATEWAY_LABEL: Record<PixGateway, string> = {
  sagacepay: "SagacePay",
  pixgate: "PixGate",
  magicpay: "MagicPay",
};

/** Pedidos da PixGate são guardados com este prefixo (os da SagacePay ficam sem prefixo). */
export const PIXGATE_ORDER_PREFIX = "pg_";
export const isPixgateOrderId = (id: string) => id.startsWith(PIXGATE_ORDER_PREFIX);
/** Pedidos da MagicPay são guardados com este prefixo. */
export const MAGICPAY_ORDER_PREFIX = "mp_";
export const isMagicpayOrderId = (id: string) => id.startsWith(MAGICPAY_ORDER_PREFIX);

const SETTING = "pix_gateway";
const DEFAULT_GATEWAY: PixGateway = "sagacepay";

export type PixCustomer = { name: string; email: string; phone: string; cpf: string };

/** O Pix expira em 30 minutos (mesmo prazo mostrado no checkout). */
export const PIX_EXPIRES_IN_SECONDS = 30 * 60;

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const isGateway = (v: unknown): v is PixGateway => PIX_GATEWAYS.includes(v as PixGateway);

/** Gateway escolhido no /admin (null = nunca escolhido). Sem cache: a troca vale na hora. */
async function savedChoice(): Promise<PixGateway | null> {
  const { data } = await (
    await db()
  )
    .from("private_settings")
    .select("value")
    .eq("key", SETTING)
    .maybeSingle();
  return isGateway(data?.value) ? data.value : null;
}

/** Quais gateways têm chave cadastrada (painel ou secret do Lovable). */
async function configured(): Promise<Record<PixGateway, boolean>> {
  const [sagacepay, pixgate, magicpay] = await Promise.all([
    getSagacePayKey().catch(() => null),
    getPixgateKey().catch(() => null),
    getMagicPayKeys().catch(() => null),
  ]);
  return { sagacepay: !!sagacepay, pixgate: !!pixgate, magicpay: !!magicpay };
}

/**
 * Gateway que gera os próximos Pix: o escolhido no /admin (padrão: SagacePay). Se o escolhido
 * estiver sem chave e outro tiver, usa o outro para o checkout não parar.
 */
export async function getPixGatewayState(): Promise<{
  selected: PixGateway;
  active: PixGateway;
  configured: Record<PixGateway, boolean>;
}> {
  const [choice, keys] = await Promise.all([savedChoice(), configured()]);
  const selected = choice ?? DEFAULT_GATEWAY;
  // Escolhido sem chave: usa o primeiro outro gateway que tenha chave, para o checkout não parar.
  const fallback = PIX_GATEWAYS.find((g) => g !== selected && keys[g]);
  const active = !keys[selected] && fallback ? fallback : selected;
  return { selected, active, configured: keys };
}

export async function savePixGateway(gateway: PixGateway): Promise<void> {
  const keys = await configured();
  if (!keys[gateway]) {
    throw new Error(`Cadastre a chave da ${PIX_GATEWAY_LABEL[gateway]} antes de ativá-la.`);
  }
  const { error } = await (
    await db()
  )
    .from("private_settings")
    .upsert({ key: SETTING, value: gateway, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

/** Gera a cobrança Pix no gateway ativo. Valor em centavos. O id devolvido já vem com o prefixo. */
export async function createPix(o: {
  amount: number;
  customer: PixCustomer;
  /** Nome genérico enviado ao gateway, sem detalhes do produto real. */
  description: string;
  origin: string;
  /** Endereço por partes (a MagicPay pede; os outros ignoram). */
  address?: MagicPayAddress | undefined;
  ip?: string | null | undefined;
}): Promise<{ id: string; qrcode: string; status: string }> {
  const { active } = await getPixGatewayState();
  const webhook = `${new URL(o.origin).origin}/api/public/pix-webhook`;
  if (active === "pixgate") {
    const tx = await pixgateCashin({
      amountCents: o.amount,
      customer: o.customer,
      description: o.description,
      postbackUrl: `${webhook}?gw=pg`,
    });
    return { ...tx, id: `${PIXGATE_ORDER_PREFIX}${tx.id}` };
  }
  if (active === "magicpay") {
    const tx = await magicpayCashin({
      amountCents: o.amount,
      customer: o.customer,
      address: o.address,
      description: o.description,
      postbackUrl: `${webhook}?gw=mp`,
      externalRef: crypto.randomUUID(),
      ip: o.ip,
    });
    return { ...tx, id: `${MAGICPAY_ORDER_PREFIX}${tx.id}` };
  }
  return sagaceCashin({
    amountCents: o.amount,
    customer: o.customer,
    description: o.description,
    postbackUrl: webhook,
    externalId: crypto.randomUUID(),
    expiresInSeconds: PIX_EXPIRES_IN_SECONDS,
  });
}

/** Status real de um pedido no gateway que gerou o Pix. Valor em centavos. */
export async function fetchPixStatus(id: string): Promise<{ status: string; amount: number }> {
  if (isPixgateOrderId(id)) return pixgateStatus(id.slice(PIXGATE_ORDER_PREFIX.length));
  if (isMagicpayOrderId(id)) return magicpayStatus(id.slice(MAGICPAY_ORDER_PREFIX.length));
  return sagaceStatus(id);
}
