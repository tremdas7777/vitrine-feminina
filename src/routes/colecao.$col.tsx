import { createFileRoute, notFound } from "@tanstack/react-router";
import { StoreLayout } from "@/components/store/StoreLayout";
import { Listing, listingSearchSchema } from "@/components/store/Listing";
import { COLLECTIONS } from "@/lib/catalog";

export const Route = createFileRoute("/colecao/$col")({
  validateSearch: listingSearchSchema,
  beforeLoad: ({ params }) => {
    if (!COLLECTIONS[params.col]) throw notFound();
  },
  head: ({ params }) => {
    const c = COLLECTIONS[params.col];
    return {
      meta: [
        { title: `${c?.name ?? "Coleção"} | Vitrine Feminina` },
        { name: "description", content: c?.sub ?? "" },
      ],
      links: [{ rel: "canonical", href: `/colecao/${params.col}` }],
    };
  },
  component: Page,
});

function Page() {
  const { col } = Route.useParams();
  return (
    <StoreLayout>
      <Listing ctx={{ kind: "col", col }} search={Route.useSearch()} />
    </StoreLayout>
  );
}
