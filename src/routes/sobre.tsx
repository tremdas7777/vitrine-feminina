import { createFileRoute, Link } from "@tanstack/react-router";
import { PolicyPage } from "@/components/site/PolicyPage";
import { brand } from "@/lib/brand";

export const Route = createFileRoute("/sobre")({
  head: () => ({
    meta: [
      { title: `Sobre a ${brand.name}` },
      { name: "description", content: `${brand.name}: ${brand.tagline}.` },
      { property: "og:title", content: `Sobre a ${brand.name}` },
      { property: "og:url", content: "/sobre" },
    ],
    links: [{ rel: "canonical", href: "/sobre" }],
  }),
  component: () => (
    <PolicyPage
      eyebrow="Sobre nós"
      title={`Sobre a ${brand.name}`}
      intro="Calçados, bolsas e acessórios das marcas que você ama, escolhidos a dedo para o seu dia a dia."
    >
      <p>
        A {brand.name} nasceu para facilitar a vida de quem quer se vestir bem com conforto.
        Reunimos sandálias, tênis, sapatilhas, botas, scarpins, mocassins e bolsas de marcas como
        Beira Rio, Modare, Petite Jolie, Moleca, Vizzano, Dakota e Ramarim — todos produtos
        originais.
      </p>
      <h2>Como compramos</h2>
      <p>
        Organizamos a vitrine por tipo de calçado, ocasião e marca, para você achar rápido o que
        procura. Os mais vendidos ficam em destaque, e a linha conforto reúne os modelos ortopédicos
        e ultra macios.
      </p>
      <h2>Compra segura</h2>
      <p>
        O pagamento é feito por Pix, com aprovação na hora, e você acompanha o envio pelo CPF na
        página <Link to="/rastreio">Rastrear pedido</Link>.
      </p>
    </PolicyPage>
  ),
});
