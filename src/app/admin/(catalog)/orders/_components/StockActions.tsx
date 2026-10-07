"use client";

import { useActionState } from "react";
import { ConfirmSubmit } from "../../_components/ConfirmSubmit";
import { StatusBadge } from "../../_components/ui";
import { commitStock, releaseStock, reserveStock } from "../actions";

/**
 * Stock state for one order plus the manual corrections. Status changes
 * already move stock (confirmed → reserve under the "on confirm" policy,
 * shipped → commit, cancelled → release); these buttons are the escape hatch
 * for the cases the owner has to fix by hand.
 */
export function StockActions({
  orderId,
  reserved,
  committed,
}: {
  orderId: string;
  reserved: boolean;
  committed: boolean;
}) {
  const [state, formAction, pending] = useActionState(reserveStock, {});
  const canReserve = !reserved && !committed;
  const canMove = reserved && !committed;

  return (
    <div className="flex flex-col gap-3 rounded-md border border-line bg-card p-4">
      <div>
        <p className="font-semibold">Stock</p>
        <p className="mt-1 text-sm text-muted">
          {committed
            ? "Stock has left inventory for this order."
            : reserved
              ? "Stock is reserved — it is held for this customer and not sellable to anyone else."
              : "Nothing is reserved for this order yet."}
        </p>
      </div>

      <p className="flex flex-wrap gap-2">
        {committed ? (
          <StatusBadge tone="muted">Committed</StatusBadge>
        ) : reserved ? (
          <StatusBadge tone="green">Reserved</StatusBadge>
        ) : (
          <StatusBadge tone="muted">Not reserved</StatusBadge>
        )}
      </p>

      {state.error && (
        <p role="alert" className="rounded-sm border border-red-900 bg-red-950 px-3 py-2 text-sm text-red-200">
          {state.error}
        </p>
      )}

      {canReserve && (
        <form action={formAction} className="flex items-center gap-2">
          <input type="hidden" name="id" value={orderId} />
          <button
            type="submit"
            disabled={pending}
            className="rounded-sm border border-line px-3 py-1.5 text-sm font-semibold disabled:opacity-60"
          >
            {pending ? "Reserving…" : "Reserve stock"}
          </button>
        </form>
      )}

      {canMove && (
        <div className="flex flex-wrap gap-2">
          <ConfirmSubmit
            action={releaseStock}
            id={orderId}
            label="Release reservation"
            confirmLabel="Confirm release?"
            tone="neutral"
          />
          <ConfirmSubmit
            action={commitStock}
            id={orderId}
            label="Commit (stock has shipped)"
            confirmLabel="Confirm commit?"
          />
        </div>
      )}
    </div>
  );
}
