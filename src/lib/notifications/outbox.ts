import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/security/logger";
import { checkRateLimit } from "@/lib/security/ratelimit";
import { formatLKR } from "@/lib/storefront/money";
import { buildNotificationTrackingUrl } from "@/lib/orders/tracking";
import { resolveChannel } from "./config";
import { normalizeRecipient } from "./recipients";
import { renderTemplate, templateFor } from "./templates";
import type { NotificationChannel, NotificationMessage, Notifier } from "./types";

/**
 * The notification outbox processor (PHASE 06 tasks 2–4).
 *
 * Reads `queued`/`failed` rows, renders a DB-backed template and asks the
 * channel's adapter to send. Design rules, all deliberate:
 *  - **Never throws.** Every path returns a summary; the cron route records it.
 *    An order is never affected by a notification problem (D27).
 *  - **No duplicate sends.** A row is claimed with an atomic compare-and-swap on
 *    `attempts`, so two overlapping cron runs cannot both send it; a `sent` row
 *    is never selected again.
 *  - **Capped retries with backoff.** The schema has no `next_attempt_at`, so the
 *    backoff window is measured from `created_at` and grows with `attempts`
 *    (index `notifications_queue_idx` still drives the scan). `attempts` is the
 *    single source of truth; at `MAX_ATTEMPTS` a row is exhausted and surfaced in
 *    the admin as "retries exhausted".
 *  - **Rate-limited.** A per-minute cap on outbound WhatsApp sends means a bug
 *    cannot blast the shop's number (spec §4 rule 6 / test 9).
 *  - **Unconfigured is a normal state.** A row queued while configured but sent
 *    after the provider went away is marked `skipped`, not retried forever.
 */

export const MAX_ATTEMPTS = 5;
export const OUTBOUND_PER_MINUTE = 20;
export const PROCESS_BATCH = 25;

/** Backoff windows by attempt count (index = attempts already made). */
export const BACKOFF_SCHEDULE_MS = [0, 5 * 60_000, 10 * 60_000, 20 * 60_000, 40 * 60_000];

/** Milliseconds the next attempt must wait, given attempts and enqueue time. */
export function backoffRemainingMs(attempts: number, createdAt: number, now: number = Date.now()): number {
  const wait = BACKOFF_SCHEDULE_MS[Math.min(attempts, BACKOFF_SCHEDULE_MS.length - 1)] ?? 0;
  return Math.max(0, createdAt + wait - now);
}

export type NotificationRow = {
  id: string;
  order_id: string | null;
  channel: NotificationChannel;
  event: string;
  recipient: string;
  status: "queued" | "sent" | "failed" | "skipped";
  provider: string | null;
  attempts: number;
  last_error: string | null;
  created_at: string;
  sent_at: string | null;
};

const ROW_COLUMNS =
  "id,order_id,channel,event,recipient,status,provider,attempts,last_error,created_at,sent_at";

export type OutboxSummary = {
  ok: boolean;
  scanned: number;
  sent: number;
  failed: number;
  skipped: number;
  deferred: number;
  rateLimited: boolean;
  errors: { id: string; error: string }[];
};

type OrderForMessage = {
  order_number: string;
  customer_name: string;
  total: number;
  currency: string;
  tracking_token_hash: string;
  item_count: number;
};

async function loadOrder(orderId: string): Promise<OrderForMessage | null> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("orders")
    .select("order_number,customer_name,total,currency,tracking_token_hash")
    .eq("id", orderId)
    .maybeSingle();
  if (error || !data) return null;
  const { count } = await db
    .from("order_items")
    .select("order_id", { count: "exact", head: true })
    .eq("order_id", orderId);
  return {
    order_number: data.order_number,
    customer_name: data.customer_name,
    total: Number(data.total),
    currency: data.currency,
    tracking_token_hash: data.tracking_token_hash,
    item_count: count ?? 0,
  };
}

/**
 * Atomic claim: bump `attempts` only if nobody else has since we read the row.
 * PostgREST returns the updated row(s); zero rows means another run won and this
 * one must not send. (The claim is the whole no-duplicate guarantee.)
 */
async function claim(row: NotificationRow): Promise<boolean> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("notifications")
    .update({ attempts: row.attempts + 1 })
    .eq("id", row.id)
    .eq("attempts", row.attempts)
    .in("status", ["queued", "failed"])
    .select("id");
  if (error) {
    logger.warn("notification claim failed", { id: row.id, error: error.message });
    return false;
  }
  return (data?.length ?? 0) === 1;
}

async function markSkipped(id: string, reason: string): Promise<void> {
  const db = createAdminClient();
  const { error } = await db
    .from("notifications")
    .update({ status: "skipped", last_error: reason, provider: "none" })
    .eq("id", id);
  if (error) logger.warn("notification skip update failed", { id, error: error.message });
}

