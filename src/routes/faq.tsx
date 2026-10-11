import { createFileRoute, Link } from "@tanstack/react-router";
import { PolicyPage } from "@/components/site/PolicyPage";
import { brand } from "@/lib/brand";
import { KIT_UNITS, PRICING } from "@/lib/catalog";
import { brl, FREE_SHIPPING_MIN } from "@/lib/shipping";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: `Perguntas frequentes | ${brand.name}` },
      {
        name: "description",
        content: "Tamanhos, kits, frete grátis, pagamento via Pix, prazos, trocas e devoluções.",
      },
      { property: "og:url", content: "/faq" },
    ],
    links: [{ rel: "canonical", href: "/faq" }],
  }),
  component: Page,
});

function Page() {
  const tenis = PRICING.promos["tenis"];
  const qa: [string, React.ReactNode][] = [
    [
      "Como escolho o tamanho certo?",
      <>
        Os calçados seguem a numeração brasileira. Se você costuma ficar entre dois números, prefira
        o maior em botas e tênis e o seu número habitual em sandálias e rasteirinhas. Meça o pé do
        calcanhar à ponta do dedo maior e compare com a tabela do fabricante: 34 ≈ 22,5 cm · 35 ≈ 23
        cm · 36 ≈ 23,5 cm · 37 ≈ 24,5 cm · 38 ≈ 25 cm · 39 ≈ 25,5 cm · 40 ≈ 26,5 cm.
      </>,
    ],
    [
      "Como funcionam os kits?",
      <>
        Nos modelos com mais de uma cor você leva {KIT_UNITS} unidades por {brl(PRICING.kitPrice)},
        escolhendo a cor e o tamanho de cada uma.
        {tenis &&
          ` Na coleção Tênis: 1 por ${brl(tenis.price)}, 2 por ${brl(tenis.kits[2] ?? 0)} ou 3 por ${brl(tenis.kits[3] ?? 0)}.`}
      </>,
    ],
    [
      "Quando o frete é grátis?",
      <>
        Em compras a partir de {brl(FREE_SHIPPING_MIN)} em produtos
        {tenis && ` ou levando ${tenis.freeShippingUnits} tênis ou mais`}. O valor do frete aparece
        no checkout antes do pagamento.
      </>,
    ],
    [
      "Quais as formas de pagamento?",
      "Pix, com aprovação na hora. Depois de finalizar, você copia o código Pix e paga no app do seu banco. O código vale por 30 minutos.",
    ],
    [
      "Tem cupom de desconto?",
      `Sim! Na primeira compra use o cupom ${brand.coupon.code} e ganhe ${brand.coupon.pct}% de desconto nos produtos.`,
    ],
    [
      "Qual o prazo de entrega?",
      <>
        O pedido é separado em até 1 dia útil após a confirmação do pagamento. O prazo da entrega
        depende do frete escolhido e aparece no checkout. Veja a{" "}
        <Link to="/politica-envio">política de envio</Link>.
      </>,
    ],
    [
      "Como acompanho meu pedido?",
      <>
        Na página <Link to="/rastreio">Rastrear pedido</Link>, com o CPF usado na compra.
      </>,
    ],
    [
      "Posso trocar ou devolver?",
      <>
        Sim. Você tem 7 dias após o recebimento para desistir da compra, e trocas de numeração são
        aceitas com o produto sem uso e na embalagem original. Veja a{" "}
        <Link to="/politica-reembolso">política de trocas e devoluções</Link>.
      </>,
    ],
    ["Os produtos são originais?", "Sim, todos os produtos são originais das marcas."],
  ];
  return (
    <PolicyPage
      eyebrow="Ajuda"
      title="Perguntas frequentes"
      intro="As dúvidas mais comuns sobre tamanhos, kits, frete, pagamento e trocas."
    >
      {qa.map(([q, a], i) => (
        <details key={q} open={i === 0}>
          <summary>{q}</summary>
          <div>{a}</div>
        </details>
      ))}
    </PolicyPage>
  );
}
