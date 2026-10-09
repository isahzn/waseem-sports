import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminOrRedirect } from "@/lib/auth/requireAdmin";
import { formatLKR } from "@/lib/storefront/money";
import { whatsappHref } from "@/lib/storefront/contact-links";
import { getOrderDetail } from "@/lib/orders/queries";
import { STATUS_LABELS, type OrderStatus } from "@/lib/orders/status";
import { listOrderNotifications, type NotificationRow } from "@/lib/notifications/outbox";
import { eventLabel } from "@/lib/notifications/events";
import { StatusBadge } from "../../_components/ui";
import { RetryButton } from "../../notifications/_components/RetryButton";
import { NotesForm } from "../_components/NotesForm";
import { StatusForm } from "../_components/StatusForm";
import { StockActions } from "../_components/StockActions";

export const metadata = { title: "Order — Waseem Sports Admin" };

function statusTone(status: OrderStatus): "green" | "gold" | "muted" | "red" {
  if (status === "shipped" || status === "delivered") return "green";
  if (status === "cancelled" || status === "payment_failed") return "red";
  if (status === "refunded") return "muted";
  return "gold";
}

function formatDateTime(value: string): string {
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

function paymentMethodLabel(method: string): string {
  if (method === "cod") return "Cash on delivery";
  return method.toUpperCase();
}

/** Outbox status tone: sent · queued · failed · skipped (unconfigured is normal). */
function notificationTone(status: NotificationRow["status"]): "green" | "gold" | "muted" | "red" {
  if (status === "sent") return "green";
  if (status === "failed") return "red";
  if (status === "skipped") return "muted";
  return "gold";
}

/** Flatten the address jsonb into printable lines, skipping blank values. */
function addressLines(address: Record<string, unknown>): string[] {
  const order = ["line1", "line2", "city", "district", "postal_code", "country"];
  const values = order.map((key) => address[key]).filter((v): v is string => typeof v === "string" && v.trim() !== "");
  if (values.length > 0) return values;
  // Unknown shape (future fields): show the scalars we were given.
  return Object.values(address).filter((v): v is string => typeof v === "string" && v.trim() !== "");
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  // Authorize before reading (see OrdersPage).
  await requireAdminOrRedirect();
  const { id } = await params;
  const order = await getOrderDetail(id);
  if (!order) notFound();
  const notifications = await listOrderNotifications(order.id);

  const address = addressLines(order.shipping_address);
  const phoneDigits = order.customer_phone.replace(/[^\d+]/g, "");
  // Fixes §3.6: one-tap WhatsApp to the customer with the order reference ready.
  const waBase = whatsappHref(order.customer_phone);
  const waHref = waBase
    ? `${waBase}?text=${encodeURIComponent(`Hi ${order.customer_name}, this is Waseem Sports about your order ${order.order_number} (${formatLKR(order.total)}).`)}`
    : null;

  return (
    <main className="flex flex-col gap-6">
      <div>
        <Link href="/admin/orders" className="text-sm text-muted hover:text-ink">
          ← Back to orders
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl font-bold">{order.order_number}</h1>
          <StatusBadge tone={statusTone(order.status)}>{STATUS_LABELS[order.status]}</StatusBadge>
          <Link
            href={`/admin/orders/${order.id}/slip`}
            className="rounded-sm border border-line px-3 py-1.5 text-sm"
            title="Open a print-friendly packing slip."
          >
            Print packing slip
          </Link>
        </div>
        <p className="mt-1 text-sm text-muted">
          Placed {formatDateTime(order.placed_at)} · {paymentMethodLabel(order.payment_method)} ·{" "}
          payment {order.payment_status}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <section>
            <h2 className="font-display text-xl font-bold">Items</h2>
            <div className="mt-3 overflow-x-auto rounded-md border border-line">
              <table className="w-full min-w-140 text-left text-sm">
                <thead>
                  <tr className="border-b border-line bg-card text-muted">
                    <th className="px-4 py-2 font-semibold">Product</th>
                    <th className="px-4 py-2 font-semibold">SKU</th>
                    <th className="px-4 py-2 font-semibold">Unit price</th>
                    <th className="px-4 py-2 font-semibold">Qty</th>
                    <th className="px-4 py-2 text-right font-semibold">Line total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr key={item.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-2">
                        <span className="font-semibold">{item.product_name}</span>
                        {item.variant_name && item.variant_name !== "Default" && (
                          <span className="block text-xs text-muted">{item.variant_name}</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-muted">{item.sku ?? "—"}</td>
                      <td className="px-4 py-2">{formatLKR(item.unit_price)}</td>
                      <td className="px-4 py-2">{item.quantity}</td>
                      <td className="px-4 py-2 text-right font-semibold">{formatLKR(item.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="mt-3 ml-auto flex max-w-sm flex-col gap-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Subtotal</dt>
                <dd>{formatLKR(order.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">
                  Delivery{order.shipping_method ? ` (${order.shipping_method})` : ""}
                </dt>
                <dd>{formatLKR(order.shipping_fee)}</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-1 font-semibold">
                <dt>Total</dt>
                <dd>{formatLKR(order.total)}</dd>
              </div>
            </dl>
            <p className="mt-2 text-xs text-muted">
              These are the prices and names recorded when the order was placed — later product edits
              do not change them.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold">Timeline</h2>
            {order.history.length === 0 ? (
              <p className="mt-2 text-sm text-muted">No status changes recorded yet.</p>
            ) : (
              <ol className="mt-3 flex flex-col gap-3">
                {order.history.map((row) => (
                  <li key={row.id} className="rounded-md border border-line bg-card px-4 py-3 text-sm">
                    <p className="font-semibold">
                      {row.from_status ? `${STATUS_LABELS[row.from_status]} → ` : ""}
                      {STATUS_LABELS[row.to_status]}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {formatDateTime(row.created_at)}
                      {row.actor ? ` · staff ${row.actor.slice(0, 8)}` : ""}
                    </p>
                    {row.note && <p className="mt-1">{row.note}</p>}
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section>
            <h2 className="font-display text-xl font-bold">Notifications</h2>
            <p className="mt-1 text-sm text-muted">
              A row appears here for each order event. Rows recorded as <b>skipped</b> mean the
              channel has no provider configured — the message was never attempted and the order was
              never affected.
            </p>
            {notifications.length === 0 ? (
              <p className="mt-2 text-sm text-muted">No notifications have been queued for this order.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {notifications.map((row) => (
                  <li
                    key={row.id}
                    className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-line bg-card px-4 py-3 text-sm"
                  >
                    <div>
                      <p className="font-semibold">{eventLabel(row.event)}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {row.channel} · {formatDateTime(row.created_at)}
                        {row.attempts > 0 ? ` · ${row.attempts} attempt${row.attempts === 1 ? "" : "s"}` : ""}
                      </p>
                      {row.last_error && <p className="mt-1 text-xs text-muted">{row.last_error}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge tone={notificationTone(row.status)}>{row.status}</StatusBadge>
                      <RetryButton id={row.id} label={row.status === "sent" ? "Resend" : "Retry"} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="flex flex-col gap-6">
          <section className="rounded-md border border-line bg-card p-4">
            <h2 className="font-semibold">Customer</h2>
            <p className="mt-2 text-sm font-semibold">{order.customer_name}</p>
            <p className="text-sm">
              <a href={`tel:${phoneDigits}`} className="underline">
                {order.customer_phone}
              </a>
            </p>
            {waHref && (
              <p className="mt-2">
                <a
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block rounded-sm border border-line px-3 py-1.5 text-sm"
                >
                  WhatsApp customer
                </a>
              </p>
            )}
            {order.customer_email && <p className="text-sm break-all">{order.customer_email}</p>}
          </section>

          <section className="rounded-md border border-line bg-card p-4">
            <h2 className="font-semibold">Delivery address</h2>
            {address.length === 0 ? (
              <p className="mt-2 text-sm text-muted">No address on this order.</p>
            ) : (
              <address className="mt-2 text-sm not-italic">
                {address.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </address>
            )}
          </section>

          <StockActions
            orderId={order.id}
            reserved={order.stock_reserved}
            committed={order.stock_committed}
          />

          <StatusForm orderId={order.id} status={order.status} />

          <NotesForm orderId={order.id} notes={order.notes ?? ""} />
        </div>
      </div>
    </main>
  );
}
