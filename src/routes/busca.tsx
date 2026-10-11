import { createFileRoute } from "@tanstack/react-router";
import { StoreLayout } from "@/components/store/StoreLayout";
import { Listing, listingSearchSchema } from "@/components/store/Listing";

export const Route = createFileRoute("/busca")({
  validateSearch: listingSearchSchema,
  head: () => ({
    meta: [{ title: "Busca | Vitrine Feminina" }, { name: "robots", content: "noindex" }],
  }),
  component: Page,
});

function Page() {
  const search = Route.useSearch();
  return (
    <StoreLayout>
      <Listing ctx={{ kind: "search", q: search.q ?? "" }} search={search} />
    </StoreLayout>
  );
}
