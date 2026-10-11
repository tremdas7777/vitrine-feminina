import { createServerFn } from "@tanstack/react-start";
import { isPaidStatus } from "@/lib/pix-status";

function normalizeCpf(input: string): string {
  return (input || "").replace(/\D/g, "").slice(0, 11);
}

function isValidCpf(cpf: string): boolean {
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  return true;
}

/** Etapas que a loja conhece de fato; daí em diante, quem informa é a transportadora. */
export type RastreioStatus = "aguardando_pagamento" | "em_preparacao" | "postado";

export type RastreioResult =
  | { found: false }
  | {
      found: true;
      pedido: string;
      status: RastreioStatus;
      data_pedido: string;
      tracking_code: string | null;
      tracking_url: string | null;
    };

type OrderRow = {
  id: string;
  status: string;
  created_at: string;
  customer: { upsellOf?: string; testOf?: string } | null;
  report_result: {
    rastro?: { ok?: boolean; trackingCode?: string; trackingUrl?: string };
  } | null;
};

/** Consulta o pedido mais recente do CPF (só pedidos reais da loja — nada é criado aqui). */
export const trackByCpf = createServerFn({ method: "POST" })
  .inputValidator((input: { cpf: string }) => input)
  .handler(async ({ data }): Promise<RastreioResult> => {
    const cpf = normalizeCpf(data.cpf);
    if (!isValidCpf(cpf)) {
      throw new Error("CPF inválido. Digite os 11 números.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("pix_orders")
      .select("id, status, created_at, customer, report_result")
      .filter("customer->>cpf", "eq", cpf)
      .order("created_at", { ascending: false })
      .limit(20);

    // Pedido principal (sem upsells nem cobranças de teste): o pago mais recente; senão, o mais recente.
    const orders = ((rows ?? []) as unknown as OrderRow[]).filter(
      (o) => !o.customer?.upsellOf && !o.customer?.testOf,
    );
    const order = orders.find((o) => isPaidStatus(o.status)) ?? orders[0];
    if (!order) return { found: false };

    const rastro = order.report_result?.rastro;
    const trackingCode = rastro?.ok ? (rastro.trackingCode ?? null) : null;
    const trackingUrl = rastro?.ok ? (rastro.trackingUrl ?? null) : null;
    const status: RastreioStatus = !isPaidStatus(order.status)
      ? "aguardando_pagamento"
      : trackingCode
        ? "postado"
        : "em_preparacao";

    return {
      found: true,
      pedido: order.id.slice(-8).toUpperCase(),
      status,
      data_pedido: order.created_at,
      tracking_code: trackingCode,
      tracking_url: trackingUrl,
    };
  });