async function markSent(id: string, provider: string): Promise<void> {
  const db = createAdminClient();
  const { error } = await db
    .from("notifications")
    .update({ status: "sent", provider, sent_at: new Date().toISOString(), last_error: null })
    .eq("id", id);
  if (error) logger.warn("notification sent update failed", { id, error: error.message });
}

async function markFailed(row: NotificationRow, attempts: number, error: string): Promise<void> {
  const exhausted = attempts >= MAX_ATTEMPTS;
  const message = exhausted ? `${error} — retries exhausted.` : error;
  const db = createAdminClient();
  const { error: dbError } = await db
    .from("notifications")
    .update({ status: "failed", provider: row.provider, last_error: message })
    .eq("id", row.id);
  if (dbError) logger.warn("notification failure update failed", { id: row.id, error: dbError.message });
}

/** Build the sendable message. Returns the reason when it cannot be built. */
async function buildMessage(
  row: NotificationRow,
  order: OrderForMessage | null,
): Promise<{ ok: true; message: NotificationMessage } | { ok: false; reason: string }> {
  const recipient = normalizeRecipient(row.channel, row.recipient);
  if (!recipient.ok) return { ok: false, reason: recipient.reason };

  const template = await templateFor(row.event);
  const trackingUrl = order ? buildNotificationTrackingUrl(order.order_number, order.tracking_token_hash) : "";
  const body = renderTemplate(template, {
    order_number: order?.order_number ?? "",
    customer_name: order?.customer_name ?? "there",
    item_count: order ? String(order.item_count) : "",
    total: order ? formatLKR(order.total) : "",
    currency: order?.currency ?? "",
    tracking_url: trackingUrl,
    status_text: row.event.replace(/_/g, " "),
  });
  if (!body) return { ok: false, reason: "Rendered message was empty." };
  return { ok: true, message: { channel: row.channel, recipient: recipient.value, event: row.event, body } };
}

/** Send one row through its adapter and persist the outcome. Never throws. */
async function deliver(row: NotificationRow, notifier: Notifier): Promise<"sent" | "failed" | "skipped"> {
  const order = row.order_id ? await loadOrder(row.order_id) : null;
  if (row.order_id && !order) return "skipped";

  const built = await buildMessage(row, order);
  if (!built.ok) {
    await markSkipped(row.id, built.reason);
    return "skipped";
  }

  let result;
  try {
    result = await notifier.send(built.message);
  } catch (err) {
    result = { ok: false, error: err instanceof Error ? err.message : "Send threw." };
  }

  if (result.ok) {
    await markSent(row.id, notifier.provider);
    return "sent";
  }
  await markFailed(row, row.attempts + 1, result.error ?? "Send failed.");
  return "failed";
}

/**
 * Process one batch. `limit` caps rows scanned. Never throws.
 * Each run's outcome is returned so the cron route can log/report it.
 */
export async function processOutbox(limit: number = PROCESS_BATCH): Promise<OutboxSummary> {
  const summary: OutboxSummary = {
    ok: true,
    scanned: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    deferred: 0,
    rateLimited: false,
    errors: [],
  };

  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from("notifications")
      .select(ROW_COLUMNS)
      .in("status", ["queued", "failed"])
      .lt("attempts", MAX_ATTEMPTS)
      .order("created_at", { ascending: true })
      .limit(Math.min(Math.max(1, limit), 200));
    if (error) {
      summary.ok = false;
      summary.errors.push({ id: "-", error: error.message });
      return summary;
    }

    const now = Date.now();
    for (const raw of (data ?? []) as unknown as NotificationRow[]) {
      summary.scanned += 1;

      const createdAt = Date.parse(raw.created_at);
      if (Number.isFinite(createdAt) && backoffRemainingMs(raw.attempts, createdAt, now) > 0) {
        summary.deferred += 1;
        continue;
      }

      const { config, notifier } = await resolveChannel(raw.channel);
      if (!config.enabled) {
        // Kill switch on: leave the row untouched for when sending resumes.
        summary.deferred += 1;
        continue;
      }
      if (!notifier || !config.configured) {
        await markSkipped(raw.id, config.reason ?? "Channel is not configured.");
        summary.skipped += 1;
        continue;
      }

      // Outbound cap: stop the batch rather than push past it (spec test 9).
      const limitCheck = await checkRateLimit(
        `notify:outbound:${raw.channel}`,
        OUTBOUND_PER_MINUTE,
        60_000,
      );
      if (!limitCheck.allowed) {
        summary.rateLimited = true;
        break;
      }

      if (!(await claim(raw))) continue; // another run is sending it

      const outcome = await deliver(raw, notifier);
      if (outcome === "sent") summary.sent += 1;
      else if (outcome === "skipped") summary.skipped += 1;
      else {
        summary.failed += 1;
        if (raw.last_error === null) summary.errors.push({ id: raw.id, error: "Send failed." });
      }
    }
    return summary;
  } catch (err) {
    summary.ok = false;
    summary.errors.push({ id: "-", error: err instanceof Error ? err.message : "Unknown outbox error." });
    logger.error("outbox processing threw", {
      error: err instanceof Error ? err.message : String(err),
    });
    return summary;
  }
}

