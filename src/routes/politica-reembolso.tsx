import { createFileRoute } from "@tanstack/react-router";
import { PolicyPage } from "@/components/site/PolicyPage";
import { brand } from "@/lib/brand";

export const Route = createFileRoute("/politica-reembolso")({
  head: () => ({
    meta: [
      { title: "Política de Reembolso | Vitrine Feminina" },
      {
        name: "description",
        content: "Condições de troca e reembolso dos produtos Vitrine Feminina.",
      },
      { property: "og:title", content: "Política de Reembolso" },
      {
        property: "og:description",
        content: "Direito de arrependimento e reembolso Vitrine Feminina.",
      },
      { property: "og:url", content: "/politica-reembolso" },
    ],
    links: [{ rel: "canonical", href: "/politica-reembolso" }],
  }),
  component: () => (
    <PolicyPage
      title="Trocas e Devoluções"
      intro="Garantia conforme o Código de Defesa do Consumidor."
    >
      <h2>Troca de numeração ou modelo</h2>
      <p>
        Não serviu? Você pode trocar em até 7 dias após o recebimento, com o produto sem uso, sem
        marcas e na embalagem original. A troca fica sujeita à disponibilidade de estoque.
      </p>
      <h2>Direito de arrependimento</h2>
      <p>
        Você tem até 7 dias após o recebimento do produto para solicitar reembolso, conforme art. 49
        do CDC.
      </p>
      <h2>Como solicitar</h2>
      <p>
        Entre em contato{" "}
        {brand.email ? `pelo e-mail ${brand.email}` : `pelo Instagram @${brand.instagram.handle}`}{" "}
        com o número do pedido.
      </p>
      <h2>Prazo de reembolso</h2>
      <p>
        O reembolso é processado em até 7 dias úteis após o recebimento do produto em nosso centro
        de distribuição.
      </p>
    </PolicyPage>
  ),
});
