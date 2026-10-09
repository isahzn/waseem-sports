"use client";

import { useActionState, useState } from "react";
import { adjustStock } from "./actions";

/**
 * Inline +/− stock stepper (Fixes §3.5): the owner taps −/+ and sees the new
 * on-hand quantity *before* saving ("12 → 15"), then Save posts the delta
 * through the same audited `admin_adjust_stock` path as the full form.
 */
export function InlineAdjust({ variantId, onHand }: { variantId: string; onHand: number }) {
  const [delta, setDelta] = useState(0);
  const [state, formAction, pending] = useActionState(adjustStock, {});
  const next = onHand + delta;

  return (
    <span className="inline-flex flex-col gap-1">
      <span className="inline-flex items-center gap-1">
        <button
          type="button"
          aria-label="One less in stock"
          onClick={() => setDelta((d) => d - 1)}
          className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-sm border border-line px-2 text-sm"
        >
          −
        </button>
        <span aria-live="polite" className="min-w-16 text-center text-sm font-semibold">
          {delta === 0 ? onHand : `${onHand} → ${next}`}
        </span>
        <button
          type="button"
          aria-label="One more in stock"
          onClick={() => setDelta((d) => d + 1)}
          className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-sm border border-line px-2 text-sm"
        >
          +
        </button>
      </span>
      {delta !== 0 && (
        <form action={formAction} className="inline-flex items-center gap-1">
          <input type="hidden" name="variant_id" value={variantId} />
          <input type="hidden" name="delta" value={delta} />
          <input type="hidden" name="note" value="Inline quick adjust from the inventory list." />
          <button
            type="submit"
            disabled={pending || next < 0}
            title={next < 0 ? "Stock cannot go below zero." : `Save ${next} on hand`}
            className="rounded-sm bg-gold-600 px-3 py-1 text-xs font-semibold text-bronze-ink disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => setDelta(0)}
            className="rounded-sm border border-line px-2 py-1 text-xs"
          >
            Cancel
          </button>
        </form>
      )}
      {state.error && (
        <span role="alert" className="text-xs font-semibold text-red-300">
          {state.error}
        </span>
      )}
    </span>
  );
}
