import { createFileRoute, notFound } from "@tanstack/react-router";
import { StoreLayout } from "@/components/store/StoreLayout";
import { Listing, listingSearchSchema } from "@/components/store/Listing";
import { BRAND_BY_SLUG } from "@/lib/catalog";

export const Route = createFileRoute("/marca/$brand")({
  validateSearch: listingSearchSchema,
  beforeLoad: ({ params }) => {
    if (!BRAND_BY_SLUG.has(params.brand)) throw notFound();
  },
  head: ({ params }) => {
    const name = BRAND_BY_SLUG.get(params.brand)?.name ?? "Marca";
    return {
      meta: [
        { title: `${name} | Vitrine Feminina` },
        { name: "description", content: `Produtos ${name} originais na Vitrine Feminina.` },
      ],
      links: [{ rel: "canonical", href: `/marca/${params.brand}` }],
    };
  },
  component: Page,
});

function Page() {
  const { brand } = Route.useParams();
  return (
    <StoreLayout>
      <Listing ctx={{ kind: "brand", brand }} search={Route.useSearch()} />
    </StoreLayout>
  );
}
