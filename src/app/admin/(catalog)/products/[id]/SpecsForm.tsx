"use client";

import { useActionState } from "react";
import { Field, FormError } from "../../_components/ui";

export type SpecDef = {
  id: string;
  name: string;
  slug: string;
  input_type: string;
  options: string[];
};

export type SpecValue = { attribute_id: string; value_text: string };

/** Descriptive specs (Weight, Material…). Variant dimensions live on variants. */
export function SpecsForm({
  action,
  defs,
  values,
}: {
  action: (prev: { error?: string }, formData: FormData) => Promise<{ error?: string }>;
  defs: SpecDef[];
  values: SpecValue[];
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const current = new Map(values.map((v) => [v.attribute_id, v.value_text]));

  if (defs.length === 0) {
    return (
      <p className="text-sm text-muted">
        No descriptive specs defined yet. Create attributes first (untick “product option”),
        then fill them in here.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-4">
      <FormError message={state.error} />
      {defs.map((def) => (
        <Field key={def.id} label={`${def.name} (${def.slug})`}>
          {def.input_type === "boolean" ? (
            <select
              name={`attr_${def.id}`}
              defaultValue={current.get(def.id) ?? ""}
              className="rounded-sm border border-line bg-surface px-3 py-2"
            >
              <option value="">— Not set —</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          ) : def.input_type === "select" && def.options.length > 0 ? (
            <select
              name={`attr_${def.id}`}
              defaultValue={current.get(def.id) ?? ""}
              className="rounded-sm border border-line bg-surface px-3 py-2"
            >
              <option value="">— Not set —</option>
              {def.options.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          ) : (
            <input
              type={def.input_type === "number" ? "number" : "text"}
              name={`attr_${def.id}`}
              defaultValue={current.get(def.id) ?? ""}
              maxLength={500}
              step={def.input_type === "number" ? "any" : undefined}
              className="rounded-sm border border-line bg-surface px-3 py-2"
            />
          )}
        </Field>
      ))}
      <div>
        <button type="submit" disabled={pending} className="rounded-sm border border-line px-4 py-2 text-sm font-semibold disabled:opacity-60">
          {pending ? "Saving…" : "Save specs"}
        </button>
      </div>
    </form>
  );
}
