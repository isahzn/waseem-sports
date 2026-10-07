import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { getTrackedOrder } from "@/lib/orders/queries";
import { trackingLookupInput } from "@/lib/orders/schemas";
import { checkRateLimit, clientIp } from "@/lib/security/ratelimit";

export const metadata: Metadata = {
  title: "Track your order — Waseem Sports",
  description: "Look up a guest order with your order number and tracking code.",
  robots: { index: false, follow: false },
};

/**
 * Order lookup for a customer who lost the tracking link. It only forwards to
 * the tokenized page — the token is the capability, and a wrong pair gets the
 * same generic message as an unknown order (no enumeration oracle). Rate
 * limited by IP.
 */
export default async function TrackPage({
  searchParams,
}: {
  searchParams: Promise<{ order_number?: string | string[]; token?: string | string[] }>;
}) {
  const sp = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const orderNumber = first(sp.order_number) ?? "";
  const token = first(sp.token) ?? "";
  const submitted = orderNumber.trim() !== "" || token.trim() !== "";

  let error: string | null = null;

  if (submitted) {
    const parsed = trackingLookupInput.safeParse({ order_number: orderNumber, token });
    if (!parsed.success) {
      error = "Enter your order number and the tracking code from your confirmation.";
    } else {
      const ip = clientIp(await headers());
      const limit = await checkRateLimit(`track:${ip}`, 60, 15 * 60 * 1000);
      if (!limit.allowed) {
        error = "Too many lookups. Please wait a few minutes and try again.";
      } else {
        const found = await getTrackedOrder(parsed.data.order_number, parsed.data.token);
        if (found) {
          redirect(`/order/${encodeURIComponent(found.order_number)}?t=${encodeURIComponent(parsed.data.token)}`);
        }
        error = "We couldn't find an order with those details. Check the number and code from your confirmation.";
      }
    }
  }

  return (
    <main>
      <h1 style={{ fontSize: "40px" }}>Track your order</h1>
      <p className="sold mt-1">
        Enter the order number and the tracking code from your confirmation. No account needed.
      </p>

      {error && (
        <div role="alert" className="box mt-3">
          <p className="sold mt-0">{error}</p>
        </div>
      )}

      <form method="get" className="box mt-3">
        <label className="block">
          Order number
          <input
            name="order_number"
            defaultValue={orderNumber}
            maxLength={40}
            required
            className="f"
            placeholder="WS10023"
          />
        </label>
        <label className="block">
          Tracking code
          <input name="token" defaultValue={token} maxLength={200} required className="f" />
        </label>
        <button type="submit" className="btn">
          Find my order
        </button>
      </form>

      <p className="sold mt-3">
        Lost your code? Call the shop and we&apos;ll help.{" "}
        <Link href="/shop" className="underline">
          Back to the shop
        </Link>
      </p>
    </main>
  );
}
