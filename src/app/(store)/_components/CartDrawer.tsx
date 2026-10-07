"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { formatLKR } from "@/lib/storefront/money";
import { useCart } from "./CartProvider";

/**
 * Cart drawer: focus moves to the close button on open and returns to the
 * invoking control on close; Escape closes. Plain fixed panel (no portal
 * dependency) with aria-modal semantics.
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

  return (
    <div role="dialog" aria-modal="true" aria-label="Shopping cart" className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close cart"
        onClick={() => setOpen(false)}
        className="absolute inset-0 cursor-default bg-black/60"
      />
      <aside className="absolute top-0 right-0 flex h-full w-full max-w-md flex-col bg-surface">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="font-display text-xl font-bold">Your cart</h2>
          <button
            ref={closeRef}
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-sm border border-line px-3 py-1.5 text-sm"
          >
            Close
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {loading && <p className="text-sm text-muted">Checking prices and stock…</p>}
          {!loading && preview && preview.issues.length > 0 && (
            <ul className="mb-3 flex flex-col gap-2">
              {preview.issues.map((issue) => (
                <li key={`${issue.variantId}-${issue.code}`} role="alert" className="rounded-sm border border-gold-600 bg-card px-3 py-2 text-sm">
                  {issue.message}
                </li>
              ))}
            </ul>
          )}
          {!loading && (!preview || preview.lines.filter((l) => l.qty > 0).length === 0) && (
            <div className="py-8 text-center">
              <p className="font-semibold">Your cart is empty</p>
              <p className="mt-1 text-sm text-muted">Add something from the shop to get started.</p>
              <Link
                href="/shop"
                onClick={() => setOpen(false)}
                className="mt-4 inline-block rounded-sm bg-gold-600 px-4 py-2 text-sm font-semibold text-bronze-ink"
              >
                Browse products
              </Link>
            </div>
          )}
          {!loading && preview && (
            <ul className="flex flex-col gap-3">
              {preview.lines.filter((l) => l.qty > 0).map((line) => (
                <li key={line.variantId} className="flex gap-3 rounded-md border border-line bg-card p-3">
                  <div className="flex-1">
                    <Link
                      href={`/product/${line.productSlug}`}
                      onClick={() => setOpen(false)}
                      className="font-semibold hover:underline"
                    >
                      {line.productName}
                    </Link>
                    <p className="text-xs text-muted">{line.variantName}</p>
                    <p className="mt-1 text-sm">{formatLKR(line.unitPrice)} each</p>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        aria-label={`Reduce quantity of ${line.productName}`}
                        onClick={() => setQty(line.variantId, line.qty - 1)}
                        className="rounded-sm border border-line px-2.5 py-1"
                      >
                        −
                      </button>
                      <span aria-live="polite" className="min-w-6 text-center text-sm font-semibold">{line.qty}</span>
                      <button
                        type="button"
                        aria-label={`Increase quantity of ${line.productName}`}
                        onClick={() => setQty(line.variantId, line.qty + 1)}
                        className="rounded-sm border border-line px-2.5 py-1"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(line.variantId)}
                        className="ml-auto text-xs text-muted underline"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <p className="text-sm font-semibold">{formatLKR(line.unitPrice * line.qty)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
        {!loading && preview && preview.count > 0 && (
          <div className="border-t border-line px-4 py-3">
            <p className="flex justify-between font-semibold">
              <span>Subtotal</span>
              <span>{formatLKR(preview.subtotal)}</span>
            </p>
            <p className="mt-1 text-xs text-muted">Delivery calculated at checkout.</p>
            <Link
              href="/checkout"
              onClick={() => setOpen(false)}
              className="mt-3 block rounded-sm bg-gold-600 px-4 py-2.5 text-center text-sm font-semibold text-bronze-ink"
            >
              Checkout
            </Link>
            <Link
              href="/cart"
              onClick={() => setOpen(false)}
              className="mt-2 block rounded-sm border border-line px-4 py-2.5 text-center text-sm font-semibold"
            >
              Review cart
            </Link>
          </div>
        )}
      </aside>
    </div>
  );
}
