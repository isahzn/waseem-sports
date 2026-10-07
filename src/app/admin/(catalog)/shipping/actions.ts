"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { writeAudit } from "@/lib/catalog/audit";
import {
  formBool,
  formNumber,
  formText,
  reservePolicyInput,
  shippingRuleInput,
  splitList,
  toFieldErrors,
  type ShippingRuleInput,
} from "@/lib/orders/schemas";
import { logger } from "@/lib/security/logger";
import { getReservePolicy, setSetting } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";
import type { ConfirmState } from "../_components/ConfirmSubmit";
import type { ReservePolicyState } from "./ReservePolicyForm";
import type { ShippingFormState } from "./ShippingForm";

const uuidField = z.string().uuid();

/** Optional numeric form entry -> number | null (never NaN, never ""). */
function optionalNumber(value: FormDataEntryValue | null): number | null {
  const n = formNumber(value);
  return n === undefined || Number.isNaN(n) ? null : n;
}

function formValues(formData: FormData) {
  return {
    name: formText(formData.get("name")) ?? "",
    country_codes: splitList(formText(formData.get("country_codes"))),
    regions: splitList(formText(formData.get("regions"))),
    method: formText(formData.get("method")) ?? "",
    fee: optionalNumber(formData.get("fee")),
    free_over: optionalNumber(formData.get("free_over")),
    est_days_min: optionalNumber(formData.get("est_days_min")),
    est_days_max: optionalNumber(formData.get("est_days_max")),
    is_active: formBool(formData.get("is_active")),
    sort_order: formNumber(formData.get("sort_order")) ?? 0,
  };
}

type Validated =
  | { ok: true; data: ShippingRuleInput }
  | { ok: false; state: ShippingFormState };

/**
 * Coerce the form, run the shared zod schema, then add the two checks the
 * schema cannot express in a friendly way (fee presence, ETA ordering).
 */
function validate(formData: FormData): Validated {
  const values = formValues(formData);

  if (values.fee === null || Number.isNaN(values.fee)) {
    return {
      ok: false,
      state: {
        error: "Check the highlighted fields.",
        fieldErrors: { fee: ["Enter the delivery fee — use 0 for free delivery."] },
      },
    };
  }

  const parsed = shippingRuleInput.safeParse(values);
  if (!parsed.success) {
    return { ok: false, state: { error: "Check the highlighted fields.", fieldErrors: toFieldErrors(parsed.error) } };
  }

  const { est_days_min: min, est_days_max: max } = parsed.data;
  if (min !== null && max !== null && min > max) {
    return {
      ok: false,
      state: {
        error: "Check the highlighted fields.",
        fieldErrors: { est_days_max: ["The maximum days cannot be fewer than the minimum."] },
      },
    };
  }

  return { ok: true, data: parsed.data };
}

async function authorize(): Promise<{ userId: string; role: string } | null> {
  try {
    const admin = await requireAdmin();
    return { userId: admin.userId, role: admin.role };
  } catch {
    return null;
  }
}

export async function createShippingRule(
  _prev: ShippingFormState,
  formData: FormData,
): Promise<ShippingFormState> {
  const admin = await authorize();
  if (!admin) return { error: "Sign in required." };

  const validated = validate(formData);
  if (!validated.ok) return validated.state;

  const db = await createClient();
  const { data, error } = await db.from("shipping_rules").insert(validated.data).select("id").single();
  if (error || !data) {
    logger.error("shipping rule create failed", { error: error?.message });
    return { error: "Could not save the delivery rule. Try again." };
  }

  await writeAudit({
    actor: admin.userId,
    action: "shipping_rule.create",
    entity: "shipping_rules",
    entityId: data.id,
    meta: { name: validated.data.name, method: validated.data.method, fee: validated.data.fee },
  });
  revalidatePath("/admin/shipping");
  redirect("/admin/shipping");
}

export async function updateShippingRule(
  id: string,
  _prev: ShippingFormState,
  formData: FormData,
): Promise<ShippingFormState> {
  const admin = await authorize();
  if (!admin) return { error: "Sign in required." };
  if (!uuidField.safeParse(id).success) return { error: "Invalid delivery rule." };

  const validated = validate(formData);
  if (!validated.ok) return validated.state;

  const db = await createClient();
  const { error } = await db.from("shipping_rules").update(validated.data).eq("id", id);
  if (error) {
    logger.error("shipping rule update failed", { error: error.message });
    return { error: "Could not save the delivery rule. Try again." };
  }

  await writeAudit({
    actor: admin.userId,
    action: "shipping_rule.update",
    entity: "shipping_rules",
    entityId: id,
    meta: { name: validated.data.name, method: validated.data.method, fee: validated.data.fee, is_active: validated.data.is_active },
  });
  revalidatePath("/admin/shipping");
  redirect("/admin/shipping");
}

/**
 * Activate / deactivate a rule. Rules are never deleted — the storefront only
 * offers active ones, and past orders keep their snapshot either way.
 */
async function setActive(id: string, isActive: boolean): Promise<ConfirmState> {
  const admin = await authorize();
  if (!admin) return { error: "Sign in required." };
  if (!uuidField.safeParse(id).success) return { error: "Invalid delivery rule." };

  const db = await createClient();
  const { error } = await db.from("shipping_rules").update({ is_active: isActive }).eq("id", id);
  if (error) {
    logger.error("shipping rule active toggle failed", { error: error.message });
    return { error: "Could not update the delivery rule. Try again." };
  }

  await writeAudit({
    actor: admin.userId,
    action: isActive ? "shipping_rule.activate" : "shipping_rule.deactivate",
    entity: "shipping_rules",
    entityId: id,
  });
  revalidatePath("/admin/shipping");
  redirect("/admin/shipping");
}

export async function deactivateShippingRule(_prev: ConfirmState, formData: FormData): Promise<ConfirmState> {
  return setActive(String(formData.get("id") ?? ""), false);
}

export async function activateShippingRule(_prev: ConfirmState, formData: FormData): Promise<ConfirmState> {
  return setActive(String(formData.get("id") ?? ""), true);
}

/**
 * COD stock-reservation policy (D2). Records the owner's choice; `place_order`
 * reads the setting from the database and enforces it server-side — nothing
 * about stock policy is decided in the browser.
 */
export async function saveReservePolicy(
  _prev: ReservePolicyState,
  formData: FormData,
): Promise<ReservePolicyState> {
  const admin = await authorize();
  if (!admin) return { error: "Sign in required." };

  const parsed = reservePolicyInput.safeParse({ reserve_stock_on: formText(formData.get("reserve_stock_on")) });
  if (!parsed.success) return { error: "Choose one of the two options." };

  const from = await getReservePolicy();
  const to = parsed.data.reserve_stock_on;
  if (from === to) return { ok: true };

  const { error } = await setSetting("cod.reserve_stock_on", to, admin.userId);
  if (error) {
    logger.error("reserve policy save failed", { error });
    return { error: "Could not save the stock policy. Try again." };
  }

  await writeAudit({
    actor: admin.userId,
    action: "settings.reserve_policy",
    entity: "store_settings",
    entityId: "cod.reserve_stock_on",
    meta: { from, to },
  });
  revalidatePath("/admin/shipping");
  return { ok: true };
}
