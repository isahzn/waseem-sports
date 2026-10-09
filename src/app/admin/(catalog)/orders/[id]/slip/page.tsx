import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminOrRedirect } from "@/lib/auth/requireAdmin";
import { formatLKR } from "@/lib/storefront/money";
import { getOrderDetail } from "@/lib/orders/queries";
import { STATUS_LABELS } from "@/lib/orders/status";
import { SlipPrintButton } from "../../_components/SlipPrintButton";

export const metadata = { title: "Packing slip — Waseem Sports Admin" };

/**
 * Packing slip (Fixes §3.6): names + quantities + address + phone, no prices
 * (the packer settles cash on delivery, they don't need the money math).
 * Print-friendly: admin chrome hides on paper via print:hidden.
 */
export default async function PackingSlipPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminOrRedirect();
  const { id } = await params;
  const order = await getOrderDetail(id);
  if (!order) notFound();

  const address = (order.shipping_address ?? {}) as Record<string, unknown>;
  const lines = ["line1", "line2", "city", "district", "postal_code", "country"]
    .map((k) => address[k])
    .filter((v): v is string => typeof v === "string" && v.trim() !== "");

  return (
    <main className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
        <Link href={`/admin/orders/${order.id}`} className="text-sm text-muted hover:text-ink">
          ← Back to order
        </Link>
        <SlipPrintButton />
      </div>

      <div className="rounded-md border border-line bg-card p-6">
        <h1 className="font-display text-2xl font-bold">Waseem Sports — packing slip</h1>
        <p className="mt-1 text-sm text-muted">
          Order <b className="text-ink">{order.order_number}</b> · {STATUS_LABELS[order.status]} ·{" "}
          {new Date(order.placed_at).toLocaleString("en-LK", { dateStyle: "medium", timeStyle: "short" })}
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Deliver to</h2>
            <p className="mt-1 font-semibold">{order.customer_name}</p>
            <p>{order.customer_phone}</p>
            {lines.map((line) => (
              <p key={line} className="text-sm">
                {line}
              </p>
            ))}
          </section>
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Order</h2>
            <p className="mt-1 text-sm">
              {order.payment_method === "cod" ? "Cash on delivery" : order.payment_method.toUpperCase()} ·{" "}
              {order.payment_status}
            </p>
            <p className="text-sm">Collect on delivery: {formatLKR(order.total)}</p>
            {order.notes && <p className="mt-2 text-sm">Note: {order.notes}</p>}
          </section>
        </div>

        <table className="mt-4 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-muted">
              <th scope="col" className="py-2 pr-3 font-semibold">
                Item
              </th>
              <th scope="col" className="py-2 text-right font-semibold">
                Qty
              </th>
              <th scope="col" className="py-2 text-right font-semibold">
                Packed
              </th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id} className="border-b border-line last:border-0">
                <td className="py-2 pr-3">
                  <span className="font-semibold">{item.product_name}</span>
                  {item.variant_name && item.variant_name !== "Default" && (
                    <span className="block text-xs text-muted">{item.variant_name}</span>
                  )}
                  {item.sku && <span className="block text-xs text-muted">SKU {item.sku}</span>}
                </td>
                <td className="py-2 text-right font-semibold">{item.quantity}</td>
                <td className="py-2 text-right">
                  <span className="inline-block h-5 w-5 rounded-sm border border-line" aria-hidden="true" />
                  <span className="sr-only">Tick when packed</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
