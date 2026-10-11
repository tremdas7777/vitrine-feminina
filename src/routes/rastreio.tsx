import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/Layout";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { trackByCpf, type RastreioStatus } from "@/lib/rastreio.functions";

export const Route = createFileRoute("/rastreio")({
  head: () => ({
    meta: [
      { title: "Rastrear Pedido | Vitrine Feminina" },
      {
        name: "description",
        content: "Acompanhe a entrega do seu pedido Vitrine Feminina pelo CPF do titular.",
      },
      { property: "og:title", content: "Rastrear Pedido" },
      { property: "og:description", content: "Acompanhe a entrega do seu pedido." },
      { property: "og:url", content: "/rastreio" },
    ],
    links: [{ rel: "canonical", href: "/rastreio" }],
  }),
  component: Page,
});

function formatCpf(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
}

const STEPS: { key: RastreioStatus; title: string; sub: string }[] = [
  {
    key: "aguardando_pagamento",
    title: "Pedido recebido",
    sub: "Aguardando a confirmação do pagamento",
  },
  { key: "em_preparacao", title: "Pagamento confirmado", sub: "Pedido em preparação para envio" },
  { key: "postado", title: "Postado", sub: "Entregue à transportadora — acompanhe pelo código" },
];

const HEADLINE: Record<RastreioStatus, string> = {
  aguardando_pagamento: "Aguardando pagamento",
  em_preparacao: "Em preparação",
  postado: "Pedido postado",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function Page() {
  const [cpf, setCpf] = useState("");
  const trackFn = useServerFn(trackByCpf);
  const mutation = useMutation({
    mutationFn: (cpfValue: string) => trackFn({ data: { cpf: cpfValue } }),
  });

  const result = mutation.data;
  const currentIdx = result?.found ? STEPS.findIndex((s) => s.key === result.status) : -1;

  return (
    <SiteLayout>
      <section className="pt-32 md:pt-44 pb-24">
        <div className="container-edge max-w-2xl">
          <span className="eyebrow text-[var(--primary)] block mb-6">Rastreio</span>
          <h1 className="font-display text-5xl md:text-7xl leading-[0.95] text-balance">
            Acompanhe o <span className="italic">seu pedido.</span>
          </h1>
          <p className="mt-6 text-[var(--ink)]/70 leading-relaxed">
            Informe o CPF do titular do pedido para consultar o status da entrega.
          </p>

          <form
            className="mt-12 border-y border-[rgba(13,13,13,0.1)] py-6 flex gap-4 items-center"
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate(cpf);
            }}
          >
            <input
              value={cpf}
              onChange={(e) => setCpf(formatCpf(e.target.value))}
              placeholder="000.000.000-00"
              inputMode="numeric"
              className="flex-1 bg-transparent border-0 outline-none text-lg placeholder:text-[var(--ink)]/30"
            />
            <button
              disabled={mutation.isPending}
              className="bg-[var(--primary)] text-white px-8 py-3 text-xs font-bold uppercase tracking-[0.2em] hover:opacity-90 transition-colors disabled:opacity-50"
            >
              {mutation.isPending ? "Buscando..." : "Rastrear"}
            </button>
          </form>

          {mutation.isError && (
            <p className="mt-6 text-sm text-red-600">{(mutation.error as Error).message}</p>
          )}

          {result && !result.found && (
            <p className="mt-10 text-sm leading-relaxed text-[var(--ink)]/70">
              Não encontramos pedido para este CPF. Confira os números ou fale com o nosso suporte.
            </p>
          )}

          {result?.found && (
            <div className="mt-16">
              <div className="eyebrow text-[var(--ink)]/40 mb-4">Pedido {result.pedido}</div>
              <div className="font-display text-3xl mb-2">{HEADLINE[result.status]}.</div>
              <p className="text-sm text-[var(--ink)]/50 mb-10">
                Pedido feito em {formatDate(result.data_pedido)}
              </p>
              {result.tracking_code && (
                <div className="mb-10 p-6 bg-[rgba(13,13,13,0.03)] border border-[rgba(13,13,13,0.1)]">
                  <div className="text-xs uppercase tracking-[0.18em] text-[var(--ink)]/40 mb-2">
                    Código de rastreio
                  </div>
                  <div className="font-display text-2xl mb-3">{result.tracking_code}</div>
                  {result.tracking_url && (
                    <a
                      href={result.tracking_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block text-xs font-bold uppercase tracking-[0.2em] text-[var(--primary)] hover:opacity-80 transition-opacity"
                    >
                      Acompanhar na transportadora →
                    </a>
                  )}
                </div>
              )}
              <ol className="space-y-px bg-[rgba(13,13,13,0.08)]">
                {STEPS.map((step, i) => {
                  const done = i <= currentIdx;
                  return (
                    <li key={step.key} className="bg-white p-6 flex items-center gap-6">
                      <span
                        className={`font-display italic text-2xl ${
                          done ? "text-[var(--primary)]" : "text-[var(--ink)]/30"
                        }`}
                      >
                        0{i + 1}
                      </span>
                      <div>
                        <div
                          className={`text-sm font-semibold ${done ? "" : "text-[var(--ink)]/40"}`}
                        >
                          {step.title}
                        </div>
                        <div className="text-xs uppercase tracking-[0.18em] text-[var(--ink)]/40 mt-1">
                          {done ? step.sub : "Próxima etapa"}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </div>
      </section>
    </SiteLayout>
  );
}
