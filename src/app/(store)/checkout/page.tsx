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
      <main>
        <h1 style={{ fontSize: "40px" }}>Checkout</h1>
        <div className="box">
          <h2>Your cart is empty</h2>
          <p className="sold my-4">Add something from the shop to check out.</p>
          <Link className="btn" href="/shop">
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
      <main>
        <h1 style={{ fontSize: "40px" }}>Checkout</h1>
        <div className="box">
          <h2>Online checkout isn&apos;t open yet</h2>
          <p className="sold my-4">
            The shop hasn&apos;t set up delivery options yet. Your cart is saved — message us and we&apos;ll take the order
            directly.
          </p>
          {whatsapp && (
            <a className="btn" href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`}>
              WhatsApp {whatsapp}
            </a>
          )}{" "}
          {phone && (
            <a className="btn alt" href={`tel:${phone.replace(/\s/g, "")}`}>
              Call {phone}
            </a>
          )}{" "}
          <Link className="btn out" href="/cart">
            Back to cart
          </Link>
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
    <main>
      <h1 style={{ fontSize: "40px" }}>Checkout</h1>
      <p className="sold my-4">Guest checkout — no account needed. Pay cash when your order arrives.</p>

      {preview.issues.length > 0 && (
        <ul className="flex list-none flex-col gap-2 p-0">
          {preview.issues.map((issue) => (
            <li key={`${issue.variantId}-${issue.code}`} role="alert" className="deal">
              {issue.message} <Link href="/cart">Review cart</Link>
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
