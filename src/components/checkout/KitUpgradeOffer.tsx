import { useState } from "react";
import { Truck } from "lucide-react";
import type { CartLine, KitUpgrade, Variant } from "@/lib/cart";
import { imgSmall, promoOf } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import { brl } from "./parts";

const only = (xs: string[]) => (xs.length === 1 ? xs[0]! : null);

/**
 * Oferta na etapa do frete: troca o item avulso pelo kit (ex.: 3 tênis) e libera o frete grátis.
 * O cliente escolhe ali mesmo a cor e o tamanho de cada unidade; a 1ª já vem com o que estava
 * na sacola.
 */
export function KitUpgradeOffer({
  offer,
  onAccept,
}: {
  offer: KitUpgrade;
  onAccept: (kit: CartLine) => void;
}) {
  const { product: p, line } = offer.from;
  const current: Variant = line.kit
    ? { color: null, size: null }
    : { color: line.color, size: line.size };
  const blank: Variant = { color: only(p.colors), size: only(p.sizes) };
  const [units, setUnits] = useState<Variant[]>(() =>
    Array.from({ length: offer.units }, (_, i) => (i < line.qty ? current : blank)),
  );
  const [missing, setMissing] = useState<number[]>([]);
  const noun = promoOf(p) ? "pares" : "unidades";

  const set = (i: number, v: Partial<Variant>) => {
    setUnits((cur) => cur.map((u, j) => (j === i ? { ...u, ...v } : u)));
    setMissing((cur) => cur.filter((j) => j !== i));
  };

  const accept = () => {
    const bad = units.flatMap((u, i) =>
      (p.colors.length > 0 && !u.color) || (p.sizes.length > 0 && !u.size) ? [i] : [],
    );
    if (bad.length) return setMissing(bad);
    onAccept({ slug: p.slug, qty: 1, kit: true, units });
  };

  const select =
    "h-10 min-w-0 flex-1 rounded-md border bg-white px-2 text-[13px] outline-none focus:border-[var(--ck-blue)]";

  return (
    <div className="overflow-hidden rounded-lg border-2 border-[var(--ck-blue)]/70 bg-white">
      <div className="flex items-center justify-center gap-2 bg-[var(--ck-blue)] px-4 py-1.5 text-center text-[12px] font-bold uppercase tracking-wide text-white">
        <Truck className="h-3.5 w-3.5" aria-hidden />
        Leve {offer.units} e ganhe frete grátis
      </div>
      <div className="p-4">
        <div className="flex gap-3">
          <img
            src={imgSmall(p)}
            alt={p.name}
            width={72}
            height={72}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="h-[72px] w-[72px] shrink-0 rounded-md border border-border bg-white object-contain"
          />
          <div className="min-w-0 text-[13px] leading-snug">
            <p className="font-semibold">{p.name}</p>
            <p className="mt-1">
              {offer.units} {noun} por <b className="text-[var(--ck-ok)]">{brl(offer.price)}</b>{" "}
              <span className="text-muted-foreground">({brl(offer.price / offer.units)} cada)</span>
            </p>
            <p className="mt-0.5 text-muted-foreground">
              Só <b className="text-foreground">+{brl(offer.extra)}</b> e o frete sai de graça.
            </p>
          </div>
        </div>

        <p className="mt-4 text-[13px] font-medium">
          Escolha a cor{p.sizes.length ? " e o tamanho" : ""} de cada um:
        </p>
        <div className="mt-2 space-y-2">
          {units.map((u, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-[12px] font-semibold">
                {i + 1}
              </span>
              {p.colors.length > 0 && (
                <select
                  aria-label={`Cor do ${i + 1}º`}
                  value={u.color ?? ""}
                  onChange={(e) => set(i, { color: e.target.value || null })}
                  className={cn(
                    select,
                    missing.includes(i) && !u.color ? "border-red-500" : "border-border",
                  )}
                >
                  <option value="">Cor</option>
                  {p.colors.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              )}
              {p.sizes.length > 0 && (
                <select
                  aria-label={`Tamanho do ${i + 1}º`}
                  value={u.size ?? ""}
                  onChange={(e) => set(i, { size: e.target.value || null })}
                  className={cn(
                    select,
                    "max-w-[110px]",
                    missing.includes(i) && !u.size ? "border-red-500" : "border-border",
                  )}
                >
                  <option value="">Tam.</option>
                  {p.sizes.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              )}
            </div>
          ))}
        </div>
        {missing.length > 0 && (
          <p className="mt-2 text-[12px] text-red-600">
            Escolha a cor{p.sizes.length ? " e o tamanho" : ""} de todos os {offer.units}.
          </p>
        )}

        <button
          type="button"
          onClick={accept}
          className="mt-4 w-full rounded-md bg-[var(--ck-ok)] px-4 py-3 text-[14px] font-bold text-white transition-opacity hover:opacity-90"
        >
          Quero {offer.units} por {brl(offer.price)} com frete grátis
        </button>
      </div>
    </div>
  );
}
