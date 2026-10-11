// Preços do /admin no servidor. Somente servidor.
import { applyPrices, PRICES_SETTING_KEY, type PriceConfig } from "@/lib/prices";

/**
 * Lê os preços salvos no banco e aplica na loja. Roda antes de cada cobrança, para o valor cobrado
 * ser sempre o do painel (mesmo com várias instâncias do servidor). Se o banco falhar, mantém os
 * preços já carregados.
 */
export async function syncPricesFromDb(): Promise<PriceConfig> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("site_settings")
    .select("value")
    .eq("key", PRICES_SETTING_KEY)
    .maybeSingle();
  if (error) throw new Error("Não foi possível carregar os preços. Tente novamente.");
  return applyPrices(data?.value ?? null);
}
