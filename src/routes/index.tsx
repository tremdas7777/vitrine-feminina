import { createFileRoute } from "@tanstack/react-router";
import { StoreLayout } from "@/components/store/StoreLayout";
import { Home } from "@/components/store/Home";

const TITLE = "Vitrine Feminina | Calçados, Bolsas e Acessórios";
const DESCRIPTION =
  "Sandálias, tênis, sapatilhas, botas, scarpins e bolsas das melhores marcas: Beira Rio, Modare, Petite Jolie, Moleca, Vizzano e muito mais. Tênis a partir de R$ 49.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: () => (
    <StoreLayout>
      <Home />
    </StoreLayout>
  ),
});
