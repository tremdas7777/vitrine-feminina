import type { ReactNode } from "react";
import { StoreLayout } from "@/components/store/StoreLayout";

/** Páginas institucionais (sobre, contato, FAQ, políticas, rastreio) dentro do layout da loja. */
export function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <StoreLayout>
      <div className="page container">{children}</div>
    </StoreLayout>
  );
}
