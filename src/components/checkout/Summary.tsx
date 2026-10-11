import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { freeShippingFor, type ResolvedLine } from "@/lib/cart";
import { imgSmall } from "@/lib/catalog";
import { bumpsTotal, getBumps, type BumpId } from "@/lib/order-bump";
import { brl } from "./parts";
import { FreeShippingProgress } from "./FreeShippingProgress";

type Props = { lines: ResolvedLine[]; frete: number; discount: number; bumps?: BumpId[] };

const productsOf = ({ lines, bumps = [] }: Props) =>
  lines.reduce((s, l) => s + l.total, 0) + bumpsTotal(bumps);
const totalOf = (p: Props) => productsOf(p) - p.discount + p.frete;

function Body(p: Props) {
  const { lines, frete, discount, bumps = [] } = p;
  return (
    <>
      <FreeShippingProgress
        subtotal={productsOf(p)}
        free={freeShippingFor(productsOf(p), lines)}
        className="mb-5"
        offerMore={false}
      />
      <div className="space-y-2 text-[13px]">
        <div className="flex justify-between">
          <span>Produtos</span>
          <span>{brl(productsOf(p))}</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between">
            <span>Cupom de desconto</span>
            <span className="text-[var(--ck-ok)]">-{brl(discount)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>Frete</span>
          <span className="text-[var(--ck-ok)]">{frete ? brl(frete) : "Grátis"}</span>
        </div>
        <div className="flex justify-between pt-1 text-base font-semibold">
          <span>Total</span>
          <span>{brl(totalOf(p))}</span>
        </div>
      </div>
      <div className="mt-6 space-y-4 border-t border-border pt-6">
        {lines.map((l) => (
          <div key={JSON.stringify(l.line)} className="flex gap-3">
            <span className="relative shrink-0">
              <img
                src={imgSmall(l.product)}
                alt=""
                width={56}
                height={56}
                referrerPolicy="no-referrer"
                className="h-14 w-14 rounded-md border border-border bg-white object-cover"
              />
              <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1 text-[11px] font-semibold text-white">
                {l.line.qty}
              </span>
            </span>
            <div className="min-w-0 flex-1 text-[13px]">
              <p className="line-clamp-2">
                {l.line.kit ? `Kit ${l.line.units.length} unidades — ` : ""}
                {l.product.name}
              </p>
              <p className="mt-1 whitespace-pre-line text-muted-foreground">
                {l.line.kit ? l.detail.split(" | ").join("\n") : l.detail}
              </p>
            </div>
            <span className="text-[13px]">{brl(l.total)}</span>
          </div>
        ))}
        {getBumps(bumps).map((b) => (
          <div key={b.id} className="flex gap-3">
            <img
              src={b.img}
              alt=""
              width={56}
              height={56}
              referrerPolicy="no-referrer"
              className="h-14 w-14 rounded-md border border-border object-cover"
            />
            <div className="flex-1 text-[13px]">
              <p>{b.fullName}</p>
              <p className="mt-1 text-muted-foreground">Oferta do checkout</p>
            </div>
            <span className="text-[13px]">{brl(b.price)}</span>
          </div>
        ))}
      </div>
    </>
  );
}

export function SummaryDesktop(p: Props) {
  return (
    <aside className="hidden h-fit rounded-lg border border-border p-6 lg:block">
      <h2 className="mb-6 text-[15px]">Resumo do pedido</h2>
      <Body {...p} />
    </aside>
  );
}

export function SummaryMobile(p: Props) {
  const [open, setOpen] = useState(false);
  const count = p.lines.reduce((s, l) => s + l.line.qty, 0) + getBumps(p.bumps ?? []).length;
  return (
    <div className="border-y border-border bg-muted/60 lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-5 py-3"
      >
        <span className="text-[13px]">Resumo do pedido ({count})</span>
        <span className="flex items-center gap-2 text-lg font-medium">
          {brl(totalOf(p))}{" "}
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      {open && (
        <div className="ck-surface px-5 py-5">
          <Body {...p} />
        </div>
      )}
    </div>
  );
}
