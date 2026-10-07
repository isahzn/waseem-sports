"use server";

import { priceCart, type CartPreview } from "@/lib/storefront/cart";
import type { CartLine } from "@/lib/storefront/cart-cookie";

/** Re-price the cookie cart authoritatively. Never trusts client prices. */
export async function refreshCart(lines: CartLine[]): Promise<CartPreview> {
  const clean = (Array.isArray(lines) ? lines : []).slice(0, 50);
  return priceCart(clean);
}
