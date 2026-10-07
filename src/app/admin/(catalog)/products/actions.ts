"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/catalog/audit";
import {
  formBool,
  formNumber,
  formText,
  productInput,
  toFieldErrors,
  variantInput,
} from "@/lib/catalog/schemas";
import { logger } from "@/lib/security/logger";
import type { ConfirmState } from "../_components/ConfirmSubmit";
import type { ProductFormState } from "./ProductForm";
import type { VariantFormState } from "./VariantForm";

type Db = Awaited<ReturnType<typeof createClient>>;

const uuid = z.string().uuid();

function productValues(formData: FormData) {
  return {
    name: formText(formData.get("name")) ?? "",
    slug: formText(formData.get("slug")) ?? "",
    description: formText(formData.get("description")),
    sport_id: formText(formData.get("sport_id")),
    category_id: formText(formData.get("category_id")),
    brand_id: formText(formData.get("brand_id")),
    base_price: formNumber(formData.get("base_price")) ?? Number.NaN,
    compare_at_price: formText(formData.get("compare_at_price"))
      ? formNumber(formData.get("compare_at_price"))
      : null,
    status: String(formData.get("status") ?? "draft"),
    is_featured: formBool(formData.get("is_featured")),
    seo_title: formText(formData.get("seo_title")),
    seo_description: formText(formData.get("seo_description")),
  };
}

async function slugTaken(db: Db, slug: string, ignoreId?: string): Promise<boolean> {
  let query = db.from("products").select("id").eq("slug", slug);
  if (ignoreId) query = query.neq("id", ignoreId);
  const { data } = await query.maybeSingle();
  return Boolean(data);
}

async function refsExist(db: Db, v: { sport_id: string | null; category_id: string | null; brand_id: string | null }): Promise<string | null> {
  if (v.sport_id) {
    const { data } = await db.from("sports").select("id").eq("id", v.sport_id).is("deleted_at", null).maybeSingle();
    if (!data) return "The selected sport no longer exists.";
  }
  if (v.category_id) {
    const { data } = await db.from("categories").select("id").eq("id", v.category_id).is("deleted_at", null).maybeSingle();
    if (!data) return "The selected category no longer exists.";
  }
  if (v.brand_id) {
    const { data } = await db.from("brands").select("id").eq("id", v.brand_id).is("deleted_at", null).maybeSingle();
    if (!data) return "The selected brand no longer exists.";
  }
  return null;
}

export async function createProduct(
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return { error: "Sign in required." };
  }

  const parsed = productInput.safeParse(productValues(formData));
  if (!parsed.success) {
    return { error: "Check the highlighted fields.", fieldErrors: toFieldErrors(parsed.error) };
  }

  const db = await createClient();
  const refError = await refsExist(db, parsed.data);
  if (refError) return { error: refError };
  if (await slugTaken(db, parsed.data.slug)) {
    return { error: "That slug is already in use.", fieldErrors: { slug: ["This slug is already in use."] } };
  }

  // Every product gets exactly one hidden default variant + inventory row,
  // so stock/cart/order code has a single path (HANDOFF decision 1).
  const { data: product, error: pErr } = await db.from("products").insert(parsed.data).select("id").single();
  if (pErr || !product) {
    logger.error("product create failed", { error: pErr?.message });
    return { error: "Could not save the product. Try again." };
  }

  const { data: variant, error: vErr } = await db
    .from("product_variants")
    .insert({ product_id: product.id, name: "Default", is_default: true })
    .select("id")
    .single();
  if (vErr || !variant) {
    logger.error("default variant create failed", { error: vErr?.message, productId: product.id });
    return { error: "Product saved but its stock record failed. Open the product and try again." };
  }

  const { error: iErr } = await db.from("inventory").insert({ variant_id: variant.id });
  if (iErr) {
    logger.error("inventory row create failed", { error: iErr.message, variantId: variant.id });
    return { error: "Product saved but its stock record failed. Open the product and try again." };
  }

  await writeAudit({ actor: admin.userId, action: "product.create", entity: "products", entityId: product.id, meta: { name: parsed.data.name } });
  revalidatePath("/admin/products");
  redirect(`/admin/products/${product.id}`);
}

