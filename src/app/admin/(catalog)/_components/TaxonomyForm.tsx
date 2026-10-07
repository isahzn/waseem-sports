"use client";

import { useActionState, useState } from "react";
import { slugify } from "@/lib/catalog/slug";
import { Field, FormError } from "./ui";

export type TaxonomyFormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

export type TaxonomyInitial = {
  name: string;
  slug: string;
  description: string;
  is_visible: boolean;
  is_featured: boolean;
  sort_order: number;
  seo_title: string;
  seo_description: string;
  imageAlt: string;
};

/**
 * Shared create/edit form for sports + brands (identical fields by design).
 * Slug auto-suggests from the name until the owner edits it by hand.
 */
export function TaxonomyForm({
  action,
  initial,
  imageAltLabel,
  submitLabel,
}: {
  action: (prev: TaxonomyFormState, formData: FormData) => Promise<TaxonomyFormState>;
  initial?: TaxonomyInitial;
  imageAltLabel: string;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [slugTouched, setSlugTouched] = useState(Boolean(initial?.slug));
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-5">
      <FormError message={state.error} />
      <Field label="Name" errors={fe.name}>
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
      <Field
        label="Slug"
        hint="Used in the storefront URL. Lowercase letters, numbers and hyphens."
        errors={fe.slug}
      >
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
      <Field label="Description" errors={fe.description}>
        <textarea
          name="description"
          rows={4}
          maxLength={5000}
          defaultValue={initial?.description ?? ""}
          placeholder="Plain text — shown on the storefront listing."
          className="rounded-sm border border-line bg-surface px-3 py-2"
        />
      </Field>
      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="is_visible" defaultChecked={initial?.is_visible ?? true} />
          Visible on storefront
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="is_featured" defaultChecked={initial?.is_featured ?? false} />
          Featured
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
      <Field label={imageAltLabel} errors={fe.image_alt ?? fe.logo_alt}>
        <input
          type="text"
          name="imageAlt"
          maxLength={200}
          defaultValue={initial?.imageAlt ?? ""}
          placeholder="Describe the image for screen readers."
          className="rounded-sm border border-line bg-surface px-3 py-2"
        />
      </Field>
      <Field label="SEO title" errors={fe.seo_title}>
        <input
          type="text"
          name="seo_title"
          maxLength={200}
          defaultValue={initial?.seo_title ?? ""}
          className="rounded-sm border border-line bg-surface px-3 py-2"
        />
      </Field>
      <Field label="SEO description" errors={fe.seo_description}>
        <textarea
          name="seo_description"
          rows={2}
          maxLength={500}
          defaultValue={initial?.seo_description ?? ""}
          className="rounded-sm border border-line bg-surface px-3 py-2"
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
