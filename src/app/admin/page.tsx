import Link from "next/link";
import { getDashboardData } from "@/lib/orders/queries";
import { formatLKR } from "@/lib/storefront/money";

export const metadata = { title: "Dashboard — Waseem Sports Admin" };

const SECTIONS = [
  { href: "/admin/products", title: "Products", hint: "Create, publish, variants, photos, specs." },
  { href: "/admin/inventory", title: "Inventory", hint: "Live stock per variant + manual corrections." },
  { href: "/admin/sports", title: "Sports", hint: "Top-level taxonomy." },
  { href: "/admin/categories", title: "Categories", hint: "Group products, optional nesting." },
  { href: "/admin/brands", title: "Brands", hint: "Manufacturers and labels." },
  { href: "/admin/attributes", title: "Attributes", hint: "Specs + product options (Size, Colour…)." },
];

export default async function AdminDashboardPage() {
  const data = await getDashboardData();

  const tiles = [
    {
      label: "New orders",
      value: String(data.newOrders),
      hint: "Waiting to be confirmed",
      href: "/admin/orders?status=new",
      emphasise: data.newOrders > 0,
    },
    {
      label: "Orders today",
      value: String(data.ordersToday),
      hint: "Placed since midnight",
      href: "/admin/orders",
      emphasise: false,
    },
    {
      label: "Revenue, 30 days",
      value: formatLKR(data.revenue30d),
      hint: "Confirmed orders and later",
      href: "/admin/orders",
      emphasise: false,
    },
    {
      label: "Orders, 30 days",
      value: String(data.orders30d),
      hint: "Excludes cancelled and refunded",
      href: "/admin/orders",
      emphasise: false,
    },
  ];

  return (
    <main>
      <h1 className="font-display text-3xl font-bold">Dashboard</h1>
      <p className="mt-2 text-muted">Orders and stock at a glance.</p>

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

      <p className="mt-4">
        <Link
          href="/admin/orders"
          className="rounded-sm bg-gold-600 px-4 py-2 text-sm font-semibold text-bronze-ink"
        >
          Open orders
        </Link>
      </p>

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

      <h2 className="mt-10 font-display text-xl font-bold">Catalog</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {SECTIONS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-md border border-line bg-card p-4 hover:border-gold-600"
          >
            <h3 className="font-semibold">{item.title}</h3>
            <p className="mt-1 text-sm text-muted">{item.hint}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
