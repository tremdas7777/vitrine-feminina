import { cn } from "@/lib/utils";

/** Logo em texto da Vitrine Feminina: "Vitrine" em letra cursiva e "Feminina" em caixa alta. */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <span
      className={cn("inline-flex flex-col items-center leading-none text-[#862f52]", className)}
      aria-label="Vitrine Feminina"
    >
      <span style={{ fontFamily: '"Great Vibes", cursive' }}>Vitrine</span>
      <span
        className="mt-[0.08em] text-[0.24em] font-semibold uppercase tracking-[0.5em]"
        style={{ fontFamily: '"DM Sans", system-ui, sans-serif', marginLeft: "0.5em" }}
      >
        Feminina
      </span>
    </span>
  );
}
