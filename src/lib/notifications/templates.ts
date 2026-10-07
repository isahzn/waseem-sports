import "server-only";
import { getSetting } from "@/lib/settings";
import { formatLKR } from "@/lib/storefront/money";

/**
 * Message templates (PHASE 06 task 4).
 *
 * Templates live in `store_settings` under `notifications.templates.<event>`
 * so the owner can rewrite them in the admin without a deploy. Placeholders are
 * a fixed, documented set — an unknown or missing value renders empty rather
 * than printing `undefined` or leaking `[object Object]`.
 *
 * Plain text only: WhatsApp body, short, no HTML, no provider markup.
 */

export const TEMPLATE_PLACEHOLDERS = [
  "order_number",
  "customer_name",
  "item_count",
  "total",
  "currency",
  "tracking_url",
  "shop_name",
  "status_text",
] as const;

export type TemplateVars = Partial<Record<(typeof TEMPLATE_PLACEHOLDERS)[number], string>>;

/** Built-in fallbacks — used for any event with no stored override. */
export const DEFAULT_TEMPLATES: Record<string, string> = {
  order_placed:
    "Hi {customer_name}, thanks for your order {order_number} at {shop_name}! Total: {total}. Track it here: {tracking_url}",
  order_confirmed:
    "Good news — order {order_number} is confirmed and being prepared. Track it: {tracking_url}",
  order_processing: "Order {order_number} is being packed. Track it: {tracking_url}",
  order_shipped: "Order {order_number} is on the way. Track it: {tracking_url}",
  order_delivered: "Order {order_number} was delivered. Thank you for shopping with {shop_name}!",
  order_cancelled:
    "Order {order_number} has been cancelled. Message us on WhatsApp if you have any questions.",
  payment_failed: "The payment for order {order_number} did not go through. Track it: {tracking_url}",
  order_refunded: "Order {order_number} has been refunded.",
};

/** The template for an event: the stored override, else the built-in default. */
export async function templateFor(event: string): Promise<string> {
  const stored = await getSetting<string>(`notifications.templates.${event}`, "");
  if (typeof stored === "string" && stored.trim() !== "") return stored;
  return DEFAULT_TEMPLATES[event] ?? `Update on your order {order_number}.`;
}

/**
 * Replace `{placeholder}` tokens. Pure and total: every token becomes either the
 * supplied value or the empty string, and runs of whitespace are collapsed so a
 * missing value cannot leave awkward gaps.
 */
export function renderTemplate(template: string, vars: TemplateVars): string {
  const body = template.replace(/\{([a-z_]+)\}/g, (_match, key: string) => {
    const value = vars[key as keyof TemplateVars];
    return value ?? "";
  });
  return body
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
}

/** Convenience: format a money value the way the storefront does. */
export function templateTotal(total: number | string): string {
  return formatLKR(total);
}
