import Link from "next/link";
import { formatLKR } from "@/lib/storefront/money";
import {
  adminOrderFilters,
  orderStatusFilters,
  type AdminOrderFilters,
} from "@/lib/orders/schemas";
import { listOrders, getNewOrderCount, type OrderSummary } from "@/lib/orders/queries";
import { STATUS_LABELS, type OrderStatus } from "@/lib/orders/status";
import {
  EmptyState,
  FilterSelect,
  Pagination,
  SearchBar,
  StatusBadge,
} from "../_components/ui";

export const metadata = { title: "Orders — Waseem Sports Admin" };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function statusTone(status: OrderStatus): "green" | "gold" | "muted" | "red" {
  if (status === "shipped" || status === "delivered") return "green";
  if (status === "cancelled" || status === "payment_failed") return "red";
  if (status === "refunded") return "muted";
  return "gold";
}

function stockLabel(order: OrderSummary): string {
  if (order.stock_committed) return "Committed";
  if (order.stock_reserved) return "Reserved";
  return "—";
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

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const filters: AdminOrderFilters = adminOrderFilters.parse({
    q: first(sp.q),
    status: first(sp.status),
    from: first(sp.from),
    to: first(sp.to),
    page: first(sp.page),
  });

  const [{ orders, total, page, perPage }, newCount] = await Promise.all([
    listOrders(filters),
    getNewOrderCount(),
  ]);

  const filtered = Boolean(filters.q || (filters.status && filters.status !== "all") || filters.from || filters.to);

  return (
    <main>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Orders</h1>
          <p className="mt-1 text-sm text-muted">
            Cash-on-delivery orders placed on the storefront. Confirm an order to start working on
            it, then move it through processing and shipping.
            {newCount > 0 && (
              <span className="ml-1 font-semibold text-gold-400">
                {newCount} waiting to be confirmed.
              </span>
            )}
          </p>
        </div>
        {newCount > 0 && (
          <Link
            href="/admin/orders?status=new"
            className="rounded-sm border border-gold-600 px-3 py-1.5 text-sm font-semibold text-gold-400"
          >
            Show new orders
          </Link>
        )}
      </div>

      <div className="mt-6">
        <SearchBar
          q={filters.q}
          extra={
            <>
              <FilterSelect
                name="status"
                label="Status"
                value={filters.status}
                options={orderStatusFilters.map((s) => ({
                  value: s,
                  label: s === "all" ? "All statuses" : STATUS_LABELS[s],
                }))}
              />
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted">From</span>
                <input
                  type="date"
                  name="from"
                  defaultValue={filters.from ?? ""}
                  className="rounded-sm border border-line bg-surface px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted">To</span>
                <input
                  type="date"
                  name="to"
                  defaultValue={filters.to ?? ""}
                  className="rounded-sm border border-line bg-surface px-3 py-2"
                />
              </label>
            </>
          }
        />
      </div>

      {orders.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title={filtered ? "No orders match" : "No orders yet"}
            hint={
              filtered
                ? "Try a different status or clear the date range."
                : "Orders placed on the storefront will appear here the moment they arrive."
            }
            actionHref={filtered ? "/admin/orders" : undefined}
            actionLabel={filtered ? "Clear filters" : undefined}
          />
        </div>
      ) : (
        <>
          {/* Phone: stacked cards so nothing scrolls sideways. */}
          <ul className="mt-6 flex flex-col gap-3 md:hidden">
            {orders.map((order) => (
              <li key={order.id} className="rounded-md border border-line bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/admin/orders/${order.id}`} className="font-semibold hover:underline">
                    {order.order_number}
                  </Link>
                  <StatusBadge tone={statusTone(order.status)}>{STATUS_LABELS[order.status]}</StatusBadge>
                </div>
                <p className="mt-2 text-sm">{order.customer_name}</p>
                <p className="text-sm text-muted">{order.customer_phone}</p>
                <p className="mt-2 flex justify-between text-sm">
                  <span className="text-muted">
                    {order.item_count} item{order.item_count === 1 ? "" : "s"} · {stockLabel(order)}
                  </span>
                  <b>{formatLKR(order.total)}</b>
                </p>
                <p className="mt-1 text-xs text-muted">
                  {formatDateTime(order.placed_at)} · {order.payment_method.toUpperCase()} ·{" "}
                  {order.payment_status}
                </p>
              </li>
            ))}
          </ul>

          <div className="mt-6 hidden overflow-x-auto rounded-md border border-line md:block">
            <table className="w-full min-w-200 text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-card text-muted">
                  <th className="px-4 py-2 font-semibold">Order</th>
                  <th className="px-4 py-2 font-semibold">Placed</th>
                  <th className="px-4 py-2 font-semibold">Customer</th>
                  <th className="px-4 py-2 font-semibold">Items</th>
                  <th className="px-4 py-2 font-semibold">Total</th>
                  <th className="px-4 py-2 font-semibold">Status</th>
                  <th className="px-4 py-2 font-semibold">Payment</th>
                  <th className="px-4 py-2 font-semibold">Stock</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-2 font-semibold">
                      <Link href={`/admin/orders/${order.id}`} className="hover:underline">
                        {order.order_number}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-muted">{formatDateTime(order.placed_at)}</td>
                    <td className="px-4 py-2">
                      {order.customer_name}
                      <span className="block text-xs text-muted">{order.customer_phone}</span>
                    </td>
                    <td className="px-4 py-2 text-muted">{order.item_count}</td>
                    <td className="px-4 py-2 font-semibold">{formatLKR(order.total)}</td>
                    <td className="px-4 py-2">
                      <StatusBadge tone={statusTone(order.status)}>{STATUS_LABELS[order.status]}</StatusBadge>
                    </td>
                    <td className="px-4 py-2 text-muted">
                      {order.payment_method.toUpperCase()} · {order.payment_status}
                    </td>
                    <td className="px-4 py-2 text-muted">{stockLabel(order)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Pagination
        page={page}
        perPage={perPage}
        total={total}
        basePath="/admin/orders"
        params={{
          q: filters.q,
          status: filters.status === "all" ? undefined : filters.status,
          from: filters.from,
          to: filters.to,
        }}
      />
    </main>
  );
}
