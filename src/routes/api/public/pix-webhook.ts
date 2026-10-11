import { createFileRoute } from "@tanstack/react-router";

// Notificação dos gateways de Pix:
// - SagacePay: { event: "sale.paid", data: { id, ... } }
// - PixGate: chega com ?gw=pg e o id da transação; o pedido é salvo com prefixo "pg_".
// - MagicPay: chega com ?gw=mp e o id da transação; o pedido é salvo com prefixo "mp_".
// O corpo não é confiável: usamos só o id e sempre confirmamos o status na API autenticada do
// gateway antes de reportar a venda.
export const Route = createFileRoute("/api/public/pix-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- corpo do gateway sem tipo
        const body = (await request.json().catch(() => null)) as any;
        const gw = new URL(request.url).searchParams.get("gw");
        const isPixgate = gw === "pg";
        const isMagicpay = gw === "mp";
        const rawId = isPixgate
          ? (body?.transaction_id ?? body?.id ?? body?.transaction?.id ?? body?.data?.id)
          : isMagicpay
            ? (body?.data?.id ?? body?.id ?? body?.objectId ?? body?.transactionId)
            : (body?.data?.id ?? body?.id ?? body?.sale?.id);
        const prefix = isPixgate ? "pg_" : isMagicpay ? "mp_" : "";
        const id = rawId == null ? "" : `${prefix}${String(rawId)}`;
        console.log("pix-webhook", gw ?? "sagacepay", body?.event ?? body?.type, id);
        if (!/^[\w-]{1,64}$/.test(id)) return Response.json({ ok: true });
        try {
          const { fetchGatewayStatus, reportPaidOnce, isPaidStatus } =
            await import("@/lib/pix-orders.server");
          const { status, amount } = await fetchGatewayStatus(id);
          if (isPaidStatus(status)) await reportPaidOnce(id, amount);
        } catch (e) {
          console.error("pix-webhook failed", e);
        }
        return Response.json({ ok: true });
      },
    },
  },
});
