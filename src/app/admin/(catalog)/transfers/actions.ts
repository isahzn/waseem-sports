"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { cancelTransfer, confirmTransfer, createTransfer } from "@/lib/transfers/service";
import { formAmount } from "@/lib/transfers/schemas";
import { logger } from "@/lib/security/logger";

/**
 * Money movement is owner-only (SECURITY.md §2: only the owner touches
 * payments). Creating, confirming or cancelling a transfer as staff is
 * rejected before any provider call. Reads stay open to every admin role.
 */
async function adminOrRedirect() {
  try {
    return await requireAdmin(["owner"]);
  } catch {
    redirect("/admin/login");
  }
}

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return v === null ? "" : String(v);
}

/** Create from the admin form → redirect to the confirmation screen. */
export async function createTransferAction(formData: FormData): Promise<void> {
  const admin = await adminOrRedirect();
  const h = await headers();
  const { row, error } = await createTransfer(
    {
      sender_method: str(formData, "sender_method") || "sandbox_balance",
      sender_account_ref: str(formData, "sender_account_ref") || "main-account",
      recipient_name: str(formData, "recipient_name"),
      recipient_bank: str(formData, "recipient_bank"),
      recipient_account: str(formData, "recipient_account"),
      recipient_branch: str(formData, "recipient_branch"),
      recipient_contact: str(formData, "recipient_contact"),
      amount: formAmount(formData.get("amount")),
      currency: str(formData, "currency") || "LKR",
      reference: str(formData, "reference"),
      description: str(formData, "description"),
      idempotency_key: str(formData, "idempotency_key"),
    },
    { headers: h, actor: admin.userId },
  );
  if (error || !row) {
    logger.error("admin transfer create failed");
    redirect(`/admin/transfers?error=${encodeURIComponent(error?.message ?? "Could not create the transfer.")}`);
  }
  revalidatePath("/admin/transfers");
  redirect(`/admin/transfers/${row.id}`);
}

/** Explicit CONFIRM TRANSFER — the only path that executes money movement. */
export async function confirmTransferAction(formData: FormData): Promise<void> {
  const admin = await adminOrRedirect();
  const h = await headers();
  const id = str(formData, "id");
  const { row, error } = await confirmTransfer(
    { id, idempotency_key: str(formData, "idempotency_key"), confirm: str(formData, "confirm") === "true" ? true : (formData.get("confirm") as unknown) },
    { headers: h, actor: admin.userId },
  );
  if (error || !row) {
    redirect(`/admin/transfers/${id}?error=${encodeURIComponent(error?.message ?? "Could not confirm the transfer.")}`);
  }
  revalidatePath("/admin/transfers");
  revalidatePath(`/admin/transfers/${id}`);
  redirect(`/admin/transfers/${row.id}?ok=${encodeURIComponent("Confirmation recorded — see the verified result below.")}`);
}

export async function cancelTransferAction(formData: FormData): Promise<void> {
  const admin = await adminOrRedirect();
  const id = str(formData, "id");
  const { row, error } = await cancelTransfer(id, admin.userId);
  if (error || !row) {
    redirect(`/admin/transfers/${id}?error=${encodeURIComponent(error?.message ?? "Could not cancel the transfer.")}`);
  }
  revalidatePath("/admin/transfers");
  redirect(`/admin/transfers/${row.id}?ok=${encodeURIComponent("Transfer cancelled.")}`);
}
