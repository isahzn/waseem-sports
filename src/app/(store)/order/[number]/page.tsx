import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { getTrackedOrder } from "@/lib/orders/queries";
import { buildTrackingUrl, parseTrackingToken } from "@/lib/orders/tracking";
import { CUSTOMER_STATUS_TEXT, STATUS_LABELS, type OrderStatus } from "@/lib/orders/status";
import { checkRateLimit, clientIp } from "@/lib/security/ratelimit";
import { formatLKR } from "@/lib/storefront/money";
import { CartReset } from "./CartReset";
import { RememberOrder } from "./RememberOrder";

export const metadata: Metadata = {
  title: "Your order — Waseem Sports",
  robots: { index: false, follow: false },
};

function formatDate(value: string): string {
  return new Date(value).toLocaleString("en-LK", { dateStyle: "medium", timeStyle: "short" });
}

/** The customer-facing delivery chain, in the design's `.steps` order. */
const LIFECYCLE: readonly OrderStatus[] = ["new", "confirmed", "processing", "shipped", "delivered"];

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
      <main>
        <div className="box" role="status">
          <h2>Too many lookups</h2>
          <p className="sold">
            Please wait a few minutes and open your tracking link again, or call the shop and we&apos;ll check your
            order.
          </p>
          <Link href="/track" className="btn">
            Back to order tracking
          </Link>
        </div>
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

  // How far along the delivery chain this order is. Cancelled / refunded /
  // payment-failed orders sit outside the chain: the bars stay unfilled and the
  // pill plus the line below carry the real status.
  const stepIndex = LIFECYCLE.indexOf(order.status);
  const stepText =
    stepIndex >= 0
      ? `Step ${stepIndex + 1} of ${LIFECYCLE.length}: ${STATUS_LABELS[order.status]}`
      : STATUS_LABELS[order.status];

  return (
    <main>
      <CartReset />
      <RememberOrder
        number={order.order_number}
        token={token}
        total={Number(order.total)}
        placedAt={order.placed_at}
        status={order.status}
        statusLabel={STATUS_LABELS[order.status]}
      />

      <div className="box">
        <div className="row">
          <span className="sold">{order.status === "new" ? "Order received" : "Order status"}</span>
          <span className="pill">{STATUS_LABELS[order.status]}</span>
        </div>
        <h1 style={{ fontSize: "40px" }}>Order {order.order_number}</h1>
        <p className="sold mt-2">
          Thank you, {order.customer_name}. {CUSTOMER_STATUS_TEXT[order.status]}
        </p>
        <p className="sold">Placed {formatDate(order.placed_at)}</p>

        <div className="steps" aria-hidden="true">
          {LIFECYCLE.map((status, i) => (
            <i key={status} className={stepIndex >= i ? "d" : undefined} />
          ))}
        </div>
        <p className="sold mt-1">{stepText}</p>

        <p className="sold mt-2">
          Save this link to check your order later:
          <br />
          <span className="break-all">{trackingUrl}</span>
        </p>
      </div>

      <div className="two mt-4">
        <section aria-labelledby="items-heading">
          <h2 id="items-heading">Items</h2>
          <div className="tw mt-2">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Unit</th>
                  <th>Line total</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item, index) => (
                  <tr key={`${item.product_name}-${index}`}>
                    <td>
                      {item.product_name}
                      {item.variant_name && <span className="sold"> · {item.variant_name}</span>}
                    </td>
                    <td>{item.quantity}</td>
                    <td>{formatLKR(item.unit_price)}</td>
                    <td>{formatLKR(item.line_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="box mt-3">
            <div className="row">
              <span>Subtotal</span>
              <b>{formatLKR(order.subtotal)}</b>
            </div>
            <div className="row">
              <span>Delivery{order.shipping_method ? ` (${order.shipping_method})` : ""}</span>
              <b>{order.shipping_fee > 0 ? formatLKR(order.shipping_fee) : "Free"}</b>
            </div>
            <div className="row">
              <b>Total</b>
              <b>{formatLKR(order.total)}</b>
            </div>
          </div>
        </section>

        <aside>
          <section aria-labelledby="delivery-heading" className="box">
            <h2 id="delivery-heading">Delivery</h2>
            <address className="sold mt-1">
              {addressLines.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </address>
          </section>

          <section aria-labelledby="payment-heading" className="box mt-3">
            <h2 id="payment-heading">Payment</h2>
            <p className="sold mt-1">
              {order.payment_method === "cod"
                ? "Cash on delivery — pay when your order arrives."
                : `Method: ${order.payment_method}`}
            </p>
            <p className="sold">Payment status: {order.payment_status}</p>
          </section>

          <section aria-labelledby="timeline-heading" className="box mt-3">
            <h2 id="timeline-heading">Progress</h2>
            <ol className="mt-1">
              {order.history.map((entry, index) => (
                <li key={`${entry.to_status}-${index}`} className="row" style={{ display: "block" }}>
                  <span className="block">{STATUS_LABELS[entry.to_status]}</span>
                  <span className="sold">{formatDate(entry.created_at)}</span>
                </li>
              ))}
            </ol>
          </section>

          <p className="mt-3">
            <Link href="/shop" className="btn out">
              Continue shopping
            </Link>
          </p>
        </aside>
      </div>
    </main>
  );
}
