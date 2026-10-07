"use client";

import { useActionState } from "react";
import { FormError } from "../../_components/ui";
import { saveOrderNotes } from "../actions";

/** Internal note on an order. Staff-only; never sent to the customer. */
export function NotesForm({ orderId, notes }: { orderId: string; notes: string }) {
  const [state, formAction, pending] = useActionState(saveOrderNotes, {});

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-md border border-line bg-card p-4">
      <div>
        <p className="font-semibold">Internal note</p>
        <p className="mt-1 text-sm text-muted">
          Delivery quirks, customer requests, who spoke to whom. Not visible to the customer.
        </p>
      </div>
      <input type="hidden" name="order_id" value={orderId} />
      <FormError message={state.error} />
      <label className="flex flex-col gap-1 text-sm">
        <span className="sr-only">Internal note</span>
        <textarea
          name="notes"
          rows={3}
          maxLength={1000}
          defaultValue={notes}
          placeholder="Anything the next person picking this up should know…"
          className="rounded-sm border border-line bg-surface px-3 py-2"
        />
      </label>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-sm border border-line px-4 py-2 text-sm font-semibold disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save note"}
        </button>
        {state.ok && <span className="text-sm text-muted">Saved.</span>}
      </div>
    </form>
  );
}
