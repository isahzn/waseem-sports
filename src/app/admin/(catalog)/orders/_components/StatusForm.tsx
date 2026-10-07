"use client";

import { useActionState } from "react";
import { Field, FormError } from "../../_components/ui";
import { STATUS_LABELS, nextStatuses, type OrderStatus } from "@/lib/orders/status";
import { changeOrderStatus } from "../actions";

/**
 * Status change for one order. Only the transitions the server allows are
 * offered; the server re-validates before anything is written.
 */
export function StatusForm({ orderId, status }: { orderId: string; status: OrderStatus }) {
  const options = nextStatuses(status);
  const [state, formAction, pending] = useActionState(changeOrderStatus, {});
  const fe = state.fieldErrors ?? {};

  if (options.length === 0) {
    return (
      <div className="rounded-md border border-line bg-card p-4">
        <p className="font-semibold">Status</p>
        <p className="mt-1 text-sm text-muted">
          This order is {STATUS_LABELS[status].toLowerCase()} — there are no further status changes.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-md border border-line bg-card p-4">
      <div>
        <p className="font-semibold">Update status</p>
        <p className="mt-1 text-sm text-muted">
          Shipped takes the stock out of inventory; cancelling returns it. The customer is queued a
          WhatsApp update for the new status.
        </p>
      </div>
      <input type="hidden" name="order_id" value={orderId} />
      <FormError message={state.error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Move to" errors={fe.to_status}>
          <select
            name="to_status"
            required
            defaultValue={options[0]}
            className="rounded-sm border border-line bg-surface px-3 py-2"
          >
            {options.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Note (internal, kept in the timeline)" errors={fe.note}>
          <input
            type="text"
            name="note"
            maxLength={500}
            placeholder="E.g. Courier collected, handover to Nimal"
            className="rounded-sm border border-line bg-surface px-3 py-2"
          />
        </Field>
      </div>
      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-sm bg-gold-600 px-5 py-2 text-sm font-semibold text-bronze-ink disabled:opacity-60"
        >
          {pending ? "Updating…" : "Update status"}
        </button>
      </div>
    </form>
  );
}
