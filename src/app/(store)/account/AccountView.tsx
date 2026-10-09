"use client";

import Link from "next/link";
import { formatLKR } from "@/lib/storefront/money";
import { ORDER_LIFECYCLE, forgetOrder, lifecycleStep, useRememberedOrders } from "@/lib/storefront/order-memory";
import { useHydrated } from "@/lib/storefront/use-hydrated";

function formatPlacedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-LK", { dateStyle: "medium", timeStyle: "short" });
}

/**
 * `/account`, laid out like the canonical design's `account()` route: a 40px
 * serif title, then a `.box` of orders — each a `.row` carrying the order
 * number, its total, a `.pill` status, the design's `.steps` progress bar and
 * a muted date.
 *
 * The list is the device-local memory of guest orders (no sign-in), so it can
 * only be read after mount: the first paint shows a short "checking" line
 * rather than a false "you have no orders".
 */
export function AccountView() {
  const orders = useRememberedOrders();
  // The list is device-local, so it can only be read after hydration.
  const mounted = useHydrated();

  return (
    <main>
      <h1 style={{ fontSize: "40px" }}>My account</h1>

      {!mounted ? (
        <p className="sold">Checking this device for orders…</p>
      ) : orders.length === 0 ? (
        <div className="box">
          <h2>Orders</h2>
          <p className="sold">
            Orders you place in this browser are remembered here, so you can come back to them without an
            account — checkout is guest-only and nothing is sent anywhere.
          </p>
          <p>
            <Link className="btn" href="/shop">
              Browse the shop
            </Link>
          </p>
          <p className="sold">
            Ordered on another device, or cleared your browser? Enter your order number and code on the{" "}
            <Link href="/track">order tracking</Link> page instead.
          </p>
        </div>
      ) : (
        <div className="box">
          <h2>Orders</h2>
          {orders.map((order) => {
            const step = lifecycleStep(order.status);
            const href = `/order/${encodeURIComponent(order.number)}?t=${encodeURIComponent(order.token)}`;
            const placed = formatPlacedAt(order.placedAt);
            const stepText =
              step >= 0
                ? `Step ${step + 1} of ${ORDER_LIFECYCLE.length}: ${order.statusLabel}`
                : order.statusLabel;

            return (
              <div className="row" key={order.number} style={{ display: "block" }}>
                <div className="row" style={{ border: 0, padding: 0 }}>
                  <Link href={href}>
                    <b>{order.number}</b>
                  </Link>
                  <span>{formatLKR(order.total)}</span>
                  <span className="pill">{order.statusLabel}</span>
                </div>

                <div className="steps" aria-hidden="true">
                  {ORDER_LIFECYCLE.map((status, i) => (
                    <i key={status} className={step >= 0 && step >= i ? "d" : undefined} />
                  ))}
                </div>
                <p className="sold" style={{ margin: "4px 0 0" }}>
                  {stepText}
                  {placed ? ` · Placed ${placed}` : ""}
                </p>

                <p className="sold" style={{ margin: "4px 0 0" }}>
                  <Link href={href}>Open order</Link>
                  {" · "}
                  <button
                    type="button"
                    onClick={() => forgetOrder(order.number)}
                    style={{ background: "none", border: 0, textDecoration: "underline" }}
                  >
                    Forget this order
                  </button>
                </p>
              </div>
            );
          })}
          <p className="sold" style={{ marginTop: 12 }}>
            Forgetting an order only removes it from this browser — the order itself is untouched. Keep the
            tracking link from your confirmation if you need it later.
          </p>
        </div>
      )}
    </main>
  );
}
