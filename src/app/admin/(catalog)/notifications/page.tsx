import Link from "next/link";
import { requireAdminOrRedirect } from "@/lib/auth/requireAdmin";
import { eventLabel, NOTIFICATION_EVENTS } from "@/lib/notifications/events";
import {
  getNotificationCounts,
  listNotifications,
  type NotificationRow,
} from "@/lib/notifications/outbox";
import { EmptyState, FilterSelect, Pagination, StatusBadge } from "../_components/ui";
import { RetryAllButton, RetryButton } from "./_components/RetryButton";

export const metadata = { title: "Notifications — Waseem Sports Admin" };
export const dynamic = "force-dynamic";

const STATUSES = ["all", "queued", "sent", "failed", "skipped"] as const;
const CHANNELS = ["all", "whatsapp", "email", "sms"] as const;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function pick<T extends readonly string[]>(value: string | undefined, allowed: T, fallback: T[number]): T[number] {
  return value && (allowed as readonly string[]).includes(value) ? (value as T[number]) : fallback;
}

function statusTone(status: NotificationRow["status"]): "green" | "gold" | "muted" | "red" {
  if (status === "sent") return "green";
  if (status === "failed") return "red";
  if (status === "queued") return "gold";
  return "muted";
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-LK", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Notification history (PHASE 06 task 4). Every order event writes one row here;
 * this page shows what was sent, what was skipped because a channel is not
 * configured, and what failed so it can be retried. Retrying is rate-limited and
 * audited (see `actions.ts`).
 */
export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Authorize before reading (D43).
  await requireAdminOrRedirect();
  const sp = await searchParams;

  const status = pick(first(sp.status), STATUSES, "all");
  const channel = pick(first(sp.channel), CHANNELS, "all");
  const event = first(sp.event) && NOTIFICATION_EVENTS.includes(first(sp.event) as never) ? first(sp.event)! : "all";
  const pageParam = Number(first(sp.page));
  const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;

  const [counts, list] = await Promise.all([
    getNotificationCounts(),
    listNotifications({ status, channel, event, page }),
  ]);

  const filtered = status !== "all" || channel !== "all" || event !== "all";
  const cards = [
    { label: "Queued", value: counts.queued, hint: "Waiting to be sent" },
    { label: "Failed", value: counts.failed, hint: "Retried with backoff, then surfaced here" },
    { label: "Sent (24h)", value: counts.sent24h, hint: "Accepted by the provider" },
    { label: "Skipped", value: counts.skipped, hint: "No provider configured, or switched off" },
  ];

  return (
    <main>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Notifications</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted">
            One row per order event. Failures never affect an order — they are retried with backoff
            and shown here. “Skipped” means the channel has no provider configured, which is a normal
            state until setup is finished.
          </p>
        </div>
        <Link href="/admin/settings/whatsapp" className="rounded-sm border border-line px-3 py-1.5 text-sm">
          Channel settings
        </Link>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-md border border-line bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{card.label}</p>
            <p className="mt-1 font-display text-2xl font-bold">{card.value}</p>
            <p className="mt-1 text-xs text-muted">{card.hint}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <FilterSelect
            name="status"
            label="Status"
            value={status}
            options={STATUSES.map((s) => ({ value: s, label: s === "all" ? "All statuses" : s[0].toUpperCase() + s.slice(1) }))}
          />
          <FilterSelect
            name="channel"
            label="Channel"
            value={channel}
            options={CHANNELS.map((c) => ({ value: c, label: c === "all" ? "All channels" : c[0].toUpperCase() + c.slice(1) }))}
          />
          <FilterSelect
            name="event"
            label="Event"
            value={event}
            options={[{ value: "all", label: "All events" }, ...NOTIFICATION_EVENTS.map((e) => ({ value: e, label: eventLabel(e) }))]}
          />
          <button type="submit" className="rounded-sm border border-line px-4 py-2 text-sm font-semibold">
            Apply
          </button>
        </form>
        {counts.failed > 0 && <RetryAllButton />}
      </div>

      {list.rows.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title={filtered ? "Nothing matches" : "No notifications yet"}
            hint={
              filtered
                ? "Try a different status, channel or event."
                : "Each order event writes a row here automatically — including “skipped” rows while a channel is unconfigured."
            }
            actionHref={filtered ? "/admin/notifications" : undefined}
            actionLabel={filtered ? "Clear filters" : undefined}
          />
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-md border border-line">
          <table className="w-full min-w-240 text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-card text-muted">
                <th className="px-4 py-2 font-semibold">Created</th>
                <th className="px-4 py-2 font-semibold">Order</th>
                <th className="px-4 py-2 font-semibold">Event</th>
                <th className="px-4 py-2 font-semibold">Channel</th>
                <th className="px-4 py-2 font-semibold">Recipient</th>
                <th className="px-4 py-2 font-semibold">Status</th>
                <th className="px-4 py-2 font-semibold">Tries</th>
                <th className="px-4 py-2 font-semibold">Last error</th>
                <th className="px-4 py-2 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {list.rows.map((row) => (
                <tr key={row.id} className="border-b border-line last:border-0 align-top">
                  <td className="px-4 py-2 text-muted">{formatDateTime(row.created_at)}</td>
                  <td className="px-4 py-2 font-semibold">
                    {row.order_id && row.order_number ? (
                      <Link href={`/admin/orders/${row.order_id}`} className="hover:underline">
                        {row.order_number}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2">{eventLabel(row.event)}</td>
                  <td className="px-4 py-2 capitalize text-muted">{row.channel}</td>
                  <td className="px-4 py-2 text-muted">{row.recipient}</td>
                  <td className="px-4 py-2">
                    <StatusBadge tone={statusTone(row.status)}>{row.status}</StatusBadge>
                  </td>
                  <td className="px-4 py-2 text-muted">{row.attempts}</td>
                  <td className="max-w-64 px-4 py-2 text-xs text-muted">{row.last_error ?? "—"}</td>
                  <td className="px-4 py-2">
                    <RetryButton id={row.id} label={row.status === "sent" ? "Resend" : "Retry"} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={list.page}
        perPage={list.perPage}
        total={list.total}
        basePath="/admin/notifications"
        params={{
          status: status === "all" ? undefined : status,
          channel: channel === "all" ? undefined : channel,
          event: event === "all" ? undefined : event,
        }}
      />
    </main>
  );
}
