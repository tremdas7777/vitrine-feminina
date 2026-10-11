import { Link } from "@tanstack/react-router";
import { Truck } from "lucide-react";
import { FREE_SHIPPING_MIN, isFreeShippingEligible } from "@/lib/shipping";
import { cn } from "@/lib/utils";
import { brl } from "./parts";

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Frete grátis a partir de FREE_SHIPPING_MIN.
 * - Já liberado: "Você ganhou frete grátis".
 * - Abaixo do mínimo: quanto falta, com um link para voltar à loja (`offerMore`).
 */
export function FreeShippingProgress({
  subtotal,
  free,
  className,
  offerMore = true,
}: {
  /** Produtos + order bump, sem frete. */
  subtotal: number;
  /** Frete grátis já liberado por outra regra (ex.: 2 tênis ou mais). */
  free?: boolean;
  className?: string;
  /** Mostra o link para continuar comprando (etapa do frete). */
  offerMore?: boolean;
}) {
  if (free || isFreeShippingEligible(subtotal)) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg border border-[var(--ck-ok)] bg-[var(--ck-badge)]/40 px-4 py-3 text-[13px]",
          className,
        )}
      >
        <Truck className="h-4 w-4 shrink-0 text-[var(--ck-ok)]" />
        <span>
          Você ganhou <b className="text-[var(--ck-ok)]">FRETE GRÁTIS</b>!
        </span>
      </div>
    );
  }
  const pct = Math.min(100, Math.round((subtotal / FREE_SHIPPING_MIN) * 100));
  return (
    <div
      className={cn(
        "rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-[13px]",
        className,
      )}
    >
      <p className="flex items-center gap-2">
        <Truck className="h-4 w-4 shrink-0 text-amber-600" />
        <span>
          Frete grátis a partir de <b>{brl(FREE_SHIPPING_MIN)}</b> (faltam{" "}
          <b>{brl(round(FREE_SHIPPING_MIN - subtotal))}</b>) ou levando <b>2 tênis</b>.
        </span>
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-amber-200">
        <div className="h-full rounded-full bg-amber-500" style={{ width: `${pct}%` }} />
      </div>
      {offerMore && (
        <Link to="/" className="mt-2 inline-block font-semibold text-amber-800 underline">
          Continuar comprando
        </Link>
      )}
    </div>
  );
}
