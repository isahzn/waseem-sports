import { useSyncExternalStore } from "react";

/**
 * Guest order memory (client-only).
 *
 * Checkout is guest-only — there is no customer account and no sign-in — so
 * after an order is placed the confirmation page remembers `{ number, token }`
 * on this device and `/account` lists them. Nothing here is authoritative: the
 * tracking token is the only thing that unlocks an order and the server
 * re-checks it on every visit. This is a shortcut so the customer does not have
 * to dig their confirmation link out of their history.
 *
 * Also note the list is deliberately local: no ids, prices or statuses are ever
 * trusted from here when an order page is opened.
 */

export type RememberedOrder = {
  number: string;
  token: string;
  total: number;
  /** ISO timestamp from the order row. */
  placedAt: string;
  /** Raw `OrderStatus` at the time of placing (drives the `.steps` bar). */
  status: string;
  /** Human label for that status, as the customer saw it. */
  statusLabel: string;
};

const KEY = "ws_orders";
const LIMIT = 20;

/**
 * The customer-facing delivery chain, in the same order the tracking page
 * renders it (`order/[number]/page.tsx`). Cancelled / refunded / payment-failed
 * orders sit outside it and report -1.
 */
export const ORDER_LIFECYCLE = ["new", "confirmed", "processing", "shipped", "delivered"] as const;

export function lifecycleStep(status: string): number {
  return ORDER_LIFECYCLE.indexOf(status as (typeof ORDER_LIFECYCLE)[number]);
}

/** Stable empty snapshot: `useSyncExternalStore` compares identities. */
const EMPTY: RememberedOrder[] = [];

let snapshot: RememberedOrder[] = EMPTY;
let started = false;
const listeners = new Set<() => void>();

function isRemembered(value: unknown): value is RememberedOrder {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.number === "string" &&
    v.number.length > 0 &&
    typeof v.token === "string" &&
    v.token.length > 0 &&
    typeof v.total === "number" &&
    Number.isFinite(v.total) &&
    typeof v.placedAt === "string" &&
    typeof v.status === "string" &&
    typeof v.statusLabel === "string"
  );
}

function read(): RememberedOrder[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;
    const clean = parsed.filter(isRemembered).slice(0, LIMIT);
    return clean.length === 0 ? EMPTY : clean;
  } catch {
    // Corrupt entry, or storage unavailable (private mode): treat as empty.
    return EMPTY;
  }
}

function emit(): void {
  for (const listener of listeners) listener();
}

function start(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  snapshot = read();
  // Another tab may place or forget an order — mirror it here.
  window.addEventListener("storage", (event: StorageEvent) => {
    if (event.key === KEY || event.key === null) {
      snapshot = read();
      emit();
    }
  });
}

function write(next: RememberedOrder[]): void {
  snapshot = next.length === 0 ? EMPTY : next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked: keep the in-memory copy so this tab still works.
  }
  emit();
}

export function getRememberedOrders(): RememberedOrder[] {
  start();
  return snapshot;
}

/** Newest first, one entry per order number, capped at 20. */
export function rememberOrder(order: {
  number: string;
  token: string;
  total: number;
  placedAt: string;
  status: string;
  statusLabel: string;
}): void {
  start();
  if (typeof window === "undefined") return;

  const entry: RememberedOrder = {
    number: String(order.number).trim().slice(0, 40),
    token: String(order.token),
    total: Number.isFinite(order.total) ? order.total : 0,
    placedAt: String(order.placedAt),
    status: String(order.status),
    statusLabel: String(order.statusLabel).slice(0, 60),
  };
  if (!entry.number || !entry.token) return;

  write([entry, ...snapshot.filter((o) => o.number !== entry.number)].slice(0, LIMIT));
}

/** Remove one order from this device only (the order itself is untouched). */
export function forgetOrder(number: string): void {
  start();
  write(snapshot.filter((o) => o.number !== number));
}

export function subscribe(listener: () => void): () => void {
  start();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Live view of the remembered orders (empty during SSR). */
export function useRememberedOrders(): RememberedOrder[] {
  return useSyncExternalStore(subscribe, getRememberedOrders, () => EMPTY);
}
