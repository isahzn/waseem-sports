import "server-only";
import type { PaymentProvider, TransferResult, TransferStatusQuery } from "./types";

/**
 * MockBankProvider — sandbox only. Simulates a bank so every transfer state
 * can be tested without real money, real accounts or real credentials.
 *
 * Sandbox balance defaults to LKR 500,000 (env MOCK_BANK_BALANCE) and only
 * decreases when a mock transfer COMPLETES. Deterministic triggers:
 * - account ending "0000"            -> INVALID_ACCOUNT
 * - amount > balance                 -> INSUFFICIENT_FUNDS
 * - amount > MOCK_BANK_MAX_AMOUNT    -> TRANSFER_LIMIT
 * - reference contains "DOWN"        -> BANK_UNAVAILABLE (throws)
 * - reference contains "TIMEOUT"     -> timeout (throws, caller treats as unknown)
 * - reference contains "HOLD"        -> stays PROCESSING (verify later)
 * Anything else completes immediately.
 */

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw === undefined || raw === "" ? Number.NaN : Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

let ledgerBalance = envNumber("MOCK_BANK_BALANCE", 500000);
const processing = new Map<string, { amount: number; currency: string }>();

export function mockBalance(): number {
  return Math.round(ledgerBalance * 100) / 100;
}

/** Test-only reset so harnesses start from a known balance. */
export function resetMockBalance(): void {
  ledgerBalance = envNumber("MOCK_BANK_BALANCE", 500000);
  processing.clear();
}

function txId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `${prefix}-${Date.now().toString(36).toUpperCase()}${rand}`;
}

export class MockBankProvider implements PaymentProvider {
  readonly name = "mock";

  async createTransfer(input: {
    transferId: string;
    amount: number;
    currency: string;
    recipient_name: string;
    recipient_bank: string;
    recipient_account: string;
    reference: string | null;
  }): Promise<TransferResult> {
    const ref = (input.reference ?? "").toUpperCase();
    const max = envNumber("MOCK_BANK_MAX_AMOUNT", 1000000);

    if (input.amount > max) {
      return { ok: false, status: "failed", code: "TRANSFER_LIMIT", message: "Amount is above the sandbox limit." };
    }
    if (/0{4}$/.test(input.recipient_account.replace(/[\- ]/g, ""))) {
      return { ok: false, status: "failed", code: "INVALID_ACCOUNT", message: "Recipient account failed sandbox validation." };
    }
    if (input.amount > ledgerBalance) {
      return { ok: false, status: "failed", code: "INSUFFICIENT_FUNDS", message: "Sandbox balance is too low for this transfer." };
    }
    if (ref.includes("DOWN")) throw new Error("BANK_UNAVAILABLE: mock bank is offline");
    if (ref.includes("TIMEOUT")) {
      const err = new Error("mock bank timeout");
      err.name = "TimeoutError";
      throw err;
    }
    if (ref.includes("HOLD")) {
      const id = txId("MOCK");
      processing.set(id, { amount: input.amount, currency: input.currency });
      return { ok: true, provider_tx_id: id, status: "processing" };
    }
    const id = txId("MOCK");
    ledgerBalance = Math.round((ledgerBalance - input.amount) * 100) / 100;
    return { ok: true, provider_tx_id: id, status: "completed" };
  }

  async getTransferStatus(provider_tx_id: string): Promise<TransferStatusQuery> {
    const held = processing.get(provider_tx_id);
    if (!held) return { provider_tx_id, status: "completed" };
    // Second poll settles it (PROCESSING -> COMPLETED) unless funds ran out.
    if (held.amount > ledgerBalance) {
      processing.delete(provider_tx_id);
      return { provider_tx_id, status: "failed", code: "INSUFFICIENT_FUNDS", message: "Sandbox balance is too low." };
    }
    processing.delete(provider_tx_id);
    ledgerBalance = Math.round((ledgerBalance - held.amount) * 100) / 100;
    return { provider_tx_id, status: "completed" };
  }

  async cancelTransfer(provider_tx_id: string): Promise<void> {
    processing.delete(provider_tx_id);
  }
}
