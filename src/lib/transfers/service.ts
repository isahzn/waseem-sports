import "server-only";
import { adminDb } from "@/lib/auth/requireAdmin";
import { writeAudit } from "@/lib/catalog/audit";
import { checkRateLimit, clientIp } from "@/lib/security/ratelimit";
import { logger } from "@/lib/security/logger";
import { quoteTransfer } from "./fees";
import { MockBankProvider } from "./mockBank";
import { emptyToNull, transferConfirmInput, transferFormInput } from "./schemas";
import { canTransition, type PaymentProvider, type TransferRow } from "./types";

/** Provider registry. Only "mock" exists — a real vendor plugs in here. */
export function providerFor(name: string): PaymentProvider {
  if (name === "mock") return new MockBankProvider();
  throw new Error(`Unknown payment provider: ${name}`);
}

function providerName(): string {
  const raw = (process.env.PAYMENT_PROVIDER ?? "mock").trim().toLowerCase();
  return raw === "" ? "mock" : raw;
}

function mockEnabled(): boolean {
  return (process.env.MOCK_BANK_ENABLED ?? "true").trim().toLowerCase() !== "false";
}

type ServiceError = { status: number; message: string };

async function recordEvent(
  transferId: string,
  from: string | null,
  to: string,
  note?: string,
): Promise<void> {
  try {
    const db = adminDb();
    await db.from("transfer_events").insert({ transfer_id: transferId, from_status: from, to_status: to, note: note ?? null });
  } catch (err) {
    logger.error("transfer event failed", { error: err instanceof Error ? err.message : String(err) });
  }
}

/**
 * Update columns without a state transition (e.g. recording the provider
 * tx id while already PROCESSING). The state machine stays the only path
 * that changes `status`; this never touches it.
 */
async function touch(id: string, patch: Partial<TransferRow>, note?: string): Promise<void> {
  const db = adminDb();
  await db.from("money_transfers").update(patch).eq("id", id);
  if (note) await recordEvent(id, "processing", "processing", note);
}

async function setStatus(
  row: TransferRow,
  to: TransferRow["status"],
  patch: Partial<TransferRow> = {},
  note?: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!canTransition(row.status, to)) {
    return { ok: false, error: `Cannot move transfer from ${row.status} to ${to}.` };
  }
  const db = adminDb();
  const { data, error } = await db
    .from("money_transfers")
    .update({ status: to, ...patch })
    .eq("id", row.id)
    .eq("status", row.status)
    .select("*")
    .maybeSingle();
  if (error || !data) {
    logger.error("transfer status update failed", { id: row.id });
    return { ok: false, error: "Transfer changed while you were confirming — reload and try again." };
  }
  await recordEvent(row.id, row.status, to, note);
  return { ok: true };
}

async function limitOrThrow(headers: Headers, scope: string, limit: number): Promise<ServiceError | null> {
  const key = `transfers:${scope}:${clientIp(headers)}`;
  const res = await checkRateLimit(key, limit);
  if (!res.allowed) return { status: 429, message: "Too many transfer attempts — wait a few minutes and try again." };
  return null;
}

export async function validateQuote(input: unknown): Promise<{ ok: boolean; quote?: { amount: number; currency: string; fee: number; total: number }; errors?: string[] }> {
  const parsed = transferFormInput.safeParse(input);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map((i) => i.message) };
  const { fee, total } = quoteTransfer(parsed.data.amount, parsed.data.currency);
  return { ok: true, quote: { amount: parsed.data.amount, currency: parsed.data.currency, fee, total } };
}

/**
 * Create a DRAFT + PENDING_APPROVAL transfer. Idempotent: the same
 * idempotency_key returns the existing row — never a second transfer.
 */
