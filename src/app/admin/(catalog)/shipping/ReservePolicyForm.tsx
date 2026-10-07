"use client";

import { useActionState } from "react";
import { FormError } from "../_components/ui";

export type ReservePolicyState = {
  ok?: boolean;
  error?: string;
};

const OPTIONS: { value: "placed" | "confirmed"; label: string; hint: string }[] = [
  {
    value: "placed",
    label: "Reserve when the order is placed",
    hint: "Recommended. Stock is held the moment a customer orders, so two people cannot buy the same last item.",
  },
  {
    value: "confirmed",
    label: "Reserve when I confirm the order",
    hint: "Stock is held after you confirm, which lets you check availability first — but a popular item can sell twice before you confirm.",
  },
];

/**
 * COD reservation policy (D2). This records the owner's choice only: the
 * setting is enforced inside the database function that places orders, so the
 * browser can never decide stock behaviour.
 */
export function ReservePolicyForm({
  action,
  current,
}: {
  action: (prev: ReservePolicyState, formData: FormData) => Promise<ReservePolicyState>;
  current: "placed" | "confirmed";
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormError message={state.error} />
      {state.ok && (
        <p
          role="status"
          className="rounded-sm border border-pine-800 bg-pine-900 px-3 py-2 text-sm text-ink"
        >
          Stock policy saved.
        </p>
      )}

      <fieldset className="flex flex-col gap-3">
        <legend className="sr-only">When to reserve stock for a new order</legend>
        {OPTIONS.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-start gap-3 rounded-md border border-line bg-card p-4"
          >
            <input
              type="radio"
              name="reserve_stock_on"
              value={option.value}
              defaultChecked={current === option.value}
              className="mt-1"
            />
            <span>
              <span className="block font-semibold">{option.label}</span>
              <span className="mt-1 block text-sm text-muted">{option.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-sm bg-gold-600 px-5 py-2 text-sm font-semibold text-bronze-ink disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save stock policy"}
        </button>
      </div>
    </form>
  );
}
