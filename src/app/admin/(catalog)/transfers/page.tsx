import Link from "next/link";
import { randomUUID } from "node:crypto";
import { requireAdminOrRedirect } from "@/lib/auth/requireAdmin";
import { listTransfers } from "@/lib/transfers/service";
import { EmptyState, Field, FormError, StatusBadge } from "../_components/ui";
import { createTransferAction } from "./actions";

export const metadata = { title: "Transfers — Waseem Sports Admin" };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function tone(status: string): "green" | "gold" | "muted" | "red" {
  if (status === "completed") return "green";
  if (status === "processing" || status === "approved" || status === "pending_approval") return "gold";
  if (status === "failed" || status === "cancelled" || status === "expired") return "red";
  return "muted";
}

export default async function TransfersAdmin({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminOrRedirect();
  const sp = await searchParams;
  const error = first(sp.error);
  const transfers = await listTransfers(100);
  const idempotencyKey = randomUUID();

  return (
    <main>
      <h1 className="font-display text-3xl font-bold">Bank transfers</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        A transfer is created below as a request, then explicitly confirmed on its own screen before it executes.
        Execution only happens through the configured payment provider — until a provider is connected and verified,
        no funds leave the shop.
      </p>
      <FormError message={error} />

      <h2 className="mt-8 font-display text-xl font-bold">New transfer</h2>
      <form action={createTransferAction} className="mt-3 grid gap-3 rounded-md border border-line bg-card p-4 sm:grid-cols-2">
        <input type="hidden" name="idempotency_key" value={idempotencyKey} />
        <Field label="Payment method">
          <select name="sender_method" defaultValue="sandbox_balance" className="rounded-sm border border-line bg-surface px-3 py-2">
            <option value="sandbox_balance">Balance</option>
            <option value="sandbox_card">Card</option>
          </select>
        </Field>
        <Field label="Source account" hint="Identifier for the account funding this transfer. Never enter a password here.">
          <input name="sender_account_ref" required maxLength={80} defaultValue="main-account" className="rounded-sm border border-line bg-surface px-3 py-2" />
        </Field>
        <Field label="Recipient full name">
          <input name="recipient_name" required maxLength={120} placeholder="Ahmed" className="rounded-sm border border-line bg-surface px-3 py-2" />
        </Field>
        <Field label="Recipient bank">
          <input name="recipient_bank" required maxLength={120} placeholder="Commercial Bank" className="rounded-sm border border-line bg-surface px-3 py-2" />
        </Field>
        <Field label="Recipient account number">
          <input name="recipient_account" required maxLength={24} placeholder="1234567890" className="rounded-sm border border-line bg-surface px-3 py-2" />
        </Field>
        <Field label="Branch (optional)">
          <input name="recipient_branch" maxLength={120} className="rounded-sm border border-line bg-surface px-3 py-2" />
        </Field>
        <Field label="Phone / email (optional)">
          <input name="recipient_contact" maxLength={120} className="rounded-sm border border-line bg-surface px-3 py-2" />
        </Field>
        <Field label="Reference (optional)" hint="Optional note stored with the transfer and sent to the provider.">
          <input name="reference" maxLength={80} className="rounded-sm border border-line bg-surface px-3 py-2" />
        </Field>
        <Field label="Amount">
          <input name="amount" required inputMode="decimal" placeholder="25000" className="rounded-sm border border-line bg-surface px-3 py-2" />
        </Field>
        <Field label="Currency">
          <select name="currency" defaultValue="LKR" className="rounded-sm border border-line bg-surface px-3 py-2">
            <option value="LKR">LKR</option>
            <option value="USD">USD</option>
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Description (optional)">
            <input name="description" maxLength={500} className="rounded-sm border border-line bg-surface px-3 py-2" />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <button type="submit" className="rounded-sm bg-gold-600 px-4 py-2 text-sm font-semibold text-bronze-ink">
            Review transfer — nothing moves yet
          </button>
        </div>
      </form>

      <h2 className="mt-10 font-display text-xl font-bold">Transaction history</h2>
      {transfers.length === 0 ? (
        <div className="mt-3">
          <EmptyState title="No transfers yet" hint="Create one above — it appears here with its verified status and provider reference." />
        </div>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-md border border-line">
          <table className="w-full min-w-180 text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-card text-muted">
                <th className="px-4 py-2 font-semibold">Date</th>
                <th className="px-4 py-2 font-semibold">Recipient</th>
                <th className="px-4 py-2 text-right font-semibold">Amount</th>
                <th className="px-4 py-2 font-semibold">Status</th>
                <th className="px-4 py-2 font-semibold">Provider tx</th>
                <th className="px-4 py-2 font-semibold">Reference</th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((t) => (
                <tr key={t.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-2 text-muted">{new Date(t.created_at).toLocaleString()}</td>
                  <td className="px-4 py-2">
                    <Link href={`/admin/transfers/${t.id}`} className="font-semibold underline">
                      {t.recipient_name}
                    </Link>
                    <span className="block text-xs text-muted">{t.recipient_bank} · {t.recipient_account}</span>
                  </td>
                  <td className="px-4 py-2 text-right font-semibold">
                    {t.currency} {Number(t.amount).toLocaleString()}
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge tone={tone(t.status)}>{t.status}</StatusBadge>
                  </td>
                  <td className="px-4 py-2 text-xs text-muted">{t.provider_tx_id ?? "—"}</td>
                  <td className="px-4 py-2 text-xs text-muted">{t.reference ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
