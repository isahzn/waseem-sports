"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CART_COOKIE, parseCartCookie, serializeCart, type CartLine } from "@/lib/storefront/cart-cookie";
import type { CartPreview } from "@/lib/storefront/cart";
import { refreshCart } from "../cart/actions";

function readCookie(): CartLine[] {
  if (typeof document === "undefined") return [];
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${CART_COOKIE}=`));
  if (!match) return [];
  try {
    return parseCartCookie(decodeURIComponent(match.split("=").slice(1).join("=")));
  } catch {
    return [];
  }
}

function writeCookie(lines: CartLine[]) {
  const value = encodeURIComponent(serializeCart(lines));
  // 30 days, Lax, path-wide. Contents are ids+qty only — priced server-side.
  document.cookie = `${CART_COOKIE}=${value}; Path=/; Max-Age=${30 * 24 * 3600}; SameSite=Lax`;
}

type CartContextValue = {
  items: CartLine[];
  preview: CartPreview | null;
  loading: boolean;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  add: (variantId: string, qty?: number) => void;
  setQty: (variantId: string, qty: number) => void;
  remove: (variantId: string) => void;
  /** Drop every line (used after an order is placed). */
  clear: () => void;
  refresh: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  // Lazy cookie init (client-only read, SSR-safe via the typeof guard).
  const [items, setItems] = useState<CartLine[]>(() => readCookie());
  const [preview, setPreview] = useState<CartPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOpen, setOpen] = useState(false);

  const refresh = useCallback(async (lines: CartLine[]) => {
    setLoading(true);
    try {
      const p = await refreshCart(lines);
      setPreview(p);
    } catch {
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Price the cookie cart once on mount. State updates happen inside the
  // async refresh callback, not synchronously in the effect body.
  const initialised = useRef(false);
  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;
    void refresh(readCookie());
  }, [refresh]);

  const update = useCallback(
    (next: CartLine[]) => {
      setItems(next);
      writeCookie(next);
      void refresh(next);
    },
    [refresh],
  );

  const add = useCallback(
    (variantId: string, qty = 1) => {
      const found = items.find((l) => l.variantId === variantId);
      const next = found
        ? items.map((l) => (l.variantId === variantId ? { ...l, qty: Math.min(100, l.qty + qty) } : l))
        : [...items, { variantId, qty: Math.min(100, Math.max(1, qty)) }].slice(0, 50);
      update(next);
      setOpen(true);
    },
    [items, update],
  );

  const setQty = useCallback(
    (variantId: string, qty: number) => {
      if (qty < 1) {
        update(items.filter((l) => l.variantId !== variantId));
        return;
      }
      update(items.map((l) => (l.variantId === variantId ? { ...l, qty: Math.min(100, qty) } : l)));
    },
    [items, update],
  );

  const remove = useCallback(
    (variantId: string) => update(items.filter((l) => l.variantId !== variantId)),
    [items, update],
  );

  const clear = useCallback(() => update([]), [update]);

  const refreshNow = useCallback(() => {
    void refresh(readCookie());
  }, [refresh]);

  const value = useMemo(
    () => ({ items, preview, loading, isOpen, setOpen, add, setQty, remove, clear, refresh: refreshNow }),
    [items, preview, loading, isOpen, add, setQty, remove, clear, refreshNow],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
