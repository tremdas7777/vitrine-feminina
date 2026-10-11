/** Dinheiro e regra do frete grátis (usado na loja, no checkout e no servidor). */
export const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Valor mínimo (produtos + order bump, sem frete e antes do cupom) para liberar o frete grátis. */
export const FREE_SHIPPING_MIN = 90;
export const FREE_SHIPPING_LABEL = `Frete grátis acima de ${brl(FREE_SHIPPING_MIN)}`;

export const isFreeShippingEligible = (subtotal: number) => subtotal >= FREE_SHIPPING_MIN;
