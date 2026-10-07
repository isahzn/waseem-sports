/**
 * Order lifecycle vocabulary — shared by the admin, the customer tracking page
 * and the notification enqueue. Pure data (no server imports) so client
 * components can use the same labels as the server.
 */

export const ORDER_STATUSES = [
  "new",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "payment_failed",
  "refunded",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const STATUS_LABELS: Record<OrderStatus, string> = {
  new: "New",
  confirmed: "Confirmed",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  payment_failed: "Payment failed",
  refunded: "Refunded",
};

/** Plain-language status text for the customer's tracking page. */
export const CUSTOMER_STATUS_TEXT: Record<OrderStatus, string> = {
  new: "We received your order and will confirm it shortly.",
  confirmed: "Your order is confirmed and being prepared.",
  processing: "We are packing your order.",
  shipped: "Your order is on the way.",
  delivered: "Your order has been delivered. Thank you!",
  cancelled: "This order was cancelled. Message us if you have any questions.",
  payment_failed: "The payment for this order did not go through.",
  refunded: "This order has been refunded.",
};

/**
 * Allowed status transitions. COD orders move new → confirmed → processing →
 * shipped → delivered; cancel is possible until the order ships. Payment
 * outcomes are recorded by PHASE 08 (card payments).
 */
export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  new: ["confirmed", "cancelled", "payment_failed"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: ["refunded"],
  cancelled: [],
  payment_failed: ["cancelled"],
  refunded: [],
};

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && (ORDER_STATUSES as readonly string[]).includes(value);
}

export function nextStatuses(from: OrderStatus): OrderStatus[] {
  return ALLOWED_TRANSITIONS[from] ?? [];
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return nextStatuses(from).includes(to);
}

/**
 * Stock side-effect of entering a status (executed through the service-role
 * `adjust_order_stock` RPC, which is idempotent and no-ops when nothing is
 * reserved):
 *  - `confirmed` reserves, but only when `cod.reserve_stock_on = 'confirmed'`
 *    (the server reads that setting; with the default `placed` policy the
 *    order was already reserved at placement).
 *  - `shipped` commits (on_hand and reserved both come down — stock leaves).
 *  - `cancelled` releases the reservation.
 */
export const STOCK_ACTION_FOR_STATUS: Partial<Record<OrderStatus, "reserve" | "release" | "commit">> = {
  confirmed: "reserve",
  shipped: "commit",
  cancelled: "release",
};

/**
 * Outbox event name per status — the `notifications.event` value PHASE 06's
 * templates key off (`specs/whatsapp-waha-spec.md` §5.1). `new` is the
 * placement event; the remaining statuses follow the order lifecycle.
 */
export const NOTIFICATION_EVENT_FOR_STATUS: Record<OrderStatus, string> = {
  new: "order_placed",
  confirmed: "order_confirmed",
  processing: "order_processing",
  shipped: "order_shipped",
  delivered: "order_delivered",
  cancelled: "order_cancelled",
  payment_failed: "payment_failed",
  refunded: "order_refunded",
};

/** Statuses that count as revenue on the dashboard. */
export const REVENUE_STATUSES: OrderStatus[] = ["confirmed", "processing", "shipped", "delivered"];
