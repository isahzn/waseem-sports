"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { formatLKR } from "@/lib/storefront/money";
import { cardImage } from "@/lib/storefront/images";
import { useCart } from "./CartProvider";

/**
 * Cart drawer. The design has no drawer, so this panel speaks the design's
 * language instead: the card surface (`var(--card)`), 1px `--ln` rules, the
 * `.q` stepper, `.row` lines and the `.btn` / `.btn.alt` actions.
 *
 * Behaviour is unchanged: focus moves to the close button on open and returns
 * to the invoking control on close; Escape closes; aria-modal semantics.
 */
export function CartDrawer() {
  const { isOpen, setOpen, preview, loading, setQty, remove } = useCart();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      closeRef.current?.focus();
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") setOpen(false);
      };
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }
  }, [isOpen, setOpen]);

  if (!isOpen) return null;

  const lines = preview?.lines.filter((l) => l.qty > 0) ?? [];

  return (
    <div role="dialog" aria-modal="true" aria-label="Shopping cart" className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close cart"
        onClick={() => setOpen(false)}
        className="absolute inset-0 cursor-default bg-black/60"
      />

      <aside
        className="absolute top-0 right-0 flex h-full w-full max-w-md flex-col"
        style={{ background: "var(--card)", borderLeft: "1px solid var(--ln)" }}
      >
        <div className="row" style={{ padding: "12px 16px", margin: 0 }}>
          <h2 style={{ fontSize: "22px" }}>Your cart</h2>
          <button
            ref={closeRef}
            type="button"
            onClick={() => setOpen(false)}
            className="btn"
            style={{ padding: "8px 16px" }}
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto" style={{ padding: "8px 16px" }}>
          {loading && <p className="sold">Checking prices and stock…</p>}

          {!loading && preview && preview.issues.length > 0 && (
            <div className="box" role="alert" style={{ marginBottom: 12 }}>
              {preview.issues.map((issue) => (
                <p className="sold" key={`${issue.variantId}-${issue.code}`}>
                  {issue.message}
                </p>
              ))}
            </div>
          )}

          {!loading && lines.length === 0 && (
            <div className="box">
              <h2 style={{ fontSize: "22px" }}>Your cart is empty</h2>
              <p className="sold">Add something from the shop to get started.</p>
              <p>
                <Link className="btn" href="/shop" onClick={() => setOpen(false)}>
                  Browse products
                </Link>
              </p>
            </div>
          )}

          {!loading && lines.length > 0 && (
            <div>
              {lines.map((line) => {
                const thumb = line.image
                  ? cardImage({ ...line.image, is_primary: false, sort_order: 0 })
                  : null;
                return (
                  <div className="row" key={line.variantId} style={{ flexWrap: "wrap" }}>
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
                      <Link href={`/product/${line.productSlug}`} onClick={() => setOpen(false)}>
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

                    <b className="sold">{formatLKR(line.unitPrice * line.qty)}</b>

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
          )}
        </div>

        {!loading && preview && preview.count > 0 && (
          <div style={{ borderTop: "1px solid var(--ln)", padding: "12px 16px" }}>
            <div className="row">
              <span>
                Subtotal · {preview.count} item{preview.count === 1 ? "" : "s"}
              </span>
              <b>{formatLKR(preview.subtotal)}</b>
            </div>
            <p className="sold">Delivery is calculated at checkout.</p>
            <p>
              <Link className="btn" href="/checkout" onClick={() => setOpen(false)}>
                Checkout
              </Link>
            </p>
            <p>
              <Link className="btn alt" href="/cart" onClick={() => setOpen(false)}>
                Review cart
              </Link>
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
