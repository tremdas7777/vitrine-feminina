import { createFileRoute, notFound } from "@tanstack/react-router";
import { StoreLayout } from "@/components/store/StoreLayout";
import { Listing, listingSearchSchema } from "@/components/store/Listing";
import { CAT, subName } from "@/lib/catalog";

export const Route = createFileRoute("/c/$cat/$sub")({
  validateSearch: listingSearchSchema,
  beforeLoad: ({ params }) => {
    if (!subName(params.cat, params.sub)) throw notFound();
  },
  head: ({ params }) => {
    const name = `${subName(params.cat, params.sub)} — ${CAT.get(params.cat)?.name ?? ""}`;
    return {
      meta: [
        { title: `${name} | Vitrine Feminina` },
        { name: "description", content: `${name} das melhores marcas na Vitrine Feminina.` },
      ],
      links: [{ rel: "canonical", href: `/c/${params.cat}/${params.sub}` }],
    };
  },
  component: Page,
});

function Page() {
  const { cat, sub } = Route.useParams();
  return (
    <StoreLayout>
      <Listing ctx={{ kind: "cat", cat, sub }} search={Route.useSearch()} />
    </StoreLayout>
  );
}
