import Link from "next/link";
import { adminDb, requireAdminOrRedirect } from "@/lib/auth/requireAdmin";
import { formatLKR } from "@/lib/storefront/money";
import { getReservePolicy } from "@/lib/settings";
import type { Database } from "@/types/database";
import { ConfirmSubmit } from "../_components/ConfirmSubmit";
import { EmptyState, StatusBadge } from "../_components/ui";
import { activateShippingRule, deactivateShippingRule, saveReservePolicy } from "./actions";
import { ReservePolicyForm } from "./ReservePolicyForm";

export const metadata = { title: "Shipping — Waseem Sports Admin" };

type RuleRow = Database["public"]["Tables"]["shipping_rules"]["Row"];

function destinations(rule: RuleRow): string {
  const parts: string[] = [];
  if (rule.country_codes.length > 0) parts.push(rule.country_codes.join(", "));
  if (rule.regions.length > 0) parts.push(rule.regions.join(", "));
  return parts.length > 0 ? parts.join(" · ") : "—";
}

function eta(rule: RuleRow): string {
  const { est_days_min: min, est_days_max: max } = rule;
  if (min !== null && max !== null) return min === max ? `${min} day${min === 1 ? "" : "s"}` : `${min}–${max} days`;
  if (min !== null) return `from ${min} day${min === 1 ? "" : "s"}`;
  if (max !== null) return `up to ${max} days`;
  return "—";
}

export default async function ShippingPage() {
  await requireAdminOrRedirect();
  const db = adminDb();
  const [rulesRes, policy] = await Promise.all([
    db.from("shipping_rules").select("*").order("sort_order").order("fee"),
    getReservePolicy(),
  ]);
  const rules = rulesRes.data ?? [];
  const activeCount = rules.filter((rule) => rule.is_active).length;

  return (
    <main>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Shipping</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Delivery options and fees. Checkout offers only <strong>active</strong> rules, and the
            fee is read from this table every time an order is placed — it can never be sent from
            the browser. Nothing is seeded, so enter your real delivery rules before launch.
          </p>
        </div>
        <Link
          href="/admin/shipping/new"
          className="rounded-sm bg-gold-600 px-4 py-2 text-sm font-semibold text-bronze-ink"
        >
          New rule
        </Link>
      </div>

      {rules.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No delivery rules yet"
            hint="Add at least one active rule, otherwise checkout has no delivery option to offer."
            actionHref="/admin/shipping/new"
            actionLabel="New rule"
          />
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-md border border-line">
          <table className="w-full min-w-200 text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-card text-muted">
                <th className="px-4 py-2 font-semibold">Rule</th>
                <th className="px-4 py-2 font-semibold">Method</th>
                <th className="px-4 py-2 font-semibold">Fee</th>
                <th className="px-4 py-2 font-semibold">Free over</th>
                <th className="px-4 py-2 font-semibold">Delivery time</th>
                <th className="px-4 py-2 font-semibold">Destinations</th>
                <th className="px-4 py-2 font-semibold">Status</th>
                <th className="px-4 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-2 font-semibold">{rule.name}</td>
                  <td className="px-4 py-2 text-muted">{rule.method}</td>
                  <td className="px-4 py-2">
                    {Number(rule.fee) === 0 ? <StatusBadge tone="green">Free</StatusBadge> : formatLKR(rule.fee)}
                  </td>
                  <td className="px-4 py-2 text-muted">
                    {rule.free_over === null ? "—" : formatLKR(rule.free_over)}
                  </td>
                  <td className="px-4 py-2 text-muted">{eta(rule)}</td>
                  <td className="px-4 py-2 text-muted">{destinations(rule)}</td>
                  <td className="px-4 py-2">
                    <StatusBadge tone={rule.is_active ? "green" : "muted"}>
                      {rule.is_active ? "Active" : "Inactive"}
                    </StatusBadge>
                  </td>
                  <td className="px-4 py-2">
                    <span className="flex justify-end gap-2">
                      <Link
                        href={`/admin/shipping/${rule.id}`}
                        className="rounded-sm border border-line px-3 py-1.5 text-sm"
                      >
                        Edit
                      </Link>
                      {rule.is_active ? (
                        <ConfirmSubmit
                          action={deactivateShippingRule}
                          id={rule.id}
                          label="Deactivate"
                          confirmLabel="Confirm deactivate?"
                        />
                      ) : (
                        <ConfirmSubmit
                          action={activateShippingRule}
                          id={rule.id}
                          label="Activate"
                          confirmLabel="Confirm activate?"
                          tone="neutral"
                        />
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-sm text-muted">
        {rules.length} rule{rules.length === 1 ? "" : "s"} · {activeCount} active
      </p>

      <section className="mt-10 max-w-3xl">
        <h2 className="font-display text-2xl font-bold">Stock reservation</h2>
        <p className="mt-1 text-sm text-muted">
          When a Cash on Delivery order takes stock out of the shop&apos;s available count. This is
          enforced by the server when an order is placed — the customer&apos;s browser never decides
          it.
        </p>
        <div className="mt-4">
          <ReservePolicyForm action={saveReservePolicy} current={policy} />
        </div>
      </section>
    </main>
  );
}
