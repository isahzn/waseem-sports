"use server";

import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import { priceCart } from "@/lib/storefront/cart";
import { readCartFromCookies } from "@/lib/storefront/cart-server";
import { CART_COOKIE } from "@/lib/storefront/cart-cookie";
import { getShippingOptions } from "@/lib/orders/queries";
import { checkoutInput, toFieldErrors, toShippingAddress } from "@/lib/orders/schemas";
import { generateTrackingToken, hashTrackingToken } from "@/lib/orders/tracking";
import { mapOrderError } from "@/lib/orders/errors";
import { enqueueOrderNotification } from "@/lib/orders/notify";
import { checkRateLimit, clientIp } from "@/lib/security/ratelimit";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/security/logger";

export type CheckoutState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  /** Ask the client to re-price the cart (stock changed under the customer). */
  refreshCart?: boolean;
};

/** Field names the form sends; coerced here so the schema stays FormData-free. */
function formValues(formData: FormData) {
  const text = (key: string) => {
    const value = formData.get(key);
    return value === null ? undefined : String(value);
  };
  return {
    customer_name: text("customer_name") ?? "",
    customer_phone: text("customer_phone") ?? "",
    customer_email: text("customer_email") ?? "",
    address_line1: text("address_line1") ?? "",
    address_line2: text("address_line2") ?? "",
    city: text("city") ?? "",
    district: text("district") ?? "",
    postal_code: text("postal_code") ?? "",
    shipping_method: text("shipping_method") ?? "",
    notes: text("notes") ?? "",
    idempotency_key: text("idempotency_key") ?? "",
  };
}

/**
 * Place a guest COD order.
 *
 * Order of operations (mirrors `docs/ARCHITECTURE.md`):
 *   zod → rate limit → re-price from the DB → verify the delivery method →
 *   tracking token (32 random bytes, only its sha256+pepper is stored) →
 *   `place_order` RPC (one transaction: snapshot prices, fee from
 *   `shipping_rules`, reserve per `cod.reserve_stock_on`, idempotent on the
 *   client-generated key) → enqueue the notification row → clear the cart →
 *   redirect to the customer's tracking link.
 *
 * Nothing the browser sends is trusted for money: prices, the shipping fee and
 * the stock decision all come from the database.
 */
export async function placeOrder(_prev: CheckoutState, formData: FormData): Promise<CheckoutState> {
  const ip = clientIp(await headers());
  const limit = await checkRateLimit(`checkout:${ip}`, 10, 15 * 60 * 1000);
  if (!limit.allowed) {
    return { error: "Too many checkout attempts. Please wait a few minutes and try again." };
  }

  const parsed = checkoutInput.safeParse(formValues(formData));
  if (!parsed.success) {
    return { error: "Check the highlighted details and try again.", fieldErrors: toFieldErrors(parsed.error) };
  }
  const input = parsed.data;

  // The cart lives in the cookie, never in the request body.
  const lines = await readCartFromCookies();
  if (lines.length === 0) return { error: "Your cart is empty. Add something before checking out." };

  const preview = await priceCart(lines);
  const sellable = preview.lines.filter((l) => l.qty > 0);
  if (sellable.length === 0) {
    const blocking = preview.issues[0]?.message ?? "Nothing in your cart is available right now.";
    return { error: blocking, refreshCart: true };
  }
  const blocked = preview.issues.filter((i) => i.code === "removed" || i.code === "out_of_stock");
  if (blocked.length > 0) {
    return { error: blocked.map((i) => i.message).join(" "), refreshCart: true };
  }

  // Delivery method must be one the shop currently offers; the fee itself is
  // resolved inside `place_order` from shipping_rules.
  const options = await getShippingOptions();
  if (!options.some((o) => o.method === input.shipping_method)) {
    return { error: "Choose a delivery option.", fieldErrors: { shipping_method: ["Choose a delivery option."] } };
  }

  const token = generateTrackingToken();
  const tokenHash = hashTrackingToken(token);
  const items = sellable.map((l) => ({ variant_id: l.variantId, quantity: l.qty }));

  let placed: { id: string; order_number: string } | null = null;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("place_order", {
      p_idempotency_key: input.idempotency_key,
      p_tracking_token_hash: tokenHash,
      p_items: items,
      p_customer: {
        name: input.customer_name,
        phone: input.customer_phone,
        email: input.customer_email ?? "",
      },
      p_shipping_address: toShippingAddress(input),
      p_shipping_method: input.shipping_method,
      p_payment_method: "cod",
      p_notes: input.notes ?? undefined,
    });
    if (error) {
      const mapped = mapOrderError(error.message);
      logger.error("place_order failed", { code: mapped.code, detail: error.message.slice(0, 200) });
      return { error: mapped.message, refreshCart: mapped.refreshCart };
    }
    // PostgREST returns the composite as an object; tolerate a single-row array.
    const raw: unknown = data;
    const row = (Array.isArray(raw) ? raw[0] : raw) as { id?: string; order_number?: string } | null;
    if (!row?.id || !row.order_number) throw new Error("place_order returned no order");
    placed = { id: row.id, order_number: row.order_number };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    logger.error("place_order threw", { detail: detail.slice(0, 200) });
    return { error: mapOrderError(detail).message, refreshCart: mapOrderError(detail).refreshCart };
  }

  // Notifications are enqueued only and never affect the order (D27/D33).
  await enqueueOrderNotification({
    orderId: placed.id,
    event: "order_placed",
    recipient: input.customer_phone,
  });

  // The order exists now — the cart cookie is stale, clear it.
  const store = await cookies();
  store.set(CART_COOKIE, "", { path: "/", maxAge: 0 });

  redirect(`/order/${encodeURIComponent(placed.order_number)}?t=${encodeURIComponent(token)}`);
}
