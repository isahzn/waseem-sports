import { z } from "zod";

/**
 * Cart cookie helpers — CLIENT-SAFE (no server imports).
 * The cookie carries ids + qty only; pricing lives in `cart.ts` (server).
 */

export const CART_COOKIE = "ws_cart";
export const MAX_LINES = 50;
export const MAX_QTY = 100; // mirrors order.max_qty_per_variant default

export type CartLine = { variantId: string; qty: number };

const lineSchema = z.object({
  variantId: z.string().uuid(),
  qty: z.number().int().min(1).max(MAX_QTY),
});

/** Parse the cart cookie defensively — tampered content yields an empty cart, never a crash. */
export function parseCartCookie(raw: string | undefined): CartLine[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw.slice(0, 8000));
    if (!Array.isArray(parsed)) return [];
    const out: CartLine[] = [];
    for (const entry of parsed.slice(0, MAX_LINES)) {
      const r = lineSchema.safeParse(entry);
      if (r.success) out.push(r.data);
    }
    // Merge duplicate variant lines (cookie hand-edits shouldn't double-charge).
    const merged = new Map<string, number>();
    for (const l of out) merged.set(l.variantId, Math.min(MAX_QTY, (merged.get(l.variantId) ?? 0) + l.qty));
    return [...merged.entries()].map(([variantId, qty]) => ({ variantId, qty }));
  } catch {
    return [];
  }
}

export function serializeCart(lines: CartLine[]): string {
  return JSON.stringify(lines.slice(0, MAX_LINES));
}
