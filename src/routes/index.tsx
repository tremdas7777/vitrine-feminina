import { createFileRoute, redirect } from "@tanstack/react-router";

// A loja (HTML/CSS/JS) fica em public/loja e é servida como arquivo estático.
const STORE_URL = "/loja/index.html";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ href: STORE_URL, reloadDocument: true });
  },
  component: Index,
});

function Index() {
  return (
    <meta httpEquiv="refresh" content={`0; url=${STORE_URL}`} />
  );
}
