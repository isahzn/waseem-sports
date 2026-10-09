import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminOrRedirect } from "@/lib/auth/requireAdmin";
import { getTransfer, transferTimeline } from "@/lib/transfers/service";
import { FormError, StatusBadge } from "../../_components/ui";
import { TransferConfirm } from "../_components/TransferConfirm";

export const metadata = { title: "Transfer — Waseem Sports Admin" };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function tone(status: string): "green" | "gold" | "muted" | "red" {
  if (status === "completed") return "green";
  if (status === "processing" || status === "approved" || status === "pending_approval") return "gold";
  if (status === "failed" || status === "cancelled" || status === "expired") return "red";
  return "muted";
}

export default async function TransferDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminOrRedirect();
  const { id } = await params;
  const sp = await searchParams;
  const transfer = await getTransfer(id);
  if (!transfer) notFound();
  const timeline = await transferTimeline(id);
  const error = first(sp.error);
  const ok = first(sp.ok);
  const needsApproval = transfer.status === "pending_approval";

  return (
    <main>
      <p className="text-sm text-muted">
        <Link href="/admin/transfers" className="underline">← All transfers</Link>
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-bold">Transfer</h1>
        <StatusBadge tone={tone(transfer.status)}>{transfer.status}</StatusBadge>
      </div>
      <FormError message={error} />
      {ok && <p role="status" className="mt-4 rounded-sm border border-pine-800 bg-pine-900 px-3 py-2 text-sm">{ok}</p>}

      <section className="mt-6 rounded-md border border-line bg-card p-4" aria-label="Confirmation">
        <h2 className="font-display text-xl font-bold">Confirmation</h2>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div><dt className="text-muted">Transfer amount</dt><dd className="font-semibold">{transfer.currency} {Number(transfer.amount).toLocaleString()}</dd></div>
          <div><dt className="text-muted">Fee (server-calculated)</dt><dd className="font-semibold">{transfer.currency} {Number(transfer.fee).toLocaleString()}</dd></div>
          <div><dt className="text-muted">Total debited</dt><dd className="font-semibold">{transfer.currency} {Number(transfer.total).toLocaleString()}</dd></div>
          <div><dt className="text-muted">Recipient</dt><dd className="font-semibold">{transfer.recipient_name}</dd></div>
          <div><dt className="text-muted">Bank</dt><dd>{transfer.recipient_bank}</dd></div>
          <div><dt className="text-muted">Account</dt><dd>{transfer.recipient_account}</dd></div>
          <div><dt className="text-muted">Reference</dt><dd>{transfer.reference ?? "—"}</dd></div>
          <div><dt className="text-muted">Provider transaction ID</dt><dd className="text-xs">{transfer.provider_tx_id ?? "—"}</dd></div>
        </dl>
        {transfer.last_error && (
          <p role="alert" className="mt-3 rounded-sm border border-red-900 bg-red-950 px-3 py-2 text-sm text-red-200">
            {transfer.last_error}
          </p>
        )}
        {needsApproval ? (
          <div className="mt-4 flex flex-col gap-3">
            <TransferConfirm
              id={transfer.id}
              idempotencyKey={transfer.idempotency_key}
              amountLabel={`${transfer.currency} ${Number(transfer.total).toLocaleString()}`}
              recipient={`${transfer.recipient_name} (${transfer.recipient_bank})`}
              kind="approve"
            />
            <span className="text-xs text-muted">Nothing moves until you confirm twice. Confirming twice still creates one transfer.</span>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted">
            {transfer.status === "completed" && "Completed — the provider reported success. The provider transaction ID above is your reference."}
            {transfer.status === "processing" && "Submitted — poll the status endpoint or reload to verify settlement."}
            {transfer.status === "failed" && "Failed — no money moved. See the reason above."}
            {(transfer.status === "cancelled" || transfer.status === "expired") && "Closed without execution."}
            {transfer.status === "approved" && "Approved — execution in progress."}
          </p>
        )}
        {(transfer.status === "pending_approval" || transfer.status === "draft" || transfer.status === "approved" || transfer.status === "processing") && (
          <div className="mt-3">
            <TransferConfirm
              id={transfer.id}
              idempotencyKey={transfer.idempotency_key}
              amountLabel={`${transfer.currency} ${Number(transfer.total).toLocaleString()}`}
              recipient={`${transfer.recipient_name} (${transfer.recipient_bank})`}
              kind="reject"
            />
          </div>
        )}
      </section>

      <section className="mt-6 rounded-md border border-line bg-card p-4" aria-label="Timeline">
        <h2 className="font-display text-xl font-bold">Timeline</h2>
        {timeline.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No events yet.</p>
        ) : (
          <ol className="mt-3 flex flex-col gap-2 text-sm">
            {timeline.map((e) => (
              <li key={e.id} className="flex flex-wrap gap-2">
                <span className="text-muted">{new Date(e.created_at).toLocaleTimeString()}</span>
                <span>
                  {e.from_status ? `${e.from_status} → ` : ""}<strong>{e.to_status}</strong>
                  {e.note ? <span className="text-muted"> — {e.note}</span> : null}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
