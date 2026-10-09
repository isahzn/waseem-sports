"use client";

import { useState } from "react";
import { cancelTransferAction, confirmTransferAction } from "../actions";

/**
 * Two-step approve/reject for money movement (Fixes §3.7): the first tap
 * shows exactly what will happen (amount, recipient); only the second tap
 * moves or cancels money. No window.confirm — accessible and touch-friendly.
 */
export function TransferConfirm({
  id,
  idempotencyKey,
  amountLabel,
  recipient,
  kind,
}: {
  id: string;
  idempotencyKey: string;
  amountLabel: string;
  recipient: string;
  kind: "approve" | "reject";
}) {
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return kind === "approve" ? (
      <button
        type="button"
        onClick={() => setArmed(true)}
        className="rounded-sm bg-gold-600 px-5 py-2.5 text-sm font-bold text-bronze-ink"
      >
        Approve transfer
      </button>
    ) : (
      <button
        type="button"
        onClick={() => setArmed(true)}
        className="rounded-sm border border-line px-3 py-1.5 text-sm"
      >
        Reject transfer
      </button>
    );
  }

  return (
    <span className="inline-flex flex-col gap-2 rounded-md border border-gold-600 p-3">
      <span className="text-sm" role="alert">
        {kind === "approve" ? (
          <>
            Approve <b>{amountLabel}</b> to <b>{recipient}</b>? This starts real
            money movement through the configured provider.
          </>
        ) : (
          <>
            Reject <b>{amountLabel}</b> to <b>{recipient}</b>? The transfer
            closes without any money moving.
          </>
        )}
      </span>
      {kind === "approve" ? (
        <form action={confirmTransferAction} className="inline-flex items-center gap-2">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="idempotency_key" value={idempotencyKey} />
          <input type="hidden" name="confirm" value="true" />
          <button type="submit" className="rounded-sm bg-gold-600 px-5 py-2 text-sm font-bold text-bronze-ink">
            Yes, approve {amountLabel}
          </button>
          <button
            type="button"
            onClick={() => setArmed(false)}
            className="rounded-sm border border-line px-3 py-2 text-sm"
          >
            Back
          </button>
        </form>
      ) : (
        <form action={cancelTransferAction} className="inline-flex items-center gap-2">
          <input type="hidden" name="id" value={id} />
          <button type="submit" className="rounded-sm bg-red-800 px-4 py-2 text-sm font-semibold text-red-50">
            Yes, reject it
          </button>
          <button
            type="button"
            onClick={() => setArmed(false)}
            className="rounded-sm border border-line px-3 py-2 text-sm"
          >
            Back
          </button>
        </form>
      )}
    </span>
  );
}
