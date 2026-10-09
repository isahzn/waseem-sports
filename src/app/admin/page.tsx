import Link from "next/link";
import { requireAdminOrRedirect } from "@/lib/auth/requireAdmin";
import { getDashboardData } from "@/lib/orders/queries";
import { formatLKR } from "@/lib/storefront/money";

export const metadata = { title: "Dashboard — Waseem Sports Admin" };

/**
 * Dashboard (Fixes §3.2): the most urgent things first — new orders, bank
 * transfers waiting for confirmation, low stock — then quick actions, then
 * the stat tiles (each explained in plain words). The duplicate catalog cards
 * are gone: the sidebar already navigates to those pages.
 */
export default async function AdminDashboardPage() {
  await requireAdminOrRedirect();
  const data = await getDashboardData();

  const urgent: { label: string; detail: string; href: string }[] = [];
  if (data.newOrders > 0) {
    urgent.push({
      label: `${data.newOrders} new order${data.newOrders === 1 ? "" : "s"} to confirm`,
      detail: "Confirm them so stock is reserved and the customer gets a reply.",
      href: "/admin/orders?status=new",
    });
  }
  if (data.pendingTransfers > 0) {
    urgent.push({
      label: `${data.pendingTransfers} bank transfer${data.pendingTransfers === 1 ? "" : "s"} to confirm`,
      detail: "Check the shop account, then approve or reject with one tap.",
      href: "/admin/transfers",
    });
  }
  const outOfStock = data.lowStock.filter((r) => r.available <= 0).length;
  if (outOfStock > 0) {
    urgent.push({
      label: `${outOfStock} product${outOfStock === 1 ? "" : "s"} out of stock`,
      detail: "Restock or hide them so customers aren't disappointed.",
      href: "/admin/inventory",
    });
  } else if (data.lowStock.length > 0) {
    urgent.push({
      label: `${data.lowStock.length} product${data.lowStock.length === 1 ? "" : "s"} running low`,
      detail: "Reorder soon — quantities are at or below the warning level.",
      href: "/admin/inventory",
    });
  }

  const tiles = [
    {
      label: "New orders",
      value: String(data.newOrders),
      hint: "Orders placed by customers that nobody has confirmed yet.",
      href: "/admin/orders?status=new",
      emphasise: data.newOrders > 0,
    },
    {
      label: "Orders today",
      value: String(data.ordersToday),
      hint: "Every order placed since midnight, whatever its state.",
      href: "/admin/orders",
      emphasise: false,
    },
    {
      label: "Revenue, 30 days",
      value: formatLKR(data.revenue30d),
      hint: "Money from confirmed orders in the last 30 days (cancelled excluded).",
      href: "/admin/orders",
      emphasise: false,
    },
    {
      label: "Orders, 30 days",
      value: String(data.orders30d),
      hint: "Count of confirmed orders in the last 30 days.",
      href: "/admin/orders",
      emphasise: false,
    },
  ];

  return (
    <main>
      <h1 className="font-display text-3xl font-bold">Dashboard</h1>
      <p className="mt-2 text-muted">What needs your attention today, in order.</p>

      <section aria-labelledby="needs" className="mt-6 rounded-md border border-line bg-card p-4">
        <h2 id="needs" className="font-display text-xl font-bold">
          Needs attention
        </h2>
        {urgent.length === 0 ? (
          <p className="mt-3 rounded-sm border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
            Nothing urgent — no new orders, no transfers waiting, stock looks healthy.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col">
            {urgent.map((item) => (
              <li key={item.label} className="border-t border-line first:border-t-0">
                <Link href={item.href} className="flex items-baseline justify-between gap-3 py-2 text-sm hover:text-gold-400">
                  <span>
                    <b>{item.label}</b>
                    <span className="block text-xs text-muted">{item.detail}</span>
                  </span>
                  <span aria-hidden="true">→</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-4 flex flex-wrap gap-2" aria-label="Quick actions">
        <Link href="/admin/products/new" className="rounded-sm bg-gold-600 px-4 py-2 text-sm font-semibold text-bronze-ink">
          Add product
        </Link>
        <Link href="/admin/inventory" className="rounded-sm border border-line px-4 py-2 text-sm font-semibold">
          Update stock
        </Link>
        <Link href="/admin/orders?status=new" className="rounded-sm border border-line px-4 py-2 text-sm font-semibold">
          View new orders
        </Link>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => (
          <Link
            key={tile.label}
            href={tile.href}
            className={`rounded-md border bg-card p-4 hover:border-gold-600 ${
              tile.emphasise ? "border-gold-600" : "border-line"
            }`}
          >
            <p className="text-xs uppercase tracking-wide text-muted">{tile.label}</p>
            <p className="mt-1 font-display text-2xl font-bold">{tile.value}</p>
            <p className="mt-1 text-xs text-muted">{tile.hint}</p>
          </Link>
        ))}
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <section className="rounded-md border border-line bg-card p-4">
          <h2 className="font-display text-xl font-bold">Top products, 30 days</h2>
          {data.topProducts.length === 0 ? (
            <p className="mt-3 rounded-sm border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
              No sales yet. Products appear here once orders are confirmed.
            </p>
          ) : (
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="text-left text-muted">
                  <th scope="col" className="pb-2 font-normal">
                    Product
                  </th>
                  <th scope="col" className="pb-2 text-right font-normal">
                    Sold
                  </th>
                  <th scope="col" className="pb-2 text-right font-normal">
                    Revenue
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.topProducts.map((product) => (
                  <tr key={product.name} className="border-t border-line">
                    <td className="py-2 pr-3">{product.name}</td>
                    <td className="py-2 text-right">{product.quantity}</td>
                    <td className="py-2 text-right font-semibold">{formatLKR(product.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="rounded-md border border-line bg-card p-4">
          <h2 className="font-display text-xl font-bold">Low stock</h2>
          {data.lowStock.length === 0 ? (
            <p className="mt-3 rounded-sm border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
              Stock levels look healthy.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col">
              {data.lowStock.map((row) => (
                <li key={row.variantId} className="border-t border-line first:border-t-0">
                  <Link
                    href="/admin/inventory"
                    className="flex items-baseline justify-between gap-3 py-2 text-sm hover:text-gold-400"
                  >
                    <span>
                      {row.productName}
                      <span className="block text-xs text-muted">{row.variantName}</span>
                    </span>
                    <span className={row.available <= 0 ? "text-red-300" : "text-gold-400"}>
                      {row.available <= 0 ? "Out of stock" : `${row.available} left`}
                      <span className="block text-right text-xs text-muted">reorder at {row.threshold}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
