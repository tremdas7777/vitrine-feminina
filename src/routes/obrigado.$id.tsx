import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, PackageCheck, Truck } from "lucide-react";
import { loadPixSession, type PixSession } from "@/lib/pix-session";
import { brl } from "@/components/checkout/parts";
import { Pill, Shell } from "@/components/checkout/OrderShell";

export const Route = createFileRoute("/obrigado/$id")({
  head: () => ({
    meta: [
      { title: "Pedido confirmado | Vitrine Feminina" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

/** Página de obrigado — no fim do pós-compra (ofertas e envio expresso), comprando algo ou não. */
function Page() {
  const { id } = Route.useParams();
  // Lido só no navegador (sessionStorage) para não divergir da renderização do servidor.
  const [sessions, setSessions] = useState<{ main: PixSession | null; extras: PixSession[] }>({
    main: null,
    extras: [],
  });

  useEffect(() => {
    const s = loadPixSession(id);
    const main = s?.isUpsell ? (s.parentId ? loadPixSession(s.parentId) : null) : s;
    // Compras do pós-compra já pagas: ofertas (kit/seguro) e envio expresso.
    const extras = main
      ? [main.upsellId, main.expressId]
          .map((x) => (x ? loadPixSession(x) : null))
          .filter((x): x is PixSession => !!x)
      : s?.isUpsell
        ? [s]
        : [];
    setSessions({ main, extras });
  }, [id]);

  const { main, extras } = sessions;
  const extra = extras.length > 0;

  return (
    <Shell>
      <div className="mx-auto max-w-[560px] px-4 pb-20 text-center">
        <div className="mt-2">
          <Pill variant="approved" />
        </div>
        <div className="mx-auto mt-6 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--ck-ok)] text-white">
          <Check className="h-9 w-9" />
        </div>
        <h1 className="mt-5 text-[28px] font-bold tracking-tight">
          {extra ? "Compra adicional confirmada!" : "Pedido confirmado!"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {extra
            ? "Obrigado pela confiança! Sua compra adicional foi registrada e vai para o mesmo endereço."
            : "Obrigado pela compra! Seu pedido já está sendo preparado."}{" "}
          Acompanhe o envio em <b className="text-foreground">Rastrear pedido</b>, com o CPF usado
          na compra.
        </p>

        {(main || extra) && (
          <div className="mt-8 rounded-lg border border-border bg-white p-6 text-left">
            <h2 className="mb-4 text-[15px] font-semibold">Resumo da compra</h2>
            <div className="space-y-4 text-[13px]">
              {main && (
                <div>
                  {(main.items ?? []).map((i) => (
                    <div key={JSON.stringify(i.line)} className="mb-3 flex gap-3">
                      <img
                        src={i.img}
                        alt=""
                        width={48}
                        height={48}
                        referrerPolicy="no-referrer"
                        className="h-12 w-12 shrink-0 rounded-md border border-border object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">
                          {i.qty}x {i.title}
                        </p>
                        <p className="mt-0.5 text-muted-foreground">{i.detail}</p>
                      </div>
                    </div>
                  ))}
                  {(main.bumps ?? (main.bump ? [main.bump] : [])).map((b) => (
                    <p key={b.name} className="mb-2 text-muted-foreground">
                      + {b.name}
                    </p>
                  ))}
                  <div className="flex justify-between border-t border-border pt-3">
                    <span>Pago no Pix</span>
                    <span className="shrink-0">{brl(main.amount / 100)}</span>
                  </div>
                </div>
              )}
              {extras.map((x) => (
                <div key={x.id} className="flex justify-between gap-3 border-t border-border pt-4">
                  <div>
                    <p className="font-medium">{x.bundleName}</p>
                    <p className="mt-0.5 text-muted-foreground">
                      {x.units > 0
                        ? `${x.units} ${x.units > 1 ? "peças" : "peça"} · mesmo endereço de entrega`
                        : "Incluído no seu pedido"}
                    </p>
                  </div>
                  <span className="shrink-0">{brl(x.amount / 100)}</span>
                </div>
              ))}
              {main && extra && (
                <div className="flex justify-between border-t border-border pt-3 text-base font-semibold">
                  <span>Total pago</span>
                  <span>{brl((main.amount + extras.reduce((t, x) => t + x.amount, 0)) / 100)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-8 rounded-lg bg-muted/60 p-6 text-left">
          <h2 className="text-[15px] font-semibold">Próximos passos</h2>
          <ol className="mt-4 space-y-4 text-[13.5px]">
            {[
              { icon: Check, text: "Pagamento confirmado: seu pedido está registrado." },
              { icon: PackageCheck, text: "Separamos e embalamos o seu pedido." },
              {
                icon: Truck,
                text: "Quando for postado, o código de rastreio aparece em Rastrear pedido (pelo CPF).",
              },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--ck-green)] text-white">
                  <Icon className="h-4 w-4" />
                </span>
                <span>{text}</span>
              </li>
            ))}
          </ol>
        </div>

        <Link
          to="/rastreio"
          className="mt-8 inline-block rounded-lg bg-[var(--ck-green)] px-8 py-3.5 text-[15px] font-semibold text-white transition hover:opacity-90"
        >
          Acompanhar meu pedido
        </Link>
        <p className="mt-2 text-[12px] text-muted-foreground">Pedido nº {id}</p>
      </div>
    </Shell>
  );
}
