import Link from "next/link";
import { requireAdminOrRedirect } from "@/lib/auth/requireAdmin";
import { ShippingForm } from "../ShippingForm";
import { createShippingRule } from "../actions";

export const metadata = { title: "New delivery rule — Waseem Sports Admin" };

export default async function NewShippingRulePage() {
  await requireAdminOrRedirect();

  return (
    <main>
      <Link href="/admin/shipping" className="text-sm text-muted hover:text-ink">
        ← Back to shipping
      </Link>
      <h1 className="mt-2 font-display text-3xl font-bold">New delivery rule</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        A rule applies to the destinations listed below. If several active rules share the same
        method, checkout uses the first by sort order.
      </p>
      <div className="mt-6">
        <ShippingForm action={createShippingRule} submitLabel="Create rule" />
      </div>
    </main>
  );
}
