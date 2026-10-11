import type { OrderItem } from "@/lib/cart";

/** Sessão do Pix compartilhada entre /checkout e /pedido/$id (client-side). */
export type PixSession = {
  id: string;
  qrcode: string;
  /** Valor em centavos. */
  amount: number;
  email: string;
  name: string;
  bundleId: string;
  bundleName: string;
  /** Peças físicas no pedido (0 em cobranças sem produto, ex.: só envio expresso). */
  units: number;
  /** Total dos produtos (reais). */
  productPrice: number;
  /** Itens da sacola, para a tela de obrigado e para a oferta pós-compra. */
  items?: OrderItem[];
  coupon?: string | null;
  /** Order bumps aceitos no checkout (valor em reais). */
  bumps?: { name: string; price: number }[];
  /** Formato antigo (um só bump). */
  bump?: { name: string; price: number };
  /** Upsell pós-compra: id do pedido original. */
  isUpsell?: boolean;
  parentId?: string;
  /** Upsell: o que foi comprado nesta cobrança (kit/seguro, ou só "expresso"). */
  upsellItems?: string[];
  /** Pedido principal: cobranças pós-compra já pagas (ofertas e envio expresso). */
  upsellId?: string;
  expressId?: string;
  frete: number;
  discount: number;
  createdAt: number;
  phone?: string;
  cpf?: string;
  utm?: Record<string, string | null>;
  fbp?: string | null;
  fbc?: string | null;
  method?: "pix";
};

const key = (id: string) => `pix:${id}`;
/** Pedidos guardados em localStorage somem depois deste prazo. */
const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Guarda a sessão em localStorage (vale para qualquer aba: no celular o cliente sai para o app do
 * banco e muitas vezes volta numa aba nova ou recarregada — sem isso ele pulava o upsell).
 */
export function savePixSession(s: PixSession): void {
  try {
    sessionStorage.setItem(key(s.id), JSON.stringify(s));
  } catch {
    // storage indisponível — a tela /pedido cai no fallback
  }
  try {
    pruneOld();
    localStorage.setItem(key(s.id), JSON.stringify(s));
  } catch {
    // storage indisponível
  }
}

export function loadPixSession(id: string): PixSession | null {
  const read = (st: Storage) => {
    try {
      const raw = st.getItem(key(id));
      return raw ? (JSON.parse(raw) as PixSession) : null;
    } catch {
      return null;
    }
  };
  const tab = typeof sessionStorage === "undefined" ? null : read(sessionStorage);
  const shared = typeof localStorage === "undefined" ? null : read(localStorage);
  // localStorage tem o progresso mais recente (upsellId/expressId salvos em outra aba).
  if (!tab && !shared) return null;
  return { ...(tab ?? {}), ...(shared ?? {}) } as PixSession;
}

function pruneOld(): void {
  const now = Date.now();
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (!k?.startsWith("pix:")) continue;
    try {
      const s = JSON.parse(localStorage.getItem(k) ?? "null") as PixSession | null;
      if (!s || now - (s.createdAt ?? 0) > MAX_AGE_MS) localStorage.removeItem(k);
    } catch {
      localStorage.removeItem(k);
    }
  }
}
