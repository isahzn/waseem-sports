"use client";

import { useActionState, useState } from "react";
import { slugify } from "@/lib/catalog/slug";
import { Field, FormError } from "../_components/ui";

export type ProductFormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

export type RefOption = { id: string; name: string };

export type ProductInitial = {
  name: string;
  slug: string;
  description: string;
  sport_id: string;
  category_id: string;
  brand_id: string;
  base_price: string;
  compare_at_price: string;
  status: string;
  is_featured: boolean;
  seo_title: string;
  seo_description: string;
};

/** Stepwise owner-friendly product form (Phase 03 spec order). */
export function ProductForm({
  action,
  sports,
  categories,
  brands,
  initial,
  submitLabel,
  statusHint,
}: {
  action: (prev: ProductFormState, formData: FormData) => Promise<ProductFormState>;
  sports: RefOption[];
  categories: RefOption[];
  brands: RefOption[];
  initial?: ProductInitial;
  submitLabel: string;
  statusHint?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [slugTouched, setSlugTouched] = useState(Boolean(initial?.slug));
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-5">
      <FormError message={state.error} />
      <Field label="1 · Product name" errors={fe.name}>
        <input
          type="text"
          name="name"
          required
          maxLength={200}
          defaultValue={initial?.name ?? ""}
          placeholder="E.g. Pro Cricket Bat — English Willow"
          onChange={(e) => {
            if (!slugTouched) setSlug(slugify(e.target.value));
          }}
          className="rounded-sm border border-line bg-surface px-3 py-2"
        />
      </Field>
      <Field label="Slug" hint="Storefront URL. Lowercase letters, numbers and hyphens." errors={fe.slug}>
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
      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="2 · Sport" errors={fe.sport_id}>
          <select name="sport_id" defaultValue={initial?.sport_id ?? ""} className="rounded-sm border border-line bg-surface px-3 py-2">
            <option value="">— None —</option>
            {sports.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </Field>
        <Field label="3 · Category" errors={fe.category_id}>
          <select name="category_id" defaultValue={initial?.category_id ?? ""} className="rounded-sm border border-line bg-surface px-3 py-2">
            <option value="">— None —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>
        <Field label="4 · Brand" errors={fe.brand_id}>
          <select name="brand_id" defaultValue={initial?.brand_id ?? ""} className="rounded-sm border border-line bg-surface px-3 py-2">
            <option value="">— None —</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="5 · Description" hint="Plain text. No links or formatting codes needed." errors={fe.description}>
        <textarea
          name="description"
          rows={5}
          maxLength={20000}
          defaultValue={initial?.description ?? ""}
          placeholder="What is it, who is it for, what makes it good?"
          className="rounded-sm border border-line bg-surface px-3 py-2"
        />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="6 · Price (LKR)" errors={fe.base_price}>
          <input
            type="number"
            name="base_price"
            required
            min={0}
            step="0.01"
            defaultValue={initial?.base_price ?? ""}
            placeholder="0.00"
            className="rounded-sm border border-line bg-surface px-3 py-2"
          />
        </Field>
        <Field label="Was price (optional)" hint="Shows a sale badge when higher than the price." errors={fe.compare_at_price}>
          <input
            type="number"
            name="compare_at_price"
            min={0}
            step="0.01"
            defaultValue={initial?.compare_at_price ?? ""}
            placeholder="Leave empty for no sale"
            className="rounded-sm border border-line bg-surface px-3 py-2"
          />
        </Field>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="7 · Status" hint={statusHint ?? "Draft is invisible. Published appears on the storefront."} errors={fe.status}>
          <select name="status" defaultValue={initial?.status ?? "draft"} className="rounded-sm border border-line bg-surface px-3 py-2">
            <option value="draft">Draft — invisible</option>
            <option value="published">Published — on the storefront</option>
            <option value="archived">Archived — hidden, kept for records</option>
          </select>
        </Field>
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="is_featured" defaultChecked={initial?.is_featured ?? false} />
            Featured product
          </label>
        </div>
      </div>
      <Field label="SEO title (optional)" errors={fe.seo_title}>
        <input type="text" name="seo_title" maxLength={200} defaultValue={initial?.seo_title ?? ""} className="rounded-sm border border-line bg-surface px-3 py-2" />
      </Field>
      <Field label="SEO description (optional)" errors={fe.seo_description}>
        <textarea name="seo_description" rows={2} maxLength={500} defaultValue={initial?.seo_description ?? ""} className="rounded-sm border border-line bg-surface px-3 py-2" />
      </Field>
      <div>
        <button type="submit" disabled={pending} className="rounded-sm bg-gold-600 px-5 py-2 text-sm font-semibold text-bronze-ink disabled:opacity-60">
          {pending ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
