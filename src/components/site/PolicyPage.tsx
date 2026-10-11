import type { ReactNode } from "react";
import { SiteLayout } from "./Layout";

export function PolicyPage({
  eyebrow = "Políticas",
  title,
  intro,
  children,
}: {
  eyebrow?: string;
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <SiteLayout>
      <article className="prose">
        <span className="eyebrow">{eyebrow}</span>
        <h1 className="title">{title}</h1>
        <p className="prose__intro">{intro}</p>
        {children}
      </article>
    </SiteLayout>
  );
}
