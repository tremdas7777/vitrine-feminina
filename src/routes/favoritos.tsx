import { createFileRoute } from "@tanstack/react-router";
import { StoreLayout } from "@/components/store/StoreLayout";
import { Listing, listingSearchSchema } from "@/components/store/Listing";

export const Route = createFileRoute("/favoritos")({
  validateSearch: listingSearchSchema,
  head: () => ({
    meta: [{ title: "Meus favoritos | Vitrine Feminina" }, { name: "robots", content: "noindex" }],
  }),
  component: Page,
});

function Page() {
  return (
    <StoreLayout>
      <Listing ctx={{ kind: "favs" }} search={Route.useSearch()} />
    </StoreLayout>
  );
}
