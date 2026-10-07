/**
 * Order events that produce a customer notification. Pure data (no server
 * imports) so the admin can share the labels and the toggle keys.
 *
 * The event names match `notifications.event` and
 * `NOTIFICATION_EVENT_FOR_STATUS` in `lib/orders/status.ts` — they are the
 * `dedupe_key` middle segment (`orderId:event:channel`).
 */

export const NOTIFICATION_EVENTS = [
  "order_placed",
  "order_confirmed",
  "order_processing",
  "order_shipped",
  "order_delivered",
  "order_cancelled",
  "payment_failed",
  "order_refunded",
] as const;

export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number];

export const EVENT_LABELS: Record<string, string> = {
  order_placed: "Order placed",
  order_confirmed: "Order confirmed",
  order_processing: "Order processing",
  order_shipped: "Order shipped",
  order_delivered: "Order delivered",
  order_cancelled: "Order cancelled",
  payment_failed: "Payment failed",
  order_refunded: "Order refunded",
};

/** Human label for any event string, including unknown ones. */
export function eventLabel(event: string): string {
  return EVENT_LABELS[event] ?? event.replace(/_/g, " ");
}

/** `store_settings` key for one event's on/off toggle. Default: on. */
export function eventToggleKey(event: string): string {
  return `notifications.events.${event}`;
}
