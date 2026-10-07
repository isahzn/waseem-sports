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

const inputClass = "rounded-sm border border-line bg-surface px-3 py-2";

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
    <main className="mx-auto flex w-full max-w-lg flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Track your order</h1>
        <p className="mt-1 text-sm text-muted">
          Enter the order number and the tracking code from your confirmation. No account needed.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-sm border border-red-900 bg-red-950 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      <form method="get" className="flex flex-col gap-3 rounded-md border border-line bg-card p-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">Order number</span>
          <input name="order_number" defaultValue={orderNumber} maxLength={40} required className={inputClass} placeholder="WS10023" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">Tracking code</span>
          <input name="token" defaultValue={token} maxLength={200} required className={inputClass} />
        </label>
        <button type="submit" className="rounded-sm bg-gold-600 px-4 py-2 font-semibold text-bronze-ink">
          Find my order
        </button>
      </form>

      <p className="text-sm text-muted">
        Lost your code? Call the shop and we&apos;ll help.{" "}
        <Link href="/shop" className="underline">
          Back to the shop
        </Link>
      </p>
    </main>
  );
}