export async function createTransfer(
  input: unknown,
  opts: { headers: Headers; actor: string | null },
): Promise<{ row?: TransferRow; error?: ServiceError }> {
  const limited = await limitOrThrow(opts.headers, "create", 30);
  if (limited) return { error: limited };

  const parsed = transferFormInput.safeParse(input);
  if (!parsed.success) {
    return { error: { status: 400, message: parsed.error.issues[0]?.message ?? "Check the transfer details." } };
  }
  const v = parsed.data;
  const db = adminDb();

  // Idempotency first: replay returns the original row.
  const { data: existing } = await db.from("money_transfers").select("*").eq("idempotency_key", v.idempotency_key).maybeSingle();
  if (existing) return { row: existing as TransferRow };

  const { fee, total } = quoteTransfer(v.amount, v.currency);
  const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const { data, error } = await db
    .from("money_transfers")
    .insert({
      idempotency_key: v.idempotency_key,
      status: "pending_approval",
      sender_method: v.sender_method,
      provider: providerName(),
      sender_account_ref: v.sender_account_ref,
      recipient_name: v.recipient_name,
      recipient_bank: v.recipient_bank,
      recipient_account: v.recipient_account,
      recipient_branch: emptyToNull(v.recipient_branch),
      recipient_contact: emptyToNull(v.recipient_contact),
      amount: v.amount,
      currency: v.currency,
      fee,
      total,
      reference: emptyToNull(v.reference),
      description: emptyToNull(v.description),
      expires_at: expires,
    })
    .select("*")
    .single();
  if (error || !data) {
    // A concurrent insert with the same key wins the race — return the winner.
    if (error?.code === "23505") {
      const { data: winner } = await db.from("money_transfers").select("*").eq("idempotency_key", v.idempotency_key).maybeSingle();
      if (winner) return { row: winner as TransferRow };
    }
    logger.error("transfer create failed", { error: error?.message });
    return { error: { status: 500, message: "Could not create the transfer. Try again." } };
  }
  const row = data as TransferRow;
  await recordEvent(row.id, null, "draft", "Transfer drafted.");
  await recordEvent(row.id, "draft", "pending_approval", "Awaiting explicit approval.");
  await writeAudit({ actor: opts.actor, action: "transfer.create", entity: "money_transfers", entityId: row.id });
  return { row };
}

/**
 * Explicit approval + execution. Requires confirm:true AND the matching
 * idempotency key — an AI or a double-click can never bypass this.
 * Double-confirm returns the SAME row (compare-and-swap on status).
 */
