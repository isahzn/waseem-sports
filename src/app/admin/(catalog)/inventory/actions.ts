"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/catalog/audit";
import { stockAdjustInput, toFieldErrors } from "@/lib/catalog/schemas";
import { logger } from "@/lib/security/logger";

export type AdjustState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  ok?: boolean;
};

/**
 * Owner manual stock change. Goes through the `admin_adjust_stock` SQL
 * function (service-role, after requireAdmin) so the ledger row and the
 * non-negative guards apply exactly like every other stock move.
 */
export async function adjustStock(
  _prev: AdjustState,
  formData: FormData,
): Promise<AdjustState> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return { error: "Sign in required." };
  }

  const rawDelta = String(formData.get("delta") ?? "").trim();
  const delta = rawDelta === "" ? Number.NaN : Number(rawDelta);
  const parsed = stockAdjustInput.safeParse({
    variant_id: String(formData.get("variant_id") ?? ""),
    delta,
    note: String(formData.get("note") ?? ""),
  });
  if (!parsed.success) {
    return { error: "Check the highlighted fields.", fieldErrors: toFieldErrors(parsed.error) };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.rpc("admin_adjust_stock", {
    p_variant_id: parsed.data.variant_id,
    // Argument name must match the SQL signature exactly
    // (`admin_adjust_stock(p_variant_id, p_on_hand_delta, p_reason, p_note)`).
    p_on_hand_delta: parsed.data.delta,
    p_reason: "manual_adjust",
    p_note: parsed.data.note || null,
  });
  if (error) {
    // Named SQL errors (VARIANT_MISSING, NEGATIVE_STOCK…) become plain words.
    const msg = /NEGATIVE_STOCK|reserved/i.test(error.message)
      ? "That would push stock below zero. Enter a smaller amount."
      : /VARIANT_MISSING|not found/i.test(error.message)
        ? "That variant no longer exists."
        : "Could not adjust stock. Try again.";
    logger.error("stock adjust failed", { error: error.message });
    return { error: msg };
  }

  await writeAudit({
    actor: admin.userId,
    action: "stock.adjust",
    entity: "inventory",
    entityId: parsed.data.variant_id,
    meta: { delta: parsed.data.delta, note: parsed.data.note },
  });
  revalidatePath("/admin/inventory");
  redirect("/admin/inventory");
}
