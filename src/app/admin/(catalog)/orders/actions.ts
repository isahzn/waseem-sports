"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { adminDb, requireAdmin } from "@/lib/auth/requireAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/catalog/audit";
import { logger } from "@/lib/security/logger";
import { mapOrderError } from "@/lib/orders/errors";
import { enqueueOrderNotification } from "@/lib/orders/notify";
import {
  formText,
  orderNotesInput,
  statusChangeInput,
  toFieldErrors,
} from "@/lib/orders/schemas";
import {
  canTransition,
  isOrderStatus,
  NOTIFICATION_EVENT_FOR_STATUS,
  STATUS_LABELS,
  STOCK_ACTION_FOR_STATUS,
  type OrderStatus,
} from "@/lib/orders/status";
import { getReservePolicy } from "@/lib/settings";

export type OrderActionState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  ok?: boolean;
};

type ActionOrder = {
  id: string;
  status: string;
  customer_phone: string;
  stock_reserved: boolean;
  stock_committed: boolean;
};

/**
 * Read the flags the stock rules depend on. Service role: a shared-password
 * admin session (D42) has no Supabase user for the RLS policies to match.
 * The caller has already run `requireAdmin()`.
 */
async function loadOrderForAction(id: string): Promise<ActionOrder | null> {
  const db = adminDb();
  const { data } = await db
    .from("orders")
    .select("id,status,customer_phone,stock_reserved,stock_committed")
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as ActionOrder) ?? null;
}

/**
 * Move an order to a new status.
 *
 * Order of operations matters: the stock move runs *first*, so an order can
 * never be marked shipped when its inventory cannot come down. Writes go
 * through the service-role client because `orders` /
 * `order_status_history` are service-role-only for writes by design (RLS
 * grants admins read access). Every change is audited and enqueues exactly one
 * notification row per event — a notification failure never fails the action.
 */
export async function changeOrderStatus(
  _prev: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return { error: "Sign in required." };
  }

  const parsed = statusChangeInput.safeParse({
    order_id: String(formData.get("order_id") ?? ""),
    to_status: String(formData.get("to_status") ?? ""),
    note: formText(formData.get("note")),
  });
  if (!parsed.success) {
    return { error: "Check the highlighted fields.", fieldErrors: toFieldErrors(parsed.error) };
  }
  const orderId = parsed.data.order_id;
  const note = parsed.data.note ?? null;
  const toRaw = parsed.data.to_status;
  if (!isOrderStatus(toRaw)) return { error: "That is not a valid order status." };
  const to: OrderStatus = toRaw;

  const order = await loadOrderForAction(orderId);
  if (!order) return { error: "That order no longer exists." };
  const fromRaw = order.status;
  if (!isOrderStatus(fromRaw)) return { error: "That order has an unexpected status." };
  const from: OrderStatus = fromRaw;

  // Transitions are validated here, never trusted from the form.
  if (!canTransition(from, to)) {
    return {
      error: `An order that is ${STATUS_LABELS[from]} cannot be marked ${STATUS_LABELS[to]}.`,
    };
  }

  const stockAction = STOCK_ACTION_FOR_STATUS[to];
  let appliedStockAction: "reserve" | "release" | "commit" | null = null;

  if (stockAction) {
    // With the default "reserve when placed" policy the order is already
    // reserved, so confirming must not reserve twice (the RPC would no-op,
    // but skipping keeps the audit trail honest).
    const shouldRun = stockAction !== "reserve" || (await getReservePolicy()) === "confirmed";
    if (shouldRun) {
      const supabase = createAdminClient();
      const { error } = await supabase.rpc("adjust_order_stock", {
        p_order_id: orderId,
        p_action: stockAction,
      });
      if (error) {
        // A stock failure must be visible — the status stays where it was.
        logger.error("order stock action failed", {
          orderId,
          action: stockAction,
          to,
          code: error.code,
          error: error.message,
        });
        return { error: mapOrderError(error.message).message };
      }
      appliedStockAction = stockAction;
    }
  }

  const supabase = createAdminClient();
  const { error: statusError } = await supabase.from("orders").update({ status: to }).eq("id", orderId);
  if (statusError) {
    logger.error("order status update failed", { orderId, to, error: statusError.message });
    return { error: "Could not update the order status. Try again." };
  }

  const { error: historyError } = await supabase.from("order_status_history").insert({
    order_id: orderId,
    from_status: from,
    to_status: to,
    note,
    actor: admin.userId,
  });
  if (historyError) {
    // The status itself is already saved; a missing timeline row is logged,
    // not fatal.
    logger.error("order history insert failed", { orderId, to, error: historyError.message });
  }

  await enqueueOrderNotification({
    orderId,
    event: NOTIFICATION_EVENT_FOR_STATUS[to],
    recipient: order.customer_phone,
  });

  await writeAudit({
    actor: admin.userId,
    action: "order.status",
    entity: "orders",
    entityId: orderId,
    meta: { from, to, stockAction: appliedStockAction, note },
  });

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  redirect(`/admin/orders/${orderId}`);
}

