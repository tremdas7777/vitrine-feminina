/**
 * Order bumps do checkout (ofertas logo acima do botão de finalizar).
 * Preços usados no servidor — o cliente só exibe (preço editável no /admin → Preços).
 * Lista vazia = checkout sem bump.
 */
export type OrderBumpItem = {
  id: string;
  name: string;
  fullName: string;
  /** Nome enviado ao gateway (fatura). */
  gatewayName: string;
  price: number;
  /** Preço "de" (riscado). Sem ele, a oferta mostra só o preço. */
  compareAt?: number;
  img: string;
  /** Texto de venda exibido no checkout. */
  question: string;
  body: string;
  benefits: string[];
  /** Texto do checkbox; `{preco}` vira o preço formatado. */
  cta: string;
};

export type BumpId = OrderBumpItem["id"];

export const ORDER_BUMPS: readonly OrderBumpItem[] = [
  {
    id: "meias3",
    name: "Kit 3 meias invisíveis",
    fullName: "Kit com 3 pares de meias invisíveis",
    gatewayName: "Pedido Vitrine Feminina",
    price: 19.9,
    compareAt: 29.9,
    img: "https://samisapatilhasecia.com.br/wp-content/uploads/2025/05/15321343842-br-11134207-7r98o-lycqxeqfayhx74-449x449.jpeg",
    question: "Seu calçado novo merece meias que não aparecem.",
    body: "Meias invisíveis deixam o pé confortável e protegido dentro de tênis, sapatilhas e mocassins, sem aparecer no look. Leve 3 pares agora, no mesmo envio, com o desconto que só aparece nesta tela.",
    benefits: [
      "3 pares de meias invisíveis",
      "Evita bolhas e o atrito do calçado novo",
      "Vai na mesma caixa, sem frete extra",
    ],
    cta: "Sim! Quero o kit de 3 meias por + {preco}",
  },
  {
    id: "limpeza",
    name: "Kit limpeza e impermeabilizante",
    fullName: "Kit de limpeza e impermeabilizante para calçados",
    gatewayName: "Pedido Vitrine Feminina",
    price: 19.9,
    compareAt: 34.9,
    img: "/ofertas/kit-limpeza.svg",
    question: "Mantenha seu calçado com cara de novo por muito mais tempo.",
    body: "Shampoo de limpeza, escova macia e spray impermeabilizante: tira a sujeira sem desbotar e protege contra água e manchas. Ideal para tênis claros e tecidos. Leve agora, no mesmo envio.",
    benefits: [
      "Limpa tecido, couro sintético e solado",
      "Impermeabilizante protege de água e manchas",
      "Vai na mesma caixa, sem frete extra",
    ],
    cta: "Sim! Quero o kit de limpeza por + {preco}",
  },
];

/** Bumps escolhidos, na ordem do checkout (ids repetidos ou desconhecidos são ignorados). */
export const getBumps = (ids: readonly string[]) => ORDER_BUMPS.filter((b) => ids.includes(b.id));

/** Soma dos bumps escolhidos, em reais. */
export const bumpsTotal = (ids: readonly string[]) =>
  Math.round(getBumps(ids).reduce((s, b) => s + b.price * 100, 0)) / 100;
