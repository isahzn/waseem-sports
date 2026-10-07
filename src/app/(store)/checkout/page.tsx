import Link from "next/link";
import type { Metadata } from "next";
import { priceCart } from "@/lib/storefront/cart";
import { readCartFromCookies } from "@/lib/storefront/cart-server";
import { getShippingOptions } from "@/lib/orders/queries";
import { getShopInfo } from "@/lib/storefront/catalog";
import { CheckoutForm, type CheckoutLine, type DeliveryOption } from "./CheckoutForm";

export const metadata: Metadata = {
  title: "Checkout — Waseem Sports",
  description: "Guest checkout with cash on delivery.",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  const [options, info, cartLines] = await Promise.all([
    getShippingOptions(),
    getShopInfo(),
    readCartFromCookies(),
  ]);
  const preview = await priceCart(cartLines);
  const lines: CheckoutLine[] = preview.lines
    .filter((l) => l.qty > 0)
    .map((l) => ({
      variantId: l.variantId,
      productName: l.productName,
      variantName: l.variantName,
      unitPrice: l.unitPrice,
      qty: l.qty,
    }));

  if (lines.length === 0) {
    return (
      <main className="flex flex-col gap-6">
        <h1 className="font-display text-4xl font-bold">Checkout</h1>
        <div role="status" className="rounded-md border border-dashed border-line bg-card px-6 py-12 text-center">
          <p className="font-display text-xl font-bold">Your cart is empty</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">Add something from the shop to check out.</p>
          <Link href="/shop" className="mt-4 inline-block rounded-sm bg-gold-600 px-4 py-2 text-sm font-semibold text-bronze-ink">
            Browse products
          </Link>
        </div>
      </main>
    );
  }

  // No delivery rule is configured yet (D5: nothing is seeded) — checkout stays
  // closed rather than guessing a fee or blocking an order the shop can't deliver.
  if (options.length === 0) {
    const whatsapp = info["public.store_whatsapp"] ?? null;
    const phone = info["public.store_phone_1"] ?? null;
    return (
      <main className="flex flex-col gap-6">
        <h1 className="font-display text-4xl font-bold">Checkout</h1>
        <div role="status" className="rounded-md border border-dashed border-line bg-card px-6 py-12 text-center">
          <p className="font-display text-xl font-bold">Online checkout isn&apos;t open yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            The shop hasn&apos;t set up delivery options yet. Your cart is saved — message us and we&apos;ll take the order
            directly.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            {whatsapp && (
              <a
                href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`}
                className="rounded-sm bg-gold-600 px-4 py-2 text-sm font-semibold text-bronze-ink"
              >
                WhatsApp {whatsapp}
              </a>
            )}
            {phone && (
              <a href={`tel:${phone.replace(/\s/g, "")}`} className="rounded-sm border border-line px-4 py-2 text-sm font-semibold">
                Call {phone}
              </a>
            )}
            <Link href="/cart" className="rounded-sm border border-line px-4 py-2 text-sm font-semibold">
              Back to cart
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const delivery: DeliveryOption[] = options.map((o) => ({
    id: o.id,
    name: o.name,
    method: o.method,
    fee: o.fee,
    freeOver: o.freeOver,
    estDaysMin: o.estDaysMin,
    estDaysMax: o.estDaysMax,
  }));

  return (
    <main className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-4xl font-bold">Checkout</h1>
        <p className="mt-1 text-sm text-muted">Guest checkout — no account needed. Pay cash when your order arrives.</p>
      </div>

      {preview.issues.length > 0 && (
        <ul className="flex flex-col gap-2">
          {preview.issues.map((issue) => (
            <li
              key={`${issue.variantId}-${issue.code}`}
              role="alert"
              className="rounded-sm border border-gold-600 bg-card px-3 py-2 text-sm"
            >
              {issue.message}{" "}
              <Link href="/cart" className="underline">
                Review cart
              </Link>
            </li>
          ))}
        </ul>
      )}

      <CheckoutForm
        options={delivery}
        lines={lines}
        subtotal={preview.subtotal}
        contactPhone={info["public.store_phone_1"] ?? null}
      />
    </main>
  );
}