/** Internal owner/team note on an order (never shown to the customer). */
export async function saveOrderNotes(
  _prev: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return { error: "Sign in required." };
  }

  const parsed = orderNotesInput.safeParse({
    order_id: String(formData.get("order_id") ?? ""),
    notes: formText(formData.get("notes")),
  });
  if (!parsed.success) {
    return { error: "Check the highlighted fields.", fieldErrors: toFieldErrors(parsed.error) };
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("orders")
    .update({ notes: parsed.data.notes ?? null })
    .eq("id", parsed.data.order_id);
  if (error) {
    logger.error("order notes update failed", { orderId: parsed.data.order_id, error: error.message });
    return { error: "Could not save the note. Try again." };
  }

  await writeAudit({
    actor: admin.userId,
    action: "order.notes",
    entity: "orders",
    entityId: parsed.data.order_id,
  });
  revalidatePath(`/admin/orders/${parsed.data.order_id}`);
  return { ok: true };
}

/**
 * Manual stock correction for one order. The status transitions already move
 * stock by themselves; these buttons exist for the cases the owner has to fix
 * by hand (e.g. a confirmed order that could not reserve).
 * `adjust_order_stock` is idempotent, so a double submit cannot double-count.
 */
async function runStockAction(
  id: string,
  action: "reserve" | "release" | "commit",
): Promise<OrderActionState> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return { error: "Sign in required." };
  }
  if (!z.string().uuid().safeParse(id).success) return { error: "Invalid order." };

  const order = await loadOrderForAction(id);
  if (!order) return { error: "That order no longer exists." };

  if (action === "reserve" && (order.stock_reserved || order.stock_committed)) {
    return { error: "Stock for this order is already reserved." };
  }
  if (action !== "reserve" && (!order.stock_reserved || order.stock_committed)) {
    return { error: "There is no open reservation to move for this order." };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.rpc("adjust_order_stock", { p_order_id: id, p_action: action });
  if (error) {
    logger.error("order stock action failed", { orderId: id, action, code: error.code, error: error.message });
    return { error: mapOrderError(error.message).message };
  }

  await writeAudit({
    actor: admin.userId,
    action: "order.stock",
    entity: "orders",
    entityId: id,
    meta: { action },
  });
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath("/admin/inventory");
  redirect(`/admin/orders/${id}`);
}

export async function reserveStock(_prev: OrderActionState, formData: FormData): Promise<OrderActionState> {
  return runStockAction(String(formData.get("id") ?? ""), "reserve");
}

export async function releaseStock(_prev: OrderActionState, formData: FormData): Promise<OrderActionState> {
  return runStockAction(String(formData.get("id") ?? ""), "release");
}

export async function commitStock(_prev: OrderActionState, formData: FormData): Promise<OrderActionState> {
  return runStockAction(String(formData.get("id") ?? ""), "commit");
}
