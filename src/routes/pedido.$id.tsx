import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Copy, Loader2 } from "lucide-react";
import pixWaiting from "@/assets/pix-waiting.png";
import { getPixStatus } from "@/lib/pix.functions";
import { loadPixSession, savePixSession, type PixSession } from "@/lib/pix-session";
import { trackCheckoutClick } from "@/lib/analytics";
import { useCart } from "@/hooks/useCart";
import { brl } from "@/components/checkout/parts";
import { Pill, Shell } from "@/components/checkout/OrderShell";

export const Route = createFileRoute("/pedido/$id")({
  head: () => ({
    meta: [{ title: "Pedido | Vitrine Feminina" }, { name: "robots", content: "noindex" }],
  }),
  component: Page,
});

const EXPIRES_MS = 30 * 60 * 1000;

type DataLayerWindow = Window & {
  dataLayer?: Array<Record<string, unknown>>;
  fbq?: (...args: unknown[]) => void;
  ttq?: { track: (event: string, data?: Record<string, unknown>) => void };
};

/** Status finais do gateway (além de "paid"): param a consulta automática. */
const FINAL = ["failed", "refunded", "expired"];

function Page() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [session] = useState<PixSession | null>(() => loadPixSession(id));
  const statusFn = useServerFn(getPixStatus);
  const cart = useCart();

  const { data } = useQuery({
    queryKey: ["pix-status", id],
    queryFn: () =>
      statusFn({
        data: {
          id,
          report:
            session?.phone && session.cpf
              ? {
                  name: session.name,
                  email: session.email,
                  phone: session.phone,
                  cpf: session.cpf,
                  bundleId: session.bundleId,
                  bundleName: session.bundleName,
                  createdAt: session.createdAt,
                  utm: session.utm ?? {},
                  fbp: session.fbp ?? null,
                  fbc: session.fbc ?? null,
                  url: window.location.href,
                }
              : undefined,
        },
      }),
    // Para de consultar quando o gateway dá uma resposta final (pago, expirado ou recusado).
    refetchInterval: (q) =>
      q.state.data?.paid || FINAL.includes(q.state.data?.status ?? "") ? false : 5000,
    enabled: !!id,
  });

  const status = data?.status ?? "waiting_payment";
  // "paid" vem do servidor (regra única em src/lib/pix-status.ts) — o navegador não decide.
  const paid = data?.paid === true;
  const refused = [
    "failed",
    "refused",
    "canceled",
    "cancelled",
    "chargedback",
    "refunded",
  ].includes(status);

  // Dispara os eventos de compra uma única vez quando o pagamento cai.
  useEffect(() => {
    if (!paid) return;
    const value = (session?.amount ?? 0) / 100;
    const w = window as DataLayerWindow;
    try {
      // Purchase do Meta: sai na tela de obrigado, com o valor do pedido + ofertas pós-compra.
      w.ttq?.track("CompletePayment", { value, currency: "BRL" });
      w.dataLayer?.push({ event: "purchase", currency: "BRL", value });
    } catch {
      // pixels indisponíveis
    }
    if (session) {
      trackCheckoutClick({
        source: "pix_paid",
        bundleId: session.bundleId,
        bundleName: session.bundleName,
        value,
      });
    }
    // Pedido pago: a sacola já virou pedido.
    if (session && !session.isUpsell) cart.clear();
    // Pedido principal pago → ofertas (item extra/seguro); ofertas pagas → página do envio expresso;
    // envio expresso pago (ou sem sessão) → obrigado.
    if (session && !session.isUpsell)
      navigate({ to: "/upsell/$id", params: { id }, replace: true });
    else if (session?.isUpsell && session.parentId) {
      const express = !!session.upsellItems?.includes("expresso");
      const main = loadPixSession(session.parentId);
      if (main) savePixSession({ ...main, ...(express ? { expressId: id } : { upsellId: id }) });
      if (!express && main)
        navigate({ to: "/expresso/$id", params: { id: session.parentId }, replace: true });
      else navigate({ to: "/obrigado/$id", params: { id }, replace: true });
    } else navigate({ to: "/obrigado/$id", params: { id }, replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paid]);

  if (paid)
    return (
      <Shell>
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--ck-ok)]" />
        </div>
      </Shell>
    );
  if (refused) return <Refused />;
  if (status === "expired") return <Expired />;
  return <WaitingPix session={session} />;
}

