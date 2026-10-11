/**
 * Preços editáveis no /admin → Preços: kit com 3 unidades, promoção por categoria (tênis), oferta
 * do checkout, desconto do upsell, seguro e envio expresso. Os valores dos arquivos (catalog.ts,
 * order-bump.ts, upsell.ts) são o padrão; o que estiver salvo no banco (site_settings "prices")
 * substitui o padrão. O preço de cada produto vem do catálogo.
 *
 * O servidor sempre recarrega do banco antes de cobrar (prices.server.ts), então o valor cobrado
 * no gateway do Pix é sempre o do painel. O navegador recebe os mesmos preços pelo loader da raiz só
 * para exibir.
 */
import { z } from "zod";
import { PRICING } from "@/lib/catalog";
import { ORDER_BUMPS } from "@/lib/order-bump";
import { EXPRESS_SHIPPING, SHIPPING_INSURANCE, UPSELL_OFFER } from "@/lib/upsell";

export const PRICES_SETTING_KEY = "prices";

const money = z.number().finite().min(0.01).max(1_000_000);
const offer = z
  .object({ price: money, compareAt: money.nullable() })
  .refine((o) => o.compareAt === null || o.compareAt > o.price, {
    message: 'O preço "de" precisa ser maior que o preço de venda.',
  });

export const priceConfigSchema = z.object({
  kit: money,
  tenis: z.object({ price: money, kit2: money, kit3: money }),
  bump: offer,
  upsellPct: z.number().int().min(1).max(90),
  seguro: money,
  expresso: money,
});

export type PriceOffer = { price: number; compareAt: number | null };
export type PriceConfig = z.infer<typeof priceConfigSchema>;

const round = (n: number) => Math.round(n * 100) / 100;
const bump = () => ORDER_BUMPS[0];

/** Preços em uso agora (o que a loja exibe e o servidor cobra). */
export function currentPrices(): PriceConfig {
  const b = bump();
  const tenis = PRICING.promos["tenis"];
  return {
    kit: PRICING.kitPrice,
    tenis: {
      price: tenis?.price ?? 49,
      kit2: tenis?.kits[2] ?? 79,
      kit3: tenis?.kits[3] ?? 99,
    },
    bump: b ? { price: b.price, compareAt: b.compareAt ?? null } : { price: 1, compareAt: null },
    upsellPct: UPSELL_OFFER.pct,
    seguro: SHIPPING_INSURANCE.price,
    expresso: EXPRESS_SHIPPING.price,
  };
}

/** Preços de fábrica (valores dos arquivos), guardados antes de qualquer alteração. */
export const DEFAULT_PRICES: PriceConfig = structuredClone(currentPrices());

/**
 * Aplica os preços em toda a loja. Sem configuração válida, volta aos preços de fábrica.
 * Idempotente: pode rodar a cada render/requisição.
 */
export function applyPrices(raw: unknown): PriceConfig {
  const parsed = priceConfigSchema.safeParse(raw);
  const cfg = parsed.success ? parsed.data : DEFAULT_PRICES;
  PRICING.kitPrice = round(cfg.kit);
  PRICING.promos["tenis"] = {
    price: round(cfg.tenis.price),
    kits: { 2: round(cfg.tenis.kit2), 3: round(cfg.tenis.kit3) },
    freeShippingUnits: PRICING.promos["tenis"]?.freeShippingUnits ?? 2,
  };
  const bm = bump() as { price: number; compareAt?: number } | undefined;
  if (bm) {
    bm.price = round(cfg.bump.price);
    bm.compareAt = cfg.bump.compareAt === null ? undefined : round(cfg.bump.compareAt);
  }
  UPSELL_OFFER.pct = cfg.upsellPct;
  SHIPPING_INSURANCE.price = round(cfg.seguro);
  EXPRESS_SHIPPING.price = round(cfg.expresso);
  return cfg;
}
