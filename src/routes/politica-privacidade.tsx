import { createFileRoute } from "@tanstack/react-router";
import { PolicyPage } from "@/components/site/PolicyPage";
import { brand } from "@/lib/brand";

export const Route = createFileRoute("/politica-privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade | Vitrine Feminina" },
      { name: "description", content: "Como a Vitrine Feminina protege seus dados pessoais." },
      { property: "og:title", content: "Política de Privacidade" },
      { property: "og:description", content: "Proteção de dados Vitrine Feminina." },
      { property: "og:url", content: "/politica-privacidade" },
    ],
    links: [{ rel: "canonical", href: "/politica-privacidade" }],
  }),
  component: () => (
    <PolicyPage
      title="Política de Privacidade"
      intro="A Vitrine Feminina respeita e protege os seus dados de acordo com a LGPD."
    >
      <h2>Dados coletados</h2>
      <p>
        Coletamos apenas os dados necessários para processar pedidos, enviar produtos e oferecer
        suporte.
      </p>
      <h2>Uso dos dados</h2>
      <ul>
        <li>Processamento de pedidos e pagamentos</li>
        <li>Envio dos produtos e comunicação transacional</li>
        <li>Suporte ao cliente</li>
      </ul>
      <h2>Cookies e pixels</h2>
      <p>
        Usamos cookies e pixels de parceiros de publicidade e análise (como Meta, TikTok e UTMify)
        para medir visitas e campanhas.
      </p>
      <h2>Segurança</h2>
      <p>Utilizamos criptografia, SSL e provedores certificados para proteger suas informações.</p>
      <h2>Seus direitos</h2>
      <p>
        Você pode solicitar acesso, correção ou exclusão de seus dados{" "}
        {brand.email ? `pelo e-mail ${brand.email}` : `pelo Instagram @${brand.instagram.handle}`}.
      </p>
    </PolicyPage>
  ),
});
