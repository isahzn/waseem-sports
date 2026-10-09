import { z } from "zod";

/**
 * Validation for checkout, tracking and the Phase 05 admin surfaces.
 * Pure data schemas: server actions coerce `FormData` to plain values first
 * (same pattern as `lib/catalog/schemas.ts`).
 */

// ---------- shared fields ----------

export const phoneField = z
  .string()
  .trim()
  .max(30, "Phone number is too long.")
  .transform((v) => v.replace(/[\s()\-.]/g, ""))
  .refine((v) => /^\+?\d{9,15}$/.test(v), "Enter a phone number we can reach you on.");

export const optionalText = (max: number, label = "Value") =>
  z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? null : String(v).trim()),
    z.string().max(max, `${label} must be ${max} characters or fewer.`).nullable(),
  );

export const requiredText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be ${max} characters or fewer.`);

export const optionalMoney = z.preprocess(
  (v) => (v === "" || v === undefined || v === null ? null : v),
  z.number().min(0, "Amount cannot be negative.").max(999999999.99).nullable(),
);

/** Empty string / undefined become null (optional whole numbers). */
const optionalInt = (min: number, max: number, label: string) =>
  z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? null : v),
    z
      .number({ invalid_type_error: `${label} must be a whole number.` })
      .int(`${label} must be a whole number.`)
      .min(min)
      .max(max, `${label} is too large.`)
      .nullable(),
  );

// ---------- checkout (D12: name, phone, address required; email optional) ----------

export const checkoutInput = z.object({
  customer_name: requiredText(120, "Name"),
  customer_phone: phoneField,
  customer_email: z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? null : String(v).trim()),
    z.string().email("Enter a valid email address.").max(200).nullable(),
  ),
  address_line1: requiredText(200, "Address"),
  address_line2: optionalText(200, "Address line 2"),
  city: requiredText(100, "City / town"),
  district: optionalText(100, "District"),
  postal_code: optionalText(20, "Postal code"),
  shipping_method: requiredText(40, "Delivery method"),
  notes: optionalText(500, "Order note"),
  idempotency_key: z.string().uuid("Invalid checkout reference — reload the page and try again."),
});

export type CheckoutInput = z.infer<typeof checkoutInput>;

/** Snapshot shape stored in `orders.shipping_address` (jsonb). */
export function toShippingAddress(input: CheckoutInput): Record<string, string> {
  const address: Record<string, string> = {
    line1: input.address_line1,
    city: input.city,
    country: "LK",
  };
  if (input.address_line2) address.line2 = input.address_line2;
  if (input.district) address.district = input.district;
  if (input.postal_code) address.postal_code = input.postal_code;
  return address;
}

// ---------- tracking lookup ----------

export const trackingLookupInput = z.object({
  order_number: requiredText(40, "Order number"),
  token: requiredText(200, "Tracking code"),
});

// ---------- admin: orders ----------

export const orderStatusFilters = [
  "all",
  "new",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "payment_failed",
  "refunded",
] as const;

export const adminOrderFilters = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  status: z.enum(orderStatusFilters).catch("all"),
  /** Fixes §3.6: "Needs action" view — new orders plus payments waiting. */
  need: z.enum(["action"]).optional().catch(undefined),
  from: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .optional()
    .catch(undefined),
  to: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .optional()
    .catch(undefined),
  page: z.coerce.number().int().min(1).catch(1),
});

export type AdminOrderFilters = z.infer<typeof adminOrderFilters>;

export const statusChangeInput = z.object({
  order_id: z.string().uuid("Invalid order."),
  to_status: z.enum(orderStatusFilters.filter((s) => s !== "all") as [string, ...string[]]),
  note: optionalText(500, "Note"),
});

export const orderNotesInput = z.object({
  order_id: z.string().uuid("Invalid order."),
  notes: optionalText(1000, "Internal note"),
});

// ---------- admin: shipping rules ----------

const codeArray = z.array(z.string().trim().min(2).max(60)).max(30).default([]);

export const shippingRuleInput = z.object({
  name: requiredText(120, "Rule name"),
  country_codes: codeArray,
  regions: codeArray,
  method: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Method is required.")
    .max(40)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens only."),
  fee: z.number().min(0, "Fee cannot be negative.").max(999999999.99),
  free_over: optionalMoney,
  est_days_min: optionalInt(0, 365, "Minimum days"),
  est_days_max: optionalInt(0, 365, "Maximum days"),
  is_active: z.boolean().default(true),
  sort_order: z.number().int().min(0).max(9999).default(0),
});

export type ShippingRuleInput = z.infer<typeof shippingRuleInput>;

// ---------- admin: COD reserve policy (D2) ----------

export const reservePolicyInput = z.object({
  reserve_stock_on: z.enum(["placed", "confirmed"]),
});

// ---------- helpers ----------

export function toFieldErrors(error: z.ZodError): Record<string, string[]> {
  return error.flatten().fieldErrors as Record<string, string[]>;
}

/** Split a textarea/CSV field into a trimmed, de-duplicated list. */
export function splitList(raw: string | null): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  for (const part of raw.split(/[,\n]/)) {
    const value = part.trim();
    if (value) seen.add(value.toUpperCase().length === 2 ? value.toUpperCase() : value);
  }
  return [...seen];
}

export function formText(value: FormDataEntryValue | null): string | null {
  if (value === null) return null;
  return String(value);
}

export function formBool(value: FormDataEntryValue | null): boolean {
  return value === "on" || value === "true" || value === "1";
}

export function formNumber(value: FormDataEntryValue | null): number | undefined {
  if (value === null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : Number.NaN;
}
