/**
 * Regra de preço do checkout (usada no servidor para cobrar e no cliente só para exibir).
 * A loja só recebe Pix (SagacePay, PixGate ou MagicPay): o total é produtos − cupom + frete.
 */
export function checkoutTotals(o: { products: number; frete: number; discount?: number }) {
  const products = Math.round(o.products * 100);
  const frete = Math.round(o.frete * 100);
  const discount = Math.min(products, Math.round((o.discount ?? 0) * 100));
  return { products, frete, discount, total: products - discount + frete };
}
