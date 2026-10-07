import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { getTrackedOrder } from "@/lib/orders/queries";
import { buildTrackingUrl, parseTrackingToken } from "@/lib/orders/tracking";
import { CUSTOMER_STATUS_TEXT, STATUS_LABELS } from "@/lib/orders/status";
import { checkRateLimit, clientIp } from "@/lib/security/ratelimit";
import { formatLKR } from "@/lib/storefront/money";
import { CartReset } from "./CartReset";

export const metadata: Metadata = {
  title: "Your order — Waseem Sports",
  robots: { index: false, follow: false },
};

function formatDate(value: string): string {
  return new Date(value).toLocaleString("en-LK", { dateStyle: "medium", timeStyle: "short" });
}

/**
 * Confirmation + tracking in one page, reached from the customer's tracking
 * link (`/order/<number>?t=<token>`). The order number alone reveals nothing:
 * without a token that hashes to the stored value this is a 404.
 */
export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ number: string }>;
  searchParams: Promise<{ t?: string | string[] }>;
}) {
  const [{ number }, sp] = await Promise.all([params, searchParams]);
  const rawToken = Array.isArray(sp.t) ? sp.t[0] : sp.t;
  const token = parseTrackingToken(rawToken);
  if (!token) notFound();

  const ip = clientIp(await headers());
  const limit = await checkRateLimit(`track:${ip}`, 60, 15 * 60 * 1000);
  if (!limit.allowed) {
    return (
      <main className="flex flex-col gap-4">
        <h1 className="font-display text-3xl font-bold">Too many lookups</h1>
        <p className="text-sm text-muted">
          Please wait a few minutes and open your tracking link again, or call the shop and we&apos;ll check your order.
        </p>
        <Link href="/track" className="text-sm underline">
          Back to order tracking
        </Link>
      </main>
    );
  }

  const order = await getTrackedOrder(number, token);
  if (!order) notFound();

  const address = order.shipping_address as Record<string, string | undefined>;
  const addressLines = [
    address.line1,
    address.line2,
    address.city,
    address.district,
    address.postal_code,
  ].filter((v): v is string => Boolean(v && String(v).trim()));
  const trackingUrl = buildTrackingUrl(order.order_number, token);

  return (
    <main className="flex flex-col gap-8">
      <CartReset />

      <div className="rounded-md border border-line bg-card p-6">
        <p className="text-xs font-semibold tracking-wide text-muted uppercase">
          {order.status === "new" ? "Order received" : "Order status"}
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold">Order {order.order_number}</h1>
        <p className="mt-2 text-sm">
          Thank you, {order.customer_name}. {CUSTOMER_STATUS_TEXT[order.status]}
        </p>
        <p className="mt-1 text-xs text-muted">Placed {formatDate(order.placed_at)}</p>
        <p className="mt-3 inline-block rounded-sm border border-gold-600 px-3 py-1 text-sm font-semibold">
          {STATUS_LABELS[order.status]}
        </p>
        <p className="mt-4 text-xs text-muted">
          Save this link to check your order later:
          <br />
          <span className="break-all">{trackingUrl}</span>
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section aria-labelledby="items-heading" className="lg:col-span-2">
          <h2 id="items-heading" className="font-display text-xl font-bold">
            Items
          </h2>
          <ul className="mt-3 flex flex-col gap-3">
            {order.items.map((item, index) => (
              <li key={`${item.product_name}-${index}`} className="flex gap-3 rounded-md border border-line bg-card p-4 text-sm">
                <span className="flex-1">
                  <span className="block font-semibold">{item.product_name}</span>
                  <span className="block text-xs text-muted">
                    {item.variant_name ?? "Default"} · {item.quantity} × {formatLKR(item.unit_price)}
                  </span>
                </span>
                <span className="font-semibold">{formatLKR(item.line_total)}</span>
              </li>
            ))}
          </ul>

          <dl className="mt-4 flex flex-col gap-1 rounded-md border border-line bg-card p-4 text-sm">
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd className="font-semibold">{formatLKR(order.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Delivery{order.shipping_method ? ` (${order.shipping_method})` : ""}</dt>
              <dd className="font-semibold">{order.shipping_fee > 0 ? formatLKR(order.shipping_fee) : "Free"}</dd>
            </div>
            <div className="mt-1 flex justify-between border-t border-line pt-2 text-base">
              <dt className="font-semibold">Total</dt>
              <dd className="font-bold">{formatLKR(order.total)}</dd>
            </div>
          </dl>
        </section>

        <aside className="flex flex-col gap-6">
          <section aria-labelledby="delivery-heading" className="rounded-md border border-line bg-card p-4 text-sm">
            <h2 id="delivery-heading" className="font-display text-lg font-bold">
              Delivery
            </h2>
            <address className="mt-2 not-italic">
              {addressLines.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </address>
          </section>

          <section aria-labelledby="payment-heading" className="rounded-md border border-line bg-card p-4 text-sm">
            <h2 id="payment-heading" className="font-display text-lg font-bold">
              Payment
            </h2>
            <p className="mt-2">
              {order.payment_method === "cod"
                ? "Cash on delivery — pay when your order arrives."
                : `Method: ${order.payment_method}`}
            </p>
            <p className="mt-1 text-xs text-muted">Payment status: {order.payment_status}</p>
          </section>

          <section aria-labelledby="timeline-heading" className="rounded-md border border-line bg-card p-4 text-sm">
            <h2 id="timeline-heading" className="font-display text-lg font-bold">
              Progress
            </h2>
            <ol className="mt-2 flex flex-col gap-2">
              {order.history.map((entry, index) => (
                <li key={`${entry.to_status}-${index}`} className="flex flex-col">
                  <span className="font-semibold">{STATUS_LABELS[entry.to_status]}</span>
                  <span className="text-xs text-muted">{formatDate(entry.created_at)}</span>
                </li>
              ))}
            </ol>
          </section>

          <Link href="/shop" className="rounded-sm border border-line px-4 py-2 text-center text-sm font-semibold">
            Continue shopping
          </Link>
        </aside>
      </div>
    </main>
  );
}
