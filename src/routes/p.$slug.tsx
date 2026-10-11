import { createFileRoute, notFound } from "@tanstack/react-router";
import { StoreLayout } from "@/components/store/StoreLayout";
import { ProductPage } from "@/components/store/ProductPage";
import { BY_SLUG, imgLarge, priceOf } from "@/lib/catalog";
import { getProductTexts } from "@/lib/product-texts.functions";

export const Route = createFileRoute("/p/$slug")({
  loader: async ({ params }) => {
    if (!BY_SLUG.has(params.slug)) throw notFound();
    return { texts: await getProductTexts({ data: { slug: params.slug } }).catch(() => null) };
  },
  head: ({ params, loaderData }) => {
    const p = BY_SLUG.get(params.slug);
    if (!p) return {};
    const desc = (loaderData?.texts?.short || `${p.name} — ${p.brand}`).slice(0, 160);
    return {
      meta: [
        { title: `${p.name} | Vitrine Feminina` },
        { name: "description", content: desc },
        { property: "og:title", content: p.name },
        { property: "og:description", content: desc },
        { property: "og:type", content: "product" },
        { property: "og:image", content: imgLarge(p) },
        { property: "product:price:amount", content: priceOf(p).toFixed(2) },
        { property: "product:price:currency", content: "BRL" },
      ],
      links: [{ rel: "canonical", href: `/p/${p.slug}` }],
    };
  },
  component: Page,
});

function Page() {
  const { slug } = Route.useParams();
  const { texts } = Route.useLoaderData();
  const p = BY_SLUG.get(slug)!;
  return (
    <StoreLayout>
      <ProductPage p={p} texts={texts} />
    </StoreLayout>
  );
}
