"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { writeAudit } from "@/lib/catalog/audit";
import { checkRateLimit, clientIp } from "@/lib/security/ratelimit";
import { logger } from "@/lib/security/logger";
import { listNotifications, resendNotification } from "@/lib/notifications/outbox";

/**
 * Retry / resend actions (PHASE 06 task 4). A resend goes straight to the
 * provider so the owner sees the outcome, and it is rate-limited and audited —
 * an admin can never turn the retry button into a way to blast the shop's
 * number. Every action authorizes with `requireAdmin()` first.
 */

export type RetryState = { error?: string; ok?: boolean; message?: string };

const RETRY_PER_WINDOW = 15;
const RETRY_WINDOW_MS = 15 * 60 * 1000;

async function authorize(): Promise<{ userId: string | null } | null> {
  try {
    const admin = await requireAdmin();
    return { userId: admin.userId };
  } catch {
    return null;
  }
}

async function withinRetryLimit(): Promise<boolean> {
  const ip = clientIp(await headers());
  const limit = await checkRateLimit(`notify:manual:${ip}`, RETRY_PER_WINDOW, RETRY_WINDOW_MS);
  return limit.allowed;
}

/** Retry (or explicitly resend) one notification row. */
export async function retryNotification(_prev: RetryState, formData: FormData): Promise<RetryState> {
  const admin = await authorize();
  if (!admin) return { error: "Sign in required." };

  const id = String(formData.get("id") ?? "");
  if (!z.string().uuid().safeParse(id).success) return { error: "Invalid notification." };
  if (!(await withinRetryLimit())) return { error: "Too many retries. Wait a few minutes." };

  const result = await resendNotification(id);

  await writeAudit({
    actor: admin.userId,
    action: "notification.retry",
    entity: "notifications",
    entityId: id,
    meta: { ok: result.ok },
  });
  revalidatePath("/admin/notifications");
  if (!result.ok) return { error: result.error ?? "Could not resend this notification." };
  return { ok: true, message: "Resent." };
}

/** Retry every failed notification, up to a small cap per click. */
export async function retryAllFailed(): Promise<RetryState> {
  const admin = await authorize();
  if (!admin) return { error: "Sign in required." };
  if (!(await withinRetryLimit())) return { error: "Too many retries. Wait a few minutes." };

  const { rows } = await listNotifications({ status: "failed", page: 1 });
  if (rows.length === 0) return { ok: true, message: "There are no failed notifications." };

  let sent = 0;
  const failures: string[] = [];
  for (const row of rows.slice(0, 10)) {
    try {
      const result = await resendNotification(row.id);
      if (result.ok) sent += 1;
      else failures.push(result.error ?? "failed");
    } catch (err) {
      logger.error("retry-all threw", { id: row.id, error: err instanceof Error ? err.message : String(err) });
      failures.push("error");
    }
  }

  await writeAudit({
    actor: admin.userId,
    action: "notification.retry_all",
    entity: "notifications",
    meta: { attempted: Math.min(rows.length, 10), sent, failed: failures.length },
  });
  revalidatePath("/admin/notifications");

  if (sent === 0) {
    return { error: failures[0] ?? "Nothing could be resent — check the channel settings." };
  }
  return { ok: true, message: `Reset ${sent} notification${sent === 1 ? "" : "s"}.` };
}
