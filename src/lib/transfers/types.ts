/**
 * Phase 08 — transfer domain types + provider seam (MOCK ONLY).
 *
 * ┌──────────────────────────────────────────────────────────────┐
 * │ WHERE A REAL PROVIDER CONNECTS (when the owner chooses one): │
 * │ 1. Implement `PaymentProvider` below in a new file, e.g.     │
 * │    `src/lib/transfers/payhere.ts`, using the vendor's        │
 * │    official sandbox docs (cite doc URLs in the header).      │
 * │ 2. Register it in `providerFor()` inside                    │
 * │    `src/lib/transfers/service.ts` (env: PAYMENT_PROVIDER).   │
 * │ 3. Nothing else changes: validation, approval, idempotency,  │
 * │    state machine, verification and audit all stay the same.  │
 * │ Never scrape or automate a bank website — HTTPS API only.    │
 * └──────────────────────────────────────────────────────────────┘
 */

export const TRANSFER_STATUSES = [
  "draft",
  "pending_approval",
  "approved",
  "processing",
  "completed",
  "failed",
  "cancelled",
  "expired",
] as const;

export type TransferStatus = (typeof TRANSFER_STATUSES)[number];

/** Allowed transitions — the state machine. Anything else is rejected. */
export const TRANSITIONS: Record<TransferStatus, TransferStatus[]> = {
  draft: ["pending_approval", "cancelled", "expired"],
  pending_approval: ["approved", "cancelled", "expired"],
  approved: ["processing", "cancelled", "expired"],
  processing: ["completed", "failed", "cancelled", "expired"],
  completed: [],
  failed: [],
  cancelled: [],
  expired: [],
};

export function canTransition(from: TransferStatus, to: TransferStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export type TransferInput = {
  sender_method: string;
  provider: string;
  sender_account_ref: string;
  recipient_name: string;
  recipient_bank: string;
  recipient_account: string;
  recipient_branch?: string | null;
  recipient_contact?: string | null;
  amount: number;
  currency: string;
  reference?: string | null;
  description?: string | null;
  idempotency_key: string;
};

export type TransferQuote = {
  amount: number;
  currency: string;
  fee: number;
  total: number;
};

export type ProviderOutcome =
  | { kind: "completed"; provider_tx_id: string }
  | { kind: "processing"; provider_tx_id: string }
  | { kind: "failed"; code: MockFailureCode; message: string };

export type MockFailureCode =
  | "INSUFFICIENT_FUNDS"
  | "INVALID_ACCOUNT"
  | "BANK_UNAVAILABLE"
  | "TRANSFER_LIMIT";

export type TransferResult = {
  ok: boolean;
  provider_tx_id?: string;
  status: "completed" | "processing" | "failed";
  code?: MockFailureCode | "TIMEOUT" | "UNKNOWN";
  message?: string;
};

export type TransferStatusQuery = {
  provider_tx_id: string;
  status: "completed" | "processing" | "failed";
  code?: MockFailureCode | "TIMEOUT" | "UNKNOWN";
  message?: string;
};

/**
 * Provider abstraction. The app depends on this interface only —
 * never on `MockBankProvider` directly (except the registry).
 */
export interface PaymentProvider {
  readonly name: string;
  createTransfer(input: {
    transferId: string;
    amount: number;
    currency: string;
    recipient_name: string;
    recipient_bank: string;
    recipient_account: string;
    reference: string | null;
  }): Promise<TransferResult>;
  getTransferStatus(provider_tx_id: string): Promise<TransferStatusQuery>;
  cancelTransfer?(provider_tx_id: string): Promise<void>;
}

export type TransferRow = {
  id: string;
  idempotency_key: string;
  status: TransferStatus;
  sender_method: string;
  provider: string;
  sender_account_ref: string;
  recipient_name: string;
  recipient_bank: string;
  recipient_account: string;
  recipient_branch: string | null;
  recipient_contact: string | null;
  amount: number;
  currency: string;
  fee: number;
  total: number;
  reference: string | null;
  description: string | null;
  provider_tx_id: string | null;
  last_error: string | null;
  confirmed_at: string | null;
  completed_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TransferEventRow = {
  id: number;
  transfer_id: string;
  from_status: string | null;
  to_status: string;
  note: string | null;
  created_at: string;
};
