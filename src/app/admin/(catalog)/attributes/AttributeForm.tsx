"use client";

import { useActionState, useState } from "react";
import { slugify } from "@/lib/catalog/slug";
import { Field, FormError } from "../_components/ui";

export type AttributeFormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

export type AttributeInitial = {
  name: string;
  slug: string;
  input_type: string;
  options: string;
  is_filterable: boolean;
  is_variant_option: boolean;
  sort_order: number;
};

/**
 * Attribute definition form. Options are one-per-line; the server splits them.
 * Plain-language hints — the owner is non-technical.
 */
export function AttributeForm({
  action,
  initial,
  submitLabel,
}: {
  action: (prev: AttributeFormState, formData: FormData) => Promise<AttributeFormState>;
  initial?: AttributeInitial;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [slugTouched, setSlugTouched] = useState(Boolean(initial?.slug));
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [inputType, setInputType] = useState(initial?.input_type ?? "text");
  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-5">
      <FormError message={state.error} />
      <Field label="Name" hint="E.g. Size, Colour, Weight, Material." errors={fe.name}>
        <input
          type="text"
          name="name"
          required
          maxLength={200}
          defaultValue={initial?.name ?? ""}
          onChange={(e) => {
            if (!slugTouched) setSlug(slugify(e.target.value));
          }}
          className="rounded-sm border border-line bg-surface px-3 py-2"
        />
      </Field>
      <Field label="Slug" hint="Lowercase letters, numbers and hyphens. Used to link variants." errors={fe.slug}>
        <input
          type="text"
          name="slug"
          required
          maxLength={120}
          value={slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value);
          }}
          className="rounded-sm border border-line bg-surface px-3 py-2"
        />
      </Field>
      <Field label="Answer type" errors={fe.input_type}>
        <select
          name="input_type"
          value={inputType}
          onChange={(e) => setInputType(e.target.value)}
          className="rounded-sm border border-line bg-surface px-3 py-2"
        >
          <option value="text">Text — free writing (e.g. Material)</option>
          <option value="number">Number — digits only (e.g. Weight in g)</option>
          <option value="select">Fixed choices — pick from a list (e.g. Size)</option>
          <option value="boolean">Yes / No (e.g. Waterproof)</option>
        </select>
      </Field>
      {inputType === "select" && (
        <Field
          label="Choices"
          hint="One choice per line. E.g. Small, Medium, Large."
          errors={fe.options}
        >
          <textarea
            name="options"
            rows={5}
            maxLength={4000}
            defaultValue={initial?.options ?? ""}
            placeholder={"Small\nMedium\nLarge"}
            className="rounded-sm border border-line bg-surface px-3 py-2"
          />
        </Field>
      )}
      {inputType !== "select" && <input type="hidden" name="options" value="" />}
      <div className="flex flex-col gap-3">
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="is_variant_option" defaultChecked={initial?.is_variant_option ?? false} className="mt-1" />
          <span>
            <span className="font-semibold">Use as a product option</span>
            <span className="block text-muted">Tick for Size / Colour — things the buyer picks. Leave unticked for specs like Weight / Material.</span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="is_filterable" defaultChecked={initial?.is_filterable ?? false} className="mt-1" />
          <span>
            <span className="font-semibold">Let shoppers filter by it</span>
            <span className="block text-muted">Shows in the storefront filter panel (Phase 04).</span>
          </span>
        </label>
      </div>
      <Field label="Sort order" hint="Lower numbers appear first." errors={fe.sort_order}>
        <input
          type="number"
          name="sort_order"
          min={0}
          max={9999}
          defaultValue={initial?.sort_order ?? 0}
          className="w-32 rounded-sm border border-line bg-surface px-3 py-2"
        />
      </Field>
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
