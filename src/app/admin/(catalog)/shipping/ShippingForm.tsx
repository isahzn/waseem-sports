"use client";

import { useActionState } from "react";
import { Field, FormError } from "../_components/ui";

export type ShippingFormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

export type ShippingFormInitial = {
  name: string;
  country_codes: string;
  regions: string;
  method: string;
  fee: string;
  free_over: string;
  est_days_min: string;
  est_days_max: string;
  is_active: boolean;
  sort_order: number;
};

/**
 * Delivery rule form. The owner enters real rules here — nothing is seeded —
 * and the storefront only offers rules that are active. Fees are read from the
 * database at checkout, so a rule change applies to every new order and never
 * to past ones.
 */
export function ShippingForm({
  action,
  initial,
  submitLabel,
}: {
  action: (prev: ShippingFormState, formData: FormData) => Promise<ShippingFormState>;
  initial?: ShippingFormInitial;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-5">
      <FormError message={state.error} />

      <Field label="Rule name" hint="Shown to the customer at checkout." errors={fe.name}>
        <input
          type="text"
          name="name"
          required
          maxLength={120}
          defaultValue={initial?.name ?? ""}
          placeholder="Colombo delivery"
          className="rounded-sm border border-line bg-surface px-3 py-2"
        />
      </Field>

      <Field
        label="Method"
        hint="Lowercase id used by checkout, e.g. standard, express, pickup. Only active rules appear to customers."
        errors={fe.method}
      >
        <input
          type="text"
          name="method"
          required
          maxLength={40}
          defaultValue={initial?.method ?? "standard"}
          className="rounded-sm border border-line bg-surface px-3 py-2"
        />
      </Field>

      <Field label="Countries" hint="Two-letter codes separated by commas. Leave blank for none." errors={fe.country_codes}>
        <input
          type="text"
          name="country_codes"
          maxLength={200}
          defaultValue={initial?.country_codes ?? "LK"}
          placeholder="LK"
          className="rounded-sm border border-line bg-surface px-3 py-2"
        />
      </Field>

      <Field label="Regions / cities" hint="Optional. Free text, separated by commas or new lines." errors={fe.regions}>
        <textarea
          name="regions"
          rows={2}
          maxLength={600}
          defaultValue={initial?.regions ?? ""}
          placeholder="Colombo, Gampaha, Kalutara"
          className="rounded-sm border border-line bg-surface px-3 py-2"
        />
      </Field>

      <Field label="Delivery fee (Rs)" hint="Use 0 for free delivery." errors={fe.fee}>
        <input
          type="number"
          name="fee"
          min={0}
          step="0.01"
          defaultValue={initial?.fee ?? "0"}
          className="w-40 rounded-sm border border-line bg-surface px-3 py-2"
        />
      </Field>

      <Field
        label="Free over (Rs)"
        hint="Optional. Orders at or above this subtotal pay no delivery fee."
        errors={fe.free_over}
      >
        <input
          type="number"
          name="free_over"
          min={0}
          step="0.01"
          defaultValue={initial?.free_over ?? ""}
          className="w-40 rounded-sm border border-line bg-surface px-3 py-2"
        />
      </Field>

      <div className="flex flex-wrap gap-5">
        <Field label="Earliest delivery (days)" hint="Optional." errors={fe.est_days_min}>
          <input
            type="number"
            name="est_days_min"
            min={0}
            max={365}
            defaultValue={initial?.est_days_min ?? ""}
            className="w-32 rounded-sm border border-line bg-surface px-3 py-2"
          />
        </Field>
        <Field label="Latest delivery (days)" hint="Optional." errors={fe.est_days_max}>
          <input
            type="number"
            name="est_days_max"
            min={0}
            max={365}
            defaultValue={initial?.est_days_max ?? ""}
            className="w-32 rounded-sm border border-line bg-surface px-3 py-2"
          />
        </Field>
      </div>

      <Field label="Sort order" hint="Lower numbers appear first at checkout." errors={fe.sort_order}>
        <input
          type="number"
          name="sort_order"
          min={0}
          max={9999}
          defaultValue={initial?.sort_order ?? 0}
          className="w-32 rounded-sm border border-line bg-surface px-3 py-2"
        />
      </Field>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="is_active" defaultChecked={initial?.is_active ?? true} />
        Active — offer this option at checkout
      </label>

      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-sm bg-gold-600 px-5 py-2 text-sm font-semibold text-bronze-ink disabled:opacity-60"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
