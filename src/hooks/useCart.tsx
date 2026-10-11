import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  cartSubtotal,
  couponPct,
  lineKey,
  MAX_LINES,
  MAX_QTY,
  resolveCart,
  type CartLine,
  type ResolvedLine,
} from "@/lib/cart";

const CART_KEY = "vf_cart";
const FAVS_KEY = "vf_favs";
const COUPON_KEY = "vf_coupon";

const read = <T,>(k: string, d: T): T => {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : d;
  } catch {
    return d;
  }
};
const write = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    // storage indisponível (aba anônima, bloqueio): a sacola vale só nesta visita
  }
};

type CartState = {
  /** false até ler o localStorage (evita piscar "sacola vazia" no primeiro render). */
  ready: boolean;
  lines: CartLine[];
  /** Linhas válidas, com preço do catálogo. */
  resolved: ResolvedLine[];
  subtotal: number;
  count: number;
  add: (line: CartLine) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  coupon: string | null;
  setCoupon: (code: string | null) => boolean;
  favs: Set<number>;
  toggleFav: (id: number) => boolean;
  drawerOpen: boolean;
  setDrawerOpen: (v: boolean) => void;
};

const Ctx = createContext<CartState | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [favs, setFavs] = useState<Set<number>>(new Set());
  const [coupon, setCouponState] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setLines(read<CartLine[]>(CART_KEY, []).slice(0, MAX_LINES));
    setFavs(new Set(read<number[]>(FAVS_KEY, [])));
    setCouponState(read<string | null>(COUPON_KEY, null));
    setReady(true);
  }, []);

  const save = useCallback((next: CartLine[]) => {
    setLines(next);
    write(CART_KEY, next);
  }, []);

  const add = useCallback((line: CartLine) => {
    setLines((cur) => {
      const k = lineKey(line);
      const ex = cur.find((l) => lineKey(l) === k);
      const next = ex
        ? cur.map((l) => (l === ex ? { ...l, qty: Math.min(MAX_QTY, l.qty + line.qty) } : l))
        : [...cur, line].slice(-MAX_LINES);
      write(CART_KEY, next);
      return next;
    });
  }, []);

  const value = useMemo<CartState>(() => {
    const resolved = resolveCart(lines);
    return {
      ready,
      lines,
      resolved,
      subtotal: cartSubtotal(resolved),
      count: resolved.reduce((s, l) => s + l.line.qty, 0),
      add,
      setQty: (key, qty) =>
        save(
          qty < 1
            ? lines.filter((l) => lineKey(l) !== key)
            : lines.map((l) => (lineKey(l) === key ? { ...l, qty: Math.min(MAX_QTY, qty) } : l)),
        ),
      remove: (key) => save(lines.filter((l) => lineKey(l) !== key)),
      clear: () => save([]),
      coupon,
      setCoupon: (code) => {
        const c = code?.trim().toUpperCase() || null;
        if (c && !couponPct(c)) return false;
        setCouponState(c);
        write(COUPON_KEY, c);
        return true;
      },
      favs,
      toggleFav: (id) => {
        const next = new Set(favs);
        const on = !next.has(id);
        if (on) next.add(id);
        else next.delete(id);
        setFavs(next);
        write(FAVS_KEY, [...next]);
        return on;
      },
      drawerOpen,
      setDrawerOpen,
    };
  }, [ready, lines, coupon, favs, drawerOpen, add, save]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart(): CartState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCart fora do CartProvider");
  return v;
}