export async function confirmTransfer(
  input: unknown,
  opts: { headers: Headers; actor: string | null },
): Promise<{ row?: TransferRow; error?: ServiceError }> {
  const limited = await limitOrThrow(opts.headers, "confirm", 30);
  if (limited) return { error: limited };

  const parsed = transferConfirmInput.safeParse(input);
  if (!parsed.success) {
    return { error: { status: 400, message: "Explicit confirmation is required." } };
  }
  if (!mockEnabled()) {
    return { error: { status: 503, message: "Sandbox transfers are disabled (MOCK_BANK_ENABLED=false)." } };
  }
  const db = adminDb();
  const { data: found } = await db.from("money_transfers").select("*").eq("id", parsed.data.id).maybeSingle();
  if (!found) return { error: { status: 404, message: "Transfer not found." } };
  const row = found as TransferRow;
  if (row.idempotency_key !== parsed.data.idempotency_key) {
    return { error: { status: 409, message: "Confirmation reference does not match this transfer." } };
  }
  // Double-confirm / replay: a terminal row is returned as-is — never re-run.
  if (["completed", "failed", "cancelled", "expired"].includes(row.status)) return { row };
  // Expired approvals cannot execute.
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    await setStatus(row, "expired", {}, "Approval window expired.");
    const { data: updated } = await db.from("money_transfers").select("*").eq("id", row.id).maybeSingle();
    return { row: (updated ?? row) as TransferRow };
  }
  // Only pending_approval executes. Anything else (e.g. already processing)
  // is returned unchanged so a second click creates nothing.
  if (row.status !== "pending_approval") return { row };

  const okApproved = await setStatus(row, "approved", { confirmed_at: new Date().toISOString() }, "Approval received.");
  if (!okApproved.ok) {
    const { data: current } = await db.from("money_transfers").select("*").eq("id", row.id).maybeSingle();
    return { row: (current ?? row) as TransferRow };
  }
  const approved = ((await db.from("money_transfers").select("*").eq("id", row.id).maybeSingle()).data ?? row) as TransferRow;
  const moved = await setStatus(approved, "processing", {}, "Submitted to provider.");
  if (!moved.ok) {
    const { data: current } = await db.from("money_transfers").select("*").eq("id", row.id).maybeSingle();
    return { row: (current ?? row) as TransferRow };
  }

  const current = ((await db.from("money_transfers").select("*").eq("id", row.id).maybeSingle()).data ?? approved) as TransferRow;
  const provider = providerFor(current.provider);
  let result;
  try {
    result = await provider.createTransfer({
      transferId: current.id,
      amount: current.amount,
      currency: current.currency,
      recipient_name: current.recipient_name,
      recipient_bank: current.recipient_bank,
      recipient_account: current.recipient_account,
      reference: current.reference,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Provider error.";
    logger.error("transfer provider threw", { id: current.id, error: message });
    await touch(current.id, { last_error: message }, "Provider submission issue — verifying.");
    // Verify: the money may still have moved. Never claim success/failure yet.
    try {
      await verifyTransfer(current.id, opts.actor);
    } catch {
      // Verification failure is recorded inside verifyTransfer.
    }
    const { data: after } = await db.from("money_transfers").select("*").eq("id", row.id).maybeSingle();
    return { row: (after ?? current) as TransferRow };
  }

  if (result.status === "completed") {
    await setStatus(current, "completed", { provider_tx_id: result.provider_tx_id, completed_at: new Date().toISOString() }, "Provider confirmed completion.");
  } else if (result.status === "processing") {
    // Already PROCESSING (moved before the provider call so a replay can
    // never re-execute): record the tx id without a state transition.
    await touch(current.id, { provider_tx_id: result.provider_tx_id }, "Provider is processing — verify to settle.");
  } else {
    const reason = result.code ? `${result.code}: ${result.message ?? "Declined."}` : (result.message ?? "Declined.");
    await setStatus(current, "failed", { provider_tx_id: result.provider_tx_id, last_error: reason }, `Provider declined: ${result.code}.`);
  }
  await writeAudit({ actor: opts.actor, action: "transfer.confirm", entity: "money_transfers", entityId: row.id });
  const { data: after } = await db.from("money_transfers").select("*").eq("id", row.id).maybeSingle();
  return { row: (after ?? current) as TransferRow };
}

/** Re-query the provider and settle PROCESSING transfers. Never invent a result. */
export async function verifyTransfer(id: string, actor: string | null): Promise<{ row?: TransferRow; error?: ServiceError }> {
  const db = adminDb();
  const { data: found } = await db.from("money_transfers").select("*").eq("id", id).maybeSingle();
  if (!found) return { error: { status: 404, message: "Transfer not found." } };
  const row = found as TransferRow;
  if (row.status !== "processing" || !row.provider_tx_id) return { row };
  const provider = providerFor(row.provider);
  let status;
  try {
    status = await provider.getTransferStatus(row.provider_tx_id);
  } catch (err) {
    logger.error("transfer verify threw", { id, error: err instanceof Error ? err.message : String(err) });
    return { row };
  }
  if (status.status === "completed") {
    await setStatus(row, "completed", { completed_at: new Date().toISOString() }, "Verification confirmed completion.");
  } else if (status.status === "failed") {
    await setStatus(row, "failed", { last_error: status.message ?? status.code }, `Verification reports failure: ${status.code}.`);
  }
  await writeAudit({ actor, action: "transfer.verify", entity: "money_transfers", entityId: id });
  const { data: after } = await db.from("money_transfers").select("*").eq("id", id).maybeSingle();
  return { row: (after ?? row) as TransferRow };
}

export async function cancelTransfer(id: string, actor: string | null): Promise<{ row?: TransferRow; error?: ServiceError }> {
  const db = adminDb();
  const { data: found } = await db.from("money_transfers").select("*").eq("id", id).maybeSingle();
  if (!found) return { error: { status: 404, message: "Transfer not found." } };
  const row = found as TransferRow;
  if (["completed", "failed", "cancelled", "expired"].includes(row.status)) return { row };
  if (row.provider_tx_id) {
    try {
      await providerFor(row.provider).cancelTransfer?.(row.provider_tx_id);
    } catch (err) {
      logger.error("transfer cancel provider threw", { id, error: err instanceof Error ? err.message : String(err) });
    }
  }
  const res = await setStatus(row, "cancelled", {}, "Cancelled before completion.");
  if (!res.ok) return { error: { status: 409, message: res.error ?? "Cannot cancel now." } };
  await writeAudit({ actor, action: "transfer.cancel", entity: "money_transfers", entityId: id });
  const { data: after } = await db.from("money_transfers").select("*").eq("id", id).maybeSingle();
  return { row: (after ?? row) as TransferRow };
}

export async function getTransfer(id: string): Promise<TransferRow | null> {
  const db = adminDb();
  const { data } = await db.from("money_transfers").select("*").eq("id", id).maybeSingle();
  return (data ?? null) as TransferRow | null;
}

export async function listTransfers(limit = 50): Promise<TransferRow[]> {
  const db = adminDb();
  const { data } = await db.from("money_transfers").select("*").order("created_at", { ascending: false }).limit(Math.min(Math.max(limit, 1), 200));
  return ((data ?? []) as TransferRow[]);
}

export async function transferTimeline(id: string) {
  const db = adminDb();
  const { data } = await db.from("transfer_events").select("*").eq("transfer_id", id).order("created_at", { ascending: true });
  return (data ?? []) as { id: number; transfer_id: string; from_status: string | null; to_status: string; note: string | null; created_at: string }[];
}