export async function updateProduct(
  id: string,
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return { error: "Sign in required." };
  }
  if (!uuid.safeParse(id).success) return { error: "Invalid product." };

  const parsed = productInput.safeParse(productValues(formData));
  if (!parsed.success) {
    return { error: "Check the highlighted fields.", fieldErrors: toFieldErrors(parsed.error) };
  }

  const db = await createClient();
  const refError = await refsExist(db, parsed.data);
  if (refError) return { error: refError };
  if (await slugTaken(db, parsed.data.slug, id)) {
    return { error: "That slug is already in use.", fieldErrors: { slug: ["This slug is already in use."] } };
  }

  // Publishing stamps published_at; unpublishing leaves the stamp as history.
  const patch: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.status === "published") patch.published_at = new Date().toISOString();

  const { error } = await db.from("products").update(patch).eq("id", id).is("deleted_at", null);
  if (error) {
    logger.error("product update failed", { error: error.message });
    return { error: "Could not save the product. Try again." };
  }

  await writeAudit({ actor: admin.userId, action: "product.update", entity: "products", entityId: id, meta: { name: parsed.data.name, status: parsed.data.status } });
  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${id}`);
  redirect("/admin/products");
}

async function setArchived(id: string, archived: boolean): Promise<ConfirmState> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return { error: "Sign in required." };
  }
  if (!uuid.safeParse(id).success) return { error: "Invalid product." };

  const db = await createClient();
  const patch = archived
    ? { status: "archived", deleted_at: new Date().toISOString() }
    : { status: "draft", deleted_at: null };
  const { error } = await db.from("products").update(patch).eq("id", id);
  if (error) {
    logger.error("product archive failed", { error: error.message });
    return { error: "Could not update the product. Try again." };
  }

  await writeAudit({ actor: admin.userId, action: archived ? "product.archive" : "product.restore", entity: "products", entityId: id });
  revalidatePath("/admin/products");
  redirect("/admin/products");
}

export async function archiveProduct(_prev: ConfirmState, formData: FormData): Promise<ConfirmState> {
  return setArchived(String(formData.get("id") ?? ""), true);
}

export async function restoreProduct(_prev: ConfirmState, formData: FormData): Promise<ConfirmState> {
  return setArchived(String(formData.get("id") ?? ""), false);
}

// ---------- variants ----------

function variantValues(formData: FormData, optionSlugs: string[]) {
  const options: Record<string, string> = {};
  for (const slug of optionSlugs) {
    const v = String(formData.get(`opt_${slug}`) ?? "").trim();
    if (v) options[slug] = v.slice(0, 80);
  }
  return {
    name: formText(formData.get("name")) ?? "",
    sku: formText(formData.get("sku")),
    price: formText(formData.get("price")) ? formNumber(formData.get("price")) : null,
    options,
    is_default: false,
    is_active: formBool(formData.get("is_active")),
    sort_order: formNumber(formData.get("sort_order")) ?? 0,
  };
}

export async function createVariant(
  productId: string,
  optionSlugs: string[],
  _prev: VariantFormState,
  formData: FormData,
): Promise<VariantFormState> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return { error: "Sign in required." };
  }
  if (!uuid.safeParse(productId).success) return { error: "Invalid product." };

  const parsed = variantInput.safeParse(variantValues(formData, optionSlugs));
  if (!parsed.success) {
    return { error: "Check the highlighted fields.", fieldErrors: toFieldErrors(parsed.error) };
  }

  const db = await createClient();
  const { data: variant, error } = await db
    .from("product_variants")
    .insert({ ...parsed.data, product_id: productId })
    .select("id")
    .single();
  if (error || !variant) {
    if (error?.code === "23505") return { error: "That SKU is already used by another variant." };
    logger.error("variant create failed", { error: error?.message });
    return { error: "Could not save the variant. Try again." };
  }
  await db.from("inventory").insert({ variant_id: variant.id });

  await writeAudit({ actor: admin.userId, action: "variant.create", entity: "product_variants", entityId: variant.id, meta: { productId, name: parsed.data.name } });
  revalidatePath(`/admin/products/${productId}`);
  redirect(`/admin/products/${productId}`);
}

/** Plain form action (FormData in, redirect out). Guards return silently — the form re-renders unchanged. */
export async function toggleVariantActive(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const productId = String(formData.get("product_id") ?? "");
  const to = String(formData.get("to") ?? "") === "true";
  if (!uuid.safeParse(id).success || !uuid.safeParse(productId).success) return;

  const db = await createClient();
  // The default variant cannot be deactivated while it is the only variant.
  if (!to) {
    const { count } = await db.from("product_variants").select("id", { count: "exact", head: true }).eq("product_id", productId).is("deleted_at", null).eq("is_active", true);
    if ((count ?? 0) <= 1) return;
  }

  const { error } = await db.from("product_variants").update({ is_active: to }).eq("id", id);
  if (error) {
    logger.error("variant toggle failed", { error: error.message });
    return;
  }

  await writeAudit({ actor: admin.userId, action: to ? "variant.activate" : "variant.deactivate", entity: "product_variants", entityId: id });
  revalidatePath(`/admin/products/${productId}`);
  redirect(`/admin/products/${productId}`);
}

/** Delete-variant with two-step confirm (ConfirmSubmit). Guard failures surface inline. */
export async function deleteVariant(
  _prev: ConfirmState,
  formData: FormData,
): Promise<ConfirmState> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return { error: "Sign in required." };
  }
  const id = String(formData.get("id") ?? "");
  // ConfirmSubmit sends only `id`; the product id is resolved from the row.
  const variantId = uuid.safeParse(id).success ? id : null;
  if (!variantId) return { error: "Invalid variant." };

  const db = await createClient();
  const { data: row } = await db.from("product_variants").select("product_id").eq("id", variantId).single();
  if (!row) return { error: "Invalid variant." };
  const productId = row.product_id as string;
  const { count } = await db.from("product_variants").select("id", { count: "exact", head: true }).eq("product_id", productId).is("deleted_at", null);
  if ((count ?? 0) <= 1) return { error: "A product needs at least one variant — deactivate it instead." };
  // Variants on orders are history: block delete, allow deactivate.
  const { data: used } = await db.from("order_items").select("id").eq("variant_id", variantId).limit(1);
  if (used && used.length > 0) return { error: "This variant is on orders and cannot be deleted. Deactivate it instead." };

  const { error } = await db.from("product_variants").update({ deleted_at: new Date().toISOString() }).eq("id", variantId);
  if (error) {
    logger.error("variant delete failed", { error: error.message });
    return { error: "Could not delete the variant. Try again." };
  }

  await writeAudit({ actor: admin.userId, action: "variant.delete", entity: "product_variants", entityId: variantId });
  revalidatePath(`/admin/products/${productId}`);
  redirect(`/admin/products/${productId}`);
}

// ---------- attribute values (descriptive specs) ----------

export async function saveAttributeValues(
  productId: string,
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return { error: "Sign in required." };
  }
  if (!uuid.safeParse(productId).success) return { error: "Invalid product." };

  const db = await createClient();
  const { data: defs } = await db.from("attribute_definitions").select("id,slug,input_type").eq("is_variant_option", false);
  const rows: { product_id: string; attribute_id: string; value_text: string }[] = [];
  for (const def of defs ?? []) {
    const raw = String(formData.get(`attr_${def.id}`) ?? "").trim();
    if (!raw) continue;
    // Validate by type: numbers must parse, booleans come from a select.
    if (def.input_type === "number" && !Number.isFinite(Number(raw))) {
      return { error: `“${def.slug}” must be a number.` };
    }
    if (raw.length > 500) return { error: `“${def.slug}” is too long (max 500).` };
    rows.push({ product_id: productId, attribute_id: def.id, value_text: raw.slice(0, 500) });
  }

  // Replace-all is safe here: values are owner-managed specs, never order history.
  const { error: delErr } = await db.from("product_attribute_values").delete().eq("product_id", productId);
  if (delErr) {
    logger.error("attr values clear failed", { error: delErr.message });
    return { error: "Could not save the specs. Try again." };
  }
  if (rows.length > 0) {
    const { error: insErr } = await db.from("product_attribute_values").insert(rows);
    if (insErr) {
      logger.error("attr values save failed", { error: insErr.message });
      return { error: "Could not save the specs. Try again." };
    }
  }

  await writeAudit({ actor: admin.userId, action: "product.specs", entity: "products", entityId: productId, meta: { count: rows.length } });
  revalidatePath(`/admin/products/${productId}`);
  redirect(`/admin/products/${productId}`);
}
