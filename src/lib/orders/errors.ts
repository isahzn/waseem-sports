/**
 * Maps the named PL/pgSQL exceptions raised by `place_order` /
 * `adjust_order_stock` (and transport failures) to messages a customer or the
 * owner can act on. Pure module — no server imports, so it is usable from any
 * layer and easy to reason about.
 */

export type OrderErrorCode =
  | "STOCK"
  | "UNAVAILABLE"
  | "QUANTITY"
  | "EMPTY_CART"
  | "INVALID_INPUT"
  | "CONFLICT"
  | "SERVER";

export type OrderErrorInfo = {
  code: OrderErrorCode;
  message: string;
  /** True when the customer's cart should be re-priced before retrying. */
  refreshCart?: boolean;
};

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/**
 * `place_order` raises `<NAME>` or `<NAME>:<uuid>` (variant id). Match on the
 * name only — the id is internal and must never be shown to a customer.
 */
export function mapOrderError(rawMessage: string | null | undefined): OrderErrorInfo {
  const message = (rawMessage ?? "").toUpperCase();

  if (message.includes("INSUFFICIENT_STOCK")) {
    return {
      code: "STOCK",
      message: "An item in your cart just sold out. We have refreshed your cart — please review and try again.",
      refreshCart: true,
    };
  }
  if (message.includes("UNAVAILABLE")) {
    return {
      code: "UNAVAILABLE",
      message: "An item in your cart is no longer available. We have refreshed your cart — please review and try again.",
      refreshCart: true,
    };
  }
  if (message.includes("INVALID_QUANTITY")) {
    return {
      code: "QUANTITY",
      message: "Some quantities are higher than we can sell in one order. Please reduce them and try again.",
      refreshCart: true,
    };
  }
  if (message.includes("EMPTY_CART")) {
    return { code: "EMPTY_CART", message: "Your cart is empty. Add something before checking out." };
  }
  if (
    message.includes("BAD_CUSTOMER") ||
    message.includes("BAD_ITEM") ||
    message.includes("BAD_TOKEN") ||
    message.includes("BAD_IDEMPOTENCY_KEY") ||
    message.includes("BAD_ACTION") ||
    message.includes("BAD_REASON") ||
    message.includes("BAD_ADJUSTMENT") ||
    message.includes("VARIANT_MISSING")
  ) {
    return {
      code: "INVALID_INPUT",
      message: "We could not process that. Please check the details and try again.",
    };
  }
  if (message.includes("ORDER_CONFLICT")) {
    return {
      code: "CONFLICT",
      message: "That order could not be completed. Please try again.",
    };
  }
  if (message.includes("ORDER_NOT_FOUND")) {
    return { code: "INVALID_INPUT", message: "That order no longer exists." };
  }
  return {
    code: "SERVER",
    message: "Something went wrong placing your order. Please try again — you have not been charged.",
  };
}

/** True when the raw error carries a variant uuid (for server-side logging only). */
export function errorMentionsVariant(rawMessage: string | null | undefined, variantId: string): boolean {
  const message = rawMessage ?? "";
  return UUID.test(message) && message.includes(variantId);
}
