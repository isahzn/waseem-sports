"use client";

import Link from "next/link";
import { formatLKR } from "@/lib/storefront/money";
import { useCart } from "../_components/CartProvider";

export default function CartPage() {
  const { preview, loading, setQty, remove } = useCart();
  const lines = preview?.lines.filter((l) => l.qty > 0) ?? [];

  return (
    <main className="flex flex-col gap-6">
      <h1 className="font-display text-4xl font-bold">Cart</h1>

      {loading && <p className="text-sm text-muted">Checking prices and stock…</p>}

      {!loading && preview && preview.issues.length > 0 && (
        <ul className="flex flex-col gap-2">
          {preview.issues.map((issue) => (
            <li key={`${issue.variantId}-${issue.code}`} role="alert" className="rounded-sm border border-gold-600 bg-card px-3 py-2 text-sm">
              {issue.message}
            </li>
          ))}
        </ul>
      )}

      {!loading && lines.length === 0 && (
        <div role="status" className="rounded-md border border-dashed border-line bg-card px-6 py-12 text-center">
          <p className="font-display text-xl font-bold">Your cart is empty</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">Add something from the shop to get started.</p>
          <Link href="/shop" className="mt-4 inline-block rounded-sm bg-gold-600 px-4 py-2 text-sm font-semibold text-bronze-ink">
            Browse products
          </Link>
        </div>
      )}

      {!loading && lines.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-3">
          <ul className="flex flex-col gap-3 lg:col-span-2">
            {lines.map((line) => (
              <li key={line.variantId} className="flex gap-3 rounded-md border border-line bg-card p-4">
                <div className="flex-1">
                  <Link href={`/product/${line.productSlug}`} className="font-semibold hover:underline">
                    {line.productName}
                  </Link>
                  <p className="text-xs text-muted">{line.variantName}</p>
                  <p className="mt-1 text-sm">{formatLKR(line.unitPrice)} each</p>
                  <div className="mt-2 flex items-center gap-2">
                    <button type="button" aria-label={`Reduce quantity of ${line.productName}`} onClick={() => setQty(line.variantId, line.qty - 1)} className="rounded-sm border border-line px-2.5 py-1">−</button>
                    <span aria-live="polite" className="min-w-6 text-center text-sm font-semibold">{line.qty}</span>
                    <button type="button" aria-label={`Increase quantity of ${line.productName}`} onClick={() => setQty(line.variantId, line.qty + 1)} className="rounded-sm border border-line px-2.5 py-1">+</button>
                    <button type="button" onClick={() => remove(line.variantId)} className="ml-auto text-xs text-muted underline">Remove</button>
                  </div>
                </div>
                <p className="font-semibold">{formatLKR(line.unitPrice * line.qty)}</p>
              </li>
            ))}
          </ul>
          <aside className="h-fit rounded-md border border-line bg-card p-4">
            <h2 className="font-display text-xl font-bold">Summary</h2>
            <p className="mt-2 flex justify-between text-sm">
              <span>{preview?.count ?? 0} item{(preview?.count ?? 0) === 1 ? "" : "s"}</span>
              <b>{formatLKR(preview?.subtotal ?? 0)}</b>
            </p>
            <p className="mt-1 text-xs text-muted">Delivery calculated at checkout.</p>
            <Link
              href="/checkout"
              className="mt-4 block rounded-sm bg-gold-600 px-4 py-2.5 text-center text-sm font-semibold text-bronze-ink"
            >
              Checkout
            </Link>
            <p className="mt-2 text-xs text-muted">Cash on delivery — no account needed.</p>
          </aside>
        </div>
      )}
    </main>
  );
}