/** Tela "Quase lá..." — igual à do checkout antigo enquanto o Pix não cai. */
function WaitingPix({ session }: { session: PixSession | null }) {
  const [copied, setCopied] = useState(false);
  // Começa como null para o HTML do servidor e a primeira renderização do
  // navegador serem idênticas (evita erro de hidratação na contagem regressiva).
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const remaining = useMemo(() => {
    if (!session || now === null) return EXPIRES_MS;
    return Math.max(0, EXPIRES_MS - (now - session.createdAt));
  }, [now, session]);

  const mmss = `${String(Math.floor(remaining / 60000)).padStart(2, "0")}:${String(Math.floor((remaining % 60000) / 1000)).padStart(2, "0")}`;

  const copy = async () => {
    if (!session?.qrcode) return;
    await navigator.clipboard.writeText(session.qrcode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <Shell>
      <div className="mx-auto max-w-[560px] px-4 pb-20 text-center">
        <h1 className="text-[28px] font-bold tracking-tight">Quase lá...</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Pague via pix em até <b className="text-foreground">{mmss}</b> para confirmar seu pedido.
        </p>
        <div className="mt-4">
          <Pill variant="waiting" />
        </div>

        <img
          src={pixWaiting}
          alt=""
          width={220}
          height={220}
          className="mx-auto mt-4 h-[220px] w-[220px]"
          loading="lazy"
        />

        {session ? (
          <>
            <p className="mt-4 text-sm text-muted-foreground">
              Total via Pix:{" "}
              <b className="text-[15px] text-[var(--ck-ok)]">{brl(session.amount / 100)}</b>
            </p>
            <div className="mt-4 break-all rounded-lg bg-muted px-4 py-3 text-left text-[12px] text-muted-foreground">
              {session.qrcode}
            </div>
            <button
              type="button"
              onClick={copy}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--ck-green)] px-6 py-3.5 text-[15px] font-semibold text-white transition hover:opacity-90"
            >
              <Copy className="h-4 w-4" /> {copied ? "Código copiado!" : "Copiar código"}
            </button>

            <div className="mt-10 text-left">
              <h2 className="text-[17px] font-bold">Como pagar o pix</h2>
              <ol className="mt-4 space-y-4">
                {[
                  <>
                    Clique em <b>cópiar o código</b>, logo acima
                  </>,
                  <>
                    Abra o <b>aplicativo</b> do seu banco
                  </>,
                  <>
                    Selecione a opção <b>PIX</b>
                  </>,
                  <>
                    Toque em <b>"Pix Copia e Cola"</b>
                  </>,
                  <>Insira o código copiado e finalize seu pagamento</>,
                ].map((t, i) => (
                  <li key={i} className="flex items-center gap-3 text-[14px]">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--ck-green)] text-[13px] font-semibold text-white">
                      {i + 1}
                    </span>
                    <span>{t}</span>
                  </li>
                ))}
              </ol>
            </div>
          </>
        ) : (
          <div className="mt-8 rounded-lg border border-border p-6 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">
              Sessão do Pix não encontrada neste dispositivo.
            </p>
            <p className="mt-2">
              Estamos acompanhando seu pagamento. Assim que for confirmado, esta página se atualiza
              sozinha.
            </p>
            <Link to="/checkout" className="mt-4 inline-block text-[var(--ck-ok)] underline">
              Voltar ao checkout
            </Link>
          </div>
        )}
      </div>
    </Shell>
  );
}

/** Pix venceu sem pagamento: gera outro pelo checkout (a sacola continua guardada). */
function Expired() {
  return (
    <Shell>
      <div className="mx-auto max-w-[560px] px-4 pb-20 text-center">
        <h1 className="mt-6 text-[24px] font-bold">Este Pix expirou</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          O código venceu antes do pagamento. Gere um novo Pix para concluir o pedido. Se você já
          pagou, fale com a gente que confirmamos na hora.
        </p>
        <Link
          to="/checkout"
          className="mt-6 inline-block rounded-lg bg-[var(--ck-green)] px-8 py-3.5 text-[15px] font-semibold text-white transition hover:opacity-90"
        >
          Gerar novo Pix
        </Link>
      </div>
    </Shell>
  );
}

function Refused() {
  return (
    <Shell>
      <div className="mx-auto max-w-[560px] px-4 pb-20 text-center">
        <div className="mt-2">
          <Pill variant="refused" />
        </div>
        <h1 className="mt-6 text-[24px] font-bold">Pagamento não aprovado</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Analise todos os dados informados para o pagamento.
        </p>
        <Link
          to="/checkout"
          className="mt-6 inline-block rounded-lg bg-[var(--ck-green)] px-8 py-3.5 text-[15px] font-semibold text-white transition hover:opacity-90"
        >
          Revisar dados
        </Link>
      </div>
    </Shell>
  );
}
