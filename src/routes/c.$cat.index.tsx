import { createFileRoute, notFound } from "@tanstack/react-router";
import { StoreLayout } from "@/components/store/StoreLayout";
import { Listing, listingSearchSchema } from "@/components/store/Listing";
import { CAT } from "@/lib/catalog";

export const Route = createFileRoute("/c/$cat/")({
  validateSearch: listingSearchSchema,
  beforeLoad: ({ params }) => {
    if (!CAT.has(params.cat)) throw notFound();
  },
  head: ({ params }) => {
    const name = CAT.get(params.cat)?.name ?? "Categoria";
    return {
      meta: [
        { title: `${name} | Vitrine Feminina` },
        { name: "description", content: `${name} das melhores marcas na Vitrine Feminina.` },
      ],
      links: [{ rel: "canonical", href: `/c/${params.cat}` }],
    };
  },
  component: Page,
});

function Page() {
  const { cat } = Route.useParams();
  return (
    <StoreLayout>
      <Listing ctx={{ kind: "cat", cat }} search={Route.useSearch()} />
    </StoreLayout>
  );
}
