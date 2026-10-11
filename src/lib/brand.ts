/** Marca da loja — Vitrine Feminina (calçados femininos, bolsas e acessórios) */
export const brand = {
  name: "Vitrine Feminina",
  /** Descrição genérica enviada ao gateway na cobrança (sem detalhes dos produtos). */
  chargeDescription: "Pedido Vitrine Feminina",
  tagline: "Calçados, bolsas e acessórios das marcas que você ama",
  /**
   * Dados da empresa — preencha antes de publicar. Campos vazios ficam ocultos
   * no rodapé, no contato e nas políticas.
   */
  company: {
    legalName: "",
    cnpj: "",
  },
  email: "",
  /** Domínio da loja (ex.: "https://vitrinefeminina.com.br"), sem barra no final. Usado no sitemap e no og:image. */
  siteUrl: "",
  instagram: {
    handle: "samisapatilhasecia",
    url: "https://instagram.com/samisapatilhasecia",
  },
  whatsapp: {
    /** Número em E.164 (DDI + DDD + número), sem símbolos */
    phoneE164: "5513997712047",
    display: "(13) 99771-2047",
  },
  /** Cupom de primeira compra (exibido na loja e aplicado no checkout pelo servidor). */
  coupon: { code: "PRIMEIRA10", pct: 10 },
  colors: {
    primary: "#862f52",
    primaryDark: "#6e2443",
    primaryDeep: "#2a1f24",
    onPrimary: "#ffffff",
    surfaceTint: "#fdf4f6",
  },
};
