import { z } from "zod";

/**
 * Shared validation for the catalog admin (Phase 03).
 * Pure data schemas — server actions coerce FormData to plain values
 * before parsing, so these stay free of FormData quirks.
 */

export const slugField = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Slug is required.")
  .max(120, "Slug must be 120 characters or fewer.")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers and hyphens only.",
  );

export const nameField = z
  .string()
  .trim()
  .min(1, "Name is required.")
  .max(200, "Name must be 200 characters or fewer.");

export const sortOrderField = z
  .number()
  .int()
  .min(0)
  .max(9999)
  .default(0);

export const moneyField = z
  .number()
  .min(0, "Price cannot be negative.")
  .max(999999999.99, "Price is too large.");

/** Empty string / undefined become null (optional text columns). */
export function optionalText(max: number, label = "Value") {
  return z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    z.string().trim().max(max, `${label} must be ${max} characters or fewer.`).nullable(),
  );
}

/** Empty string / undefined become null (optional money columns). */
export const optionalMoney = z.preprocess(
  (v) => (v === "" || v === undefined || v === null ? null : v),
  z.number().min(0, "Price cannot be negative.").max(999999999.99).nullable(),
);

/** Empty string / undefined become null (optional FK columns). */
export const uuidOrNull = z.preprocess(
  (v) => (v === "" || v === undefined ? null : v),
  z.string().uuid("Invalid reference.").nullable(),
);

export const contentStatusField = z.enum(["draft", "published", "archived"]);

export const seoFields = z.object({
  seo_title: optionalText(200, "SEO title"),
  seo_description: optionalText(500, "SEO description"),
});

export const visibilityFields = z.object({
  is_visible: z.boolean().default(true),
  is_featured: z.boolean().default(false),
  sort_order: sortOrderField,
});

// ---------- taxonomy ----------

const taxonomyBase = z.object({
  name: nameField,
  slug: slugField,
  description: optionalText(5000, "Description"),
});

export const sportInput = taxonomyBase
  .merge(visibilityFields)
  .merge(seoFields)
  .merge(z.object({ image_alt: optionalText(200, "Image alt text") }));

export const categoryInput = taxonomyBase
  .merge(visibilityFields)
  .merge(seoFields)
  .merge(
    z.object({
      sport_id: uuidOrNull,
      parent_id: uuidOrNull,
      image_alt: optionalText(200, "Image alt text"),
    }),
  );

export const brandInput = taxonomyBase
  .merge(visibilityFields)
  .merge(z.object({ logo_alt: optionalText(200, "Logo alt text") }));

// ---------- attribute definitions ----------

export const attributeInput = z
  .object({
    name: nameField,
    slug: slugField,
    input_type: z.enum(["text", "number", "select", "boolean"]),
    options: z.array(z.string().trim().min(1).max(80)).max(50).default([]),
    is_filterable: z.boolean().default(false),
    is_variant_option: z.boolean().default(false),
    sort_order: sortOrderField,
  })
  .superRefine((val, ctx) => {
    if (val.input_type === "select" && val.options.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["options"],
        message: "Select attributes need at least one option.",
      });
    }
    if (val.input_type !== "select" && val.options.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["options"],
        message: "Only select attributes can have options.",
      });
    }
  });

// ---------- products + variants + images ----------

export const productInput = z.object({
  name: nameField,
  slug: slugField,
  description: optionalText(20000, "Description"),
  sport_id: uuidOrNull,
  category_id: uuidOrNull,
  brand_id: uuidOrNull,
  base_price: moneyField,
  compare_at_price: optionalMoney,
  status: contentStatusField,
  is_featured: z.boolean().default(false),
  seo_title: optionalText(200, "SEO title"),
  seo_description: optionalText(500, "SEO description"),
});

export const variantInput = z.object({
  name: z.string().trim().min(1, "Variant name is required.").max(200),
  sku: z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    z.string().trim().max(64, "SKU must be 64 characters or fewer.").nullable(),
  ),
  price: optionalMoney,
  options: z.record(z.string().trim().min(1).max(80), z.string().trim().min(1).max(80)).default({}),
  is_default: z.boolean().default(false),
  is_active: z.boolean().default(true),
  sort_order: sortOrderField,
});

export const imageInput = z.object({
  storage_path: z
    .string()
    .trim()
    .min(1, "Storage path is required.")
    .max(500)
    .refine((p) => !p.includes("..") && !p.startsWith("/") && !p.startsWith("\\"), {
      message: "Invalid storage path.",
    }),
  alt_text: optionalText(300, "Alt text"),
  variant_id: uuidOrNull,
  sort_order: sortOrderField,
  is_primary: z.boolean().default(false),
});

// ---------- inventory ----------

export const stockAdjustInput = z.object({
  variant_id: z.string().uuid("Invalid variant."),
  delta: z.number().int().min(-100000).max(100000).refine((n) => n !== 0, {
    message: "Adjustment cannot be zero.",
  }),
  note: z.string().trim().max(500, "Note must be 500 characters or fewer.").default(""),
});

// ---------- list query (searchParams) ----------

export const listParamsSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  page: z.coerce.number().int().min(1).catch(1),
  visibility: z.enum(["all", "visible", "hidden"]).catch("all"),
  status: contentStatusField.optional().catch(undefined),
  archived: z.enum(["only", "include"]).optional().catch(undefined),
});

export type ListParams = z.infer<typeof listParamsSchema>;
export type SportInput = z.infer<typeof sportInput>;
export type CategoryInput = z.infer<typeof categoryInput>;
export type BrandInput = z.infer<typeof brandInput>;
export type AttributeInput = z.infer<typeof attributeInput>;
export type ProductInput = z.infer<typeof productInput>;
export type VariantInput = z.infer<typeof variantInput>;
export type ImageInput = z.infer<typeof imageInput>;

/** Flatten a ZodError to per-field message lists for useActionState forms. */
export function toFieldErrors(error: z.ZodError): Record<string, string[]> {
  return error.flatten().fieldErrors as Record<string, string[]>;
}

/** Coerce helpers: turn raw FormData entries into schema-ready values. */
export function formBool(value: FormDataEntryValue | null): boolean {
  return value === "on" || value === "true" || value === "1";
}

export function formNumber(value: FormDataEntryValue | null): number | undefined {
  if (value === null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : (Number.NaN as number);
}

export function formText(value: FormDataEntryValue | null): string | null {
  if (value === null) return null;
  return String(value);
}
