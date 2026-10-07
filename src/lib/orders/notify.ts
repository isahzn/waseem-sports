import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/security/logger";
import { getSetting } from "@/lib/settings";

/**
 * Notification outbox writer (PHASE 05 enqueues; PHASE 06 sends).
 *
 * Business code NEVER calls a provider and NEVER fails an order because of a
 * notification: this only inserts a `notifications` row. When the channel is
 * unconfigured the row is recorded as `skipped` rather than `queued` (D33), so
 * the admin can see the intent and PHASE 06 can flip the provider on without
 * touching order code.
 */

export type NotificationChannel = "whatsapp" | "email" | "sms";

export type EnqueueResult = "queued" | "skipped" | "absent";

export function dedupeKeyFor(orderId: string, event: string, channel: NotificationChannel): string {
  return `${orderId}:${event}:${channel}`;
}

type ProviderConfig = { provider: string; configured: boolean };

async function providerFor(channel: NotificationChannel): Promise<ProviderConfig> {
  try {
    if (channel === "whatsapp") {
      const provider = await getSetting<string>("notifications.whatsapp.provider", "none");
      const chosen = typeof provider === "string" && provider.trim() !== "" ? provider.trim() : "none";
      // The adapter also needs its endpoint; a provider row with no WAHA_URL
      // would never deliver, so treat it as not configured.
      return { provider: chosen, configured: chosen === "waha" && Boolean(process.env.WAHA_URL) };
    }
    const key = channel === "email" ? "notifications.email.provider" : "notifications.sms.provider";
    const provider = await getSetting<string>(key, "none");
    const chosen = typeof provider === "string" && provider.trim() !== "" ? provider.trim() : "none";
    return { provider: chosen, configured: chosen !== "none" };
  } catch {
    return { provider: "none", configured: false };
  }
}

/**
 * Insert one outbox row for an order event. Idempotent on `dedupe_key`
 * (`orderId:event:channel`) so a retried action cannot double-notify.
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

    const { provider, configured } = await providerFor(channel);
    const admin = createAdminClient();
    const { error } = await admin.from("notifications").upsert(
      {
        order_id: orderId,
        channel,
        event,
        recipient: to,
        status: configured ? "queued" : "skipped",
        provider: configured ? provider : "none",
        last_error: configured ? null : "Channel not configured — nothing was sent.",
        dedupe_key: dedupeKeyFor(orderId, event, channel),
      },
      { onConflict: "dedupe_key", ignoreDuplicates: true },
    );
    if (error) {
      logger.error("notification enqueue failed", { orderId, event, channel, error: error.message });
      return "absent";
    }
    return configured ? "queued" : "skipped";
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
