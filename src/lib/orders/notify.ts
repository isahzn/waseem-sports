import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/security/logger";
import { isEventEnabled, resolveChannel } from "@/lib/notifications/config";
import type { NotificationChannel } from "@/lib/notifications/types";

/**
 * Notification outbox writer (PHASE 05 enqueues; PHASE 06 sends).
 *
 * Business code NEVER calls a provider and NEVER fails an order because of a
 * notification: this only inserts a `notifications` row. When the channel is
 * unconfigured (or switched off) the row is recorded as `skipped` rather than
 * `queued` (D33), so the admin can see the intent and PHASE 06 can flip the
 * provider on without touching order code. The recipient is normalised at send
 * time, not here, so a bad number becomes a `skipped` row with a reason instead
 * of blocking the order.
 *
 * `dedupe_key` is `orderId:event:channel` and the column is unique — a replayed
 * action or a double-submitted status change cannot double-notify.
 */

export type { NotificationChannel } from "@/lib/notifications/types";

export type EnqueueResult = "queued" | "skipped" | "absent";

export function dedupeKeyFor(orderId: string, event: string, channel: NotificationChannel): string {
  return `${orderId}:${event}:${channel}`;
}

/**
 * Insert one outbox row for an order event. Idempotent on `dedupe_key`.
 * Never throws — a notification problem must not break the order.
 */
export async function enqueueOrderNotification({
  orderId,
  event,
  recipient,
  channel = "whatsapp",
}: {
  orderId: string;
  event: string;
  recipient: string | null | undefined;
  channel?: NotificationChannel;
}): Promise<EnqueueResult> {
  try {
    const to = (recipient ?? "").trim();
    if (!to) {
      // e.g. an email notification for a guest who left email blank.
      logger.info("notification skipped: no recipient", { orderId, event, channel });
      return "absent";
    }

    const eventEnabled = await isEventEnabled(event);
    const { config } = await resolveChannel(channel);
    const sendable = eventEnabled && config.configured && config.enabled;
    const reason = !eventEnabled
      ? "This notification is switched off in settings."
      : (config.reason ?? "Channel is not configured.");

    const admin = createAdminClient();
    const { error } = await admin.from("notifications").upsert(
      {
        order_id: orderId,
        channel,
        event,
        recipient: to,
        status: sendable ? "queued" : "skipped",
        provider: sendable ? config.provider : "none",
        last_error: sendable ? null : reason,
        dedupe_key: dedupeKeyFor(orderId, event, channel),
      },
      { onConflict: "dedupe_key", ignoreDuplicates: true },
    );
    if (error) {
      logger.error("notification enqueue failed", { orderId, event, channel, error: error.message });
      return "absent";
    }
    return sendable ? "queued" : "skipped";
  } catch (err) {
    logger.error("notification enqueue threw", {
      orderId,
      event,
      channel,
      error: err instanceof Error ? err.message : String(err),
    });
    return "absent";
  }
}
