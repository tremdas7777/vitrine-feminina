import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { brand } from "@/lib/brand";
import { BRANDS, CATEGORIES, COLLECTIONS, PRODUCTS } from "@/lib/catalog";

const BASE_URL = brand.siteUrl;

const paths = [
  "/",
  ...CATEGORIES.flatMap((c) => [`/c/${c.slug}`, ...c.subs.map((s) => `/c/${c.slug}/${s.slug}`)]),
  ...Object.keys(COLLECTIONS).map((c) => `/colecao/${c}`),
  ...BRANDS.map((b) => `/marca/${b.slug}`),
  ...PRODUCTS.filter((p) => p.inStock).map((p) => `/p/${p.slug}`),
  "/sobre",
  "/contato",
  "/faq",
  "/rastreio",
  "/politica-envio",
  "/politica-privacidade",
  "/politica-reembolso",
];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...paths.map(
            (p) => `  <url><loc>${BASE_URL}${p}</loc><changefreq>weekly</changefreq></url>`,
          ),
          `</urlset>`,
        ].join("\n");
        return new Response(xml, {
          headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
