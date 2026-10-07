import "server-only";
import { cookies } from "next/headers";
import { CART_COOKIE, parseCartCookie, type CartLine } from "./cart-cookie";

/**
 * Read the cart cookie on the server (checkout + order placement). The cookie
 * carries ids + quantities only; `priceCart()` turns it into money and stock
 * state, so nothing the browser sends is trusted for pricing.
 *
 * The browser writes this cookie with `encodeURIComponent` (see CartProvider),
 * and `cookies()` hands back the value as sent — so the percent-encoded form
 * has to be decoded before parsing. Both forms are attempted because the
 * encoding depends on who wrote the cookie.
 */
export async function readCartFromCookies(): Promise<CartLine[]> {
  const store = await cookies();
  const raw = store.get(CART_COOKIE)?.value;
  if (!raw) return [];

  const direct = parseCartCookie(raw);
  if (direct.length > 0) return direct;

  try {
    return parseCartCookie(decodeURIComponent(raw));
  } catch {
    // Malformed encoding: treat as an empty cart rather than failing checkout.
    return [];
  }
}
