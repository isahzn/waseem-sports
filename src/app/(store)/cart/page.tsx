"use client";

import Link from "next/link";
import { formatLKR } from "@/lib/storefront/money";
import { cardImage } from "@/lib/storefront/images";
import { useHydrated } from "@/lib/storefront/use-hydrated";
import { useCart } from "../_components/CartProvider";

/**
 * Cart page, matching the canonical design's `cart()` template: a 40px serif
 * title, then `.two` — the lines in a `.box` on the left (.row per line with
 * the 56px image cell and the design's `.q` stepper) and the Summary box on
 * the right. Every price is the server-priced value from `priceCart`.
 */
export default function CartPage() {
  const { preview, loading, setQty, remove } = useCart();
  const hydrated = useHydrated();
  const lines = preview?.lines.filter((l) => l.qty > 0) ?? [];
  // Render the priced cart only once hydration is done: the price/stock lookup
  // is an effect-triggered server action that can resolve mid-hydration, and
  // swapping these lines in while React is hydrating throws React #418.
  const showPreview = hydrated && !loading;

  return (
    <main>
      <h1 style={{ fontSize: "40px" }}>Cart</h1>

      {!showPreview && <p className="sold">Checking prices and stock…</p>}

      {showPreview && preview && preview.issues.length > 0 && (
        <div className="box" role="alert">
          {preview.issues.map((issue) => (
            <p className="sold" key={`${issue.variantId}-${issue.code}`}>
              {issue.message}
            </p>
          ))}
        </div>
      )}

      {showPreview && lines.length === 0 && (
        <div className="box">
          <h2>Your cart is empty</h2>
          <p>Add something from the shop to get started.</p>
          <p>
            <Link className="btn" href="/shop">
              Browse products
            </Link>
          </p>
        </div>
      )}

      {showPreview && lines.length > 0 && (
        <div className="two">
          <div className="box">
            {lines.map((line) => {
              const thumb = line.image
                ? cardImage({ ...line.image, is_primary: false, sort_order: 0 })
                : null;
              return (
                <div className="row" key={line.variantId}>
                  <span className="img" style={{ width: 56, flex: "none" }}>
                    {thumb && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thumb.src}
                        alt={thumb.alt}
                        width={thumb.width}
                        height={thumb.height}
                        loading="lazy"
                        decoding="async"
                      />
                    )}
                  </span>

                  <span style={{ flex: 1 }}>
                    <Link href={`/product/${line.productSlug}`}>
                      <b>{line.productName}</b>
                    </Link>
                    <br />
                    <span className="sold">
                      {line.variantName} · {formatLKR(line.unitPrice)} each
                    </span>
                  </span>

                  <span className="q">
                    <button
                      type="button"
                      aria-label={`Reduce quantity of ${line.productName}`}
                      onClick={() => setQty(line.variantId, line.qty - 1)}
                    >
                      −
                    </button>{" "}
                    <span aria-live="polite">{line.qty}</span>{" "}
                    <button
                      type="button"
                      aria-label={`Increase quantity of ${line.productName}`}
                      onClick={() => setQty(line.variantId, line.qty + 1)}
                    >
                      +
                    </button>
                  </span>

                  <b>{formatLKR(line.unitPrice * line.qty)}</b>

                  <button
                    type="button"
                    className="sold"
                    style={{ background: "none", border: 0, textDecoration: "underline" }}
                    onClick={() => remove(line.variantId)}
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>

          <aside className="box">
            <h2>Summary</h2>
            <div className="row">
              <span>Subtotal</span>
              <b>{formatLKR(preview?.subtotal ?? 0)}</b>
            </div>
            <div className="row">
              <span>Delivery</span>
              <b>—</b>
            </div>
            <div className="row">
              <span>Total</span>
              <b>{formatLKR(preview?.subtotal ?? 0)}</b>
            </div>
            <p className="sold">Delivery is calculated at checkout.</p>
            <p>
              <Link className="btn" href="/checkout">
                Go to checkout
              </Link>
            </p>
            <p className="sold">Cash on delivery — no account needed.</p>
          </aside>
        </div>
      )}
    </main>
  );
}
