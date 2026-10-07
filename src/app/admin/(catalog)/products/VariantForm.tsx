"use client";

import { useActionState } from "react";
import { Field, FormError } from "../_components/ui";

export type VariantFormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

export type OptionDef = { slug: string; name: string; options: string[] };

/**
 * Add-variant form. One row per variant-dimension attribute (Size, Colour…).
 * Never auto-generates combinations — the owner lists each variant explicitly.
 */
export function VariantForm({
  action,
  optionDefs,
}: {
  action: (prev: VariantFormState, formData: FormData) => Promise<VariantFormState>;
  optionDefs: OptionDef[];
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-md border border-line bg-card p-4">
      <p className="font-semibold">Add a variant</p>
      <FormError message={state.error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Variant name" hint="E.g. Size SH — Natural." errors={fe.name}>
          <input type="text" name="name" required maxLength={200} placeholder="Size SH — Natural" className="rounded-sm border border-line bg-surface px-3 py-2" />
        </Field>
        <Field label="SKU (optional)" hint="Must be unique across all variants." errors={fe.sku}>
          <input type="text" name="sku" maxLength={64} placeholder="BAT-PRO-SH-NAT" className="rounded-sm border border-line bg-surface px-3 py-2" />
        </Field>
      </div>
      {optionDefs.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          {optionDefs.map((def) => (
            <Field key={def.slug} label={def.name} errors={fe[`options`]}>
              <select name={`opt_${def.slug}`} defaultValue="" className="rounded-sm border border-line bg-surface px-3 py-2">
                <option value="">— Not set —</option>
                {def.options.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </Field>
          ))}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Price override (optional)" hint="Empty = use product price." errors={fe.price}>
          <input type="number" name="price" min={0} step="0.01" placeholder="Product price" className="rounded-sm border border-line bg-surface px-3 py-2" />
        </Field>
        <Field label="Sort order" errors={fe.sort_order}>
          <input type="number" name="sort_order" min={0} max={9999} defaultValue={0} className="rounded-sm border border-line bg-surface px-3 py-2" />
        </Field>
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="is_active" defaultChecked />
            Active (sellable)
          </label>
        </div>
      </div>
      <div>
        <button type="submit" disabled={pending} className="rounded-sm border border-line px-4 py-2 text-sm font-semibold disabled:opacity-60">
          {pending ? "Adding…" : "Add variant"}
        </button>
      </div>
    </form>
  );
}
