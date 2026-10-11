import { createFileRoute, Link } from "@tanstack/react-router";
import { PolicyPage } from "@/components/site/PolicyPage";
import { brand } from "@/lib/brand";

export const Route = createFileRoute("/contato")({
  head: () => ({
    meta: [
      { title: `Contato | ${brand.name}` },
      { name: "description", content: `Fale com a equipe ${brand.name}.` },
      { property: "og:title", content: `Contato ${brand.name}` },
      { property: "og:url", content: "/contato" },
    ],
    links: [{ rel: "canonical", href: "/contato" }],
  }),
  component: () => (
    <PolicyPage
      eyebrow="Atendimento"
      title="Fale conosco"
      intro="Dúvida sobre numeração, troca ou o seu pedido? A gente responde rapidinho."
    >
      <div className="contact-cards">
        {brand.email && (
          <a className="contact-card" href={`mailto:${brand.email}`}>
            <b>E-mail</b>
            <small>{brand.email}</small>
          </a>
        )}
        <a
          className="contact-card"
          href={brand.instagram.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          <b>Instagram</b>
          <small>@{brand.instagram.handle} — mande uma mensagem direta</small>
        </a>
        <Link className="contact-card" to="/rastreio">
          <b>Rastrear pedido</b>
          <small>Acompanhe a entrega pelo CPF usado na compra</small>
        </Link>
        <Link className="contact-card" to="/faq">
          <b>Perguntas frequentes</b>
          <small>Tamanhos, trocas, prazos e pagamento</small>
        </Link>
      </div>
      {brand.company.legalName && (
        <p>
          {brand.company.legalName}
          {brand.company.cnpj && ` · CNPJ ${brand.company.cnpj}`}
        </p>
      )}
    </PolicyPage>
  ),
});