/**
 * Manual resend/retry for the admin (task 4). Sends immediately, in the
 * request, so the owner sees the result — the caller rate-limits and audits it.
 * Works for `failed`, `skipped` and `sent` rows (an explicit resend).
 */
export async function resendNotification(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const db = createAdminClient();
    const { data, error } = await db.from("notifications").select(ROW_COLUMNS).eq("id", id).maybeSingle();
    if (error || !data) return { ok: false, error: "That notification no longer exists." };
    const row = data as unknown as NotificationRow;

    const { config, notifier } = await resolveChannel(row.channel);
    if (!notifier || !config.configured) {
      return { ok: false, error: config.reason ?? "Channel is not configured." };
    }
    if (!config.enabled) return { ok: false, error: "Notifications are switched off for this channel." };

    const outcome = await deliver(row, notifier);
    if (outcome === "sent") return { ok: true };
    if (outcome === "skipped") return { ok: false, error: "This notification cannot be sent (invalid recipient or missing order)." };
    return { ok: false, error: "The provider rejected the message — see the error on the row." };
  } catch (err) {
    logger.error("manual resend threw", { id, error: err instanceof Error ? err.message : String(err) });
    return { ok: false, error: "Could not resend this notification." };
  }
}

// ---------- admin reads ----------

export type NotificationFilters = {
  status?: string;
  channel?: string;
  event?: string;
  page?: number;
};

export const NOTIFICATIONS_PER_PAGE = 25;

export type NotificationListItem = NotificationRow & { order_number: string | null };

/** Notification history with filters + pagination (admin). */
export async function listNotifications(filters: NotificationFilters): Promise<{
  rows: NotificationListItem[];
  total: number;
  page: number;
  perPage: number;
}> {
  const db = createAdminClient();
  const page = Math.min(500, Math.max(1, filters.page ?? 1));
  const from = (page - 1) * NOTIFICATIONS_PER_PAGE;

  let query = db.from("notifications").select(ROW_COLUMNS, { count: "exact" });
  if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
  if (filters.channel && filters.channel !== "all") query = query.eq("channel", filters.channel);
  if (filters.event && filters.event !== "all") query = query.eq("event", filters.event);

  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .range(from, from + NOTIFICATIONS_PER_PAGE - 1);
  if (error) throw new Error(`Notification query failed: ${error.message}`);

  const rows = (data ?? []) as unknown as NotificationRow[];
  const orderIds = [...new Set(rows.map((r) => r.order_id).filter((v): v is string => Boolean(v)))];
  const numbers = new Map<string, string>();
  if (orderIds.length > 0) {
    const { data: orders } = await db.from("orders").select("id,order_number").in("id", orderIds);
    for (const o of orders ?? []) numbers.set(o.id, o.order_number);
  }
  return {
    rows: rows.map((r) => ({ ...r, order_number: r.order_id ? numbers.get(r.order_id) ?? null : null })),
    total: count ?? 0,
    page,
    perPage: NOTIFICATIONS_PER_PAGE,
  };
}

/** Every notification for one order (admin order page). */
export async function listOrderNotifications(orderId: string): Promise<NotificationRow[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("notifications")
    .select(ROW_COLUMNS)
    .eq("order_id", orderId)
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as unknown as NotificationRow[];
}

export type NotificationCounts = { queued: number; failed: number; sent24h: number; skipped: number };

/** Summary counts for the admin notifications page. */
export async function getNotificationCounts(): Promise<NotificationCounts> {
  const db = createAdminClient();
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  try {
    const head = { count: "exact" as const, head: true };
    const [queued, failed, sent, skipped] = await Promise.all([
      db.from("notifications").select("id", head).eq("status", "queued"),
      db.from("notifications").select("id", head).eq("status", "failed"),
      db.from("notifications").select("id", head).eq("status", "sent").gte("sent_at", since),
      db.from("notifications").select("id", head).eq("status", "skipped"),
    ]);
    return {
      queued: queued.count ?? 0,
      failed: failed.count ?? 0,
      sent24h: sent.count ?? 0,
      skipped: skipped.count ?? 0,
    };
  } catch {
    return { queued: 0, failed: 0, sent24h: 0, skipped: 0 };
  }
}
