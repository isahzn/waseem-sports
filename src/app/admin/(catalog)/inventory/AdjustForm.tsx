"use client";

import { useActionState } from "react";
import { Field, FormError } from "../_components/ui";
import { adjustStock } from "./actions";

export type VariantOption = {
  variant_id: string;
  product_name: string;
  variant_name: string;
  on_hand: number;
  reserved: number;
};

/** Manual stock correction. Positive adds, negative removes. Ledger-recorded. */
export function AdjustForm({ variants }: { variants: VariantOption[] }) {
  const [state, formAction, pending] = useActionState(adjustStock, {});
  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-4 rounded-md border border-line bg-card p-4">
      <p className="font-semibold">Correct stock</p>
      <p className="text-sm text-muted">
        For recounts, damaged goods and supplier top-ups. Every change is written to the ledger
        with your name on it. Customer orders move stock by themselves — never adjust for those.
      </p>
      <FormError message={state.error} />
      {state.ok && <p className="text-sm text-muted">Saved.</p>}
      <Field label="Variant" errors={fe.variant_id}>
        <select name="variant_id" required defaultValue="" className="rounded-sm border border-line bg-surface px-3 py-2">
          <option value="">— Pick a variant —</option>
          {variants.map((v) => (
            <option key={v.variant_id} value={v.variant_id}>
              {v.product_name} — {v.variant_name} (on hand: {v.on_hand})
            </option>
          ))}
        </select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Amount" hint="+ adds, − removes. Cannot go below zero." errors={fe.delta}>
          <input
            type="number"
            name="delta"
            required
            step={1}
            placeholder="+10 or −3"
            className="rounded-sm border border-line bg-surface px-3 py-2"
          />
        </Field>
        <Field label="Reason (shown in the ledger)" errors={fe.note}>
          <input
            type="text"
            name="note"
            maxLength={500}
            placeholder="E.g. Annual recount"
            className="rounded-sm border border-line bg-surface px-3 py-2"
          />
        </Field>
      </div>
      <div>
        <button type="submit" disabled={pending} className="rounded-sm bg-gold-600 px-5 py-2 text-sm font-semibold text-bronze-ink disabled:opacity-60">
          {pending ? "Saving…" : "Apply adjustment"}
        </button>
      </div>
    </form>
  );
}
