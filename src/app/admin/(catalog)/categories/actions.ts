"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { adminDb, requireAdmin } from "@/lib/auth/requireAdmin";
import { writeAudit } from "@/lib/catalog/audit";
import {
  categoryInput,
  formBool,
  formNumber,
  formText,
  toFieldErrors,
} from "@/lib/catalog/schemas";
import { logger } from "@/lib/security/logger";
import type { ConfirmState } from "../_components/ConfirmSubmit";
import type { CategoryFormState } from "./CategoryForm";

function formValues(formData: FormData) {
  return {
    name: formText(formData.get("name")) ?? "",
    slug: formText(formData.get("slug")) ?? "",
    description: formText(formData.get("description")),
    sport_id: formText(formData.get("sport_id")),
    parent_id: formText(formData.get("parent_id")),
    is_visible: formBool(formData.get("is_visible")),
    is_featured: false,
    sort_order: formNumber(formData.get("sort_order")) ?? 0,
    image_alt: formText(formData.get("imageAlt")),
    seo_title: formText(formData.get("seo_title")),
    seo_description: formText(formData.get("seo_description")),
  };
}

type Db = ReturnType<typeof adminDb>;

async function slugTaken(db: Db, slug: string, ignoreId?: string): Promise<boolean> {
  let query = db.from("categories").select("id").eq("slug", slug);
  if (ignoreId) query = query.neq("id", ignoreId);
  const { data } = await query.maybeSingle();
  return Boolean(data);
}

/** Walk the parent chain to reject cycles (max 25 hops, then fail safe). */
async function createsCycle(db: Db, id: string | null, parentId: string | null): Promise<boolean> {
  if (!parentId) return false;
  if (id && parentId === id) return true;
  let current: string | null = parentId;
  for (let i = 0; i < 25; i++) {
    if (current === id) return true;
    const { data } = await db.from("categories").select("parent_id").eq("id", current).maybeSingle();
    if (!data) return false;
    current = data.parent_id as string | null;
    if (!current) return false;
  }
  return true; // chain too deep — refuse rather than risk a cycle
}

async function validateRefs(
  db: Db,
  sportId: string | null,
  parentId: string | null,
  selfId: string | null,
): Promise<string | null> {
  if (sportId) {
    const { data } = await db.from("sports").select("id").eq("id", sportId).is("deleted_at", null).maybeSingle();
    if (!data) return "The selected sport no longer exists.";
  }
  if (parentId) {
    const { data } = await db.from("categories").select("id").eq("id", parentId).is("deleted_at", null).maybeSingle();
    if (!data) return "The selected parent category no longer exists.";
    if (await createsCycle(db, selfId, parentId)) return "That parent would create a loop. Pick another.";
  }
  return null;
}

export async function createCategory(
  _prev: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return { error: "Sign in required." };
  }

  const parsed = categoryInput.safeParse(formValues(formData));
  if (!parsed.success) {
    return { error: "Check the highlighted fields.", fieldErrors: toFieldErrors(parsed.error) };
  }

  const db = adminDb();
  const refError = await validateRefs(db, parsed.data.sport_id, parsed.data.parent_id, null);
  if (refError) return { error: refError };
  if (await slugTaken(db, parsed.data.slug)) {
    return { error: "That slug is already in use.", fieldErrors: { slug: ["This slug is already in use."] } };
  }

  const { data, error } = await db.from("categories").insert(parsed.data).select("id").single();
  if (error || !data) {
    logger.error("category create failed", { error: error?.message });
    return { error: "Could not save the category. Try again." };
  }

  await writeAudit({ actor: admin.userId, action: "category.create", entity: "categories", entityId: data.id, meta: { name: parsed.data.name } });
  revalidatePath("/admin/categories");
  redirect("/admin/categories");
}

export async function updateCategory(
  id: string,
  _prev: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return { error: "Sign in required." };
  }
  if (!z.string().uuid().safeParse(id).success) return { error: "Invalid category." };

  const parsed = categoryInput.safeParse(formValues(formData));
  if (!parsed.success) {
    return { error: "Check the highlighted fields.", fieldErrors: toFieldErrors(parsed.error) };
  }

  const db = adminDb();
  const refError = await validateRefs(db, parsed.data.sport_id, parsed.data.parent_id, id);
  if (refError) return { error: refError };
  if (await slugTaken(db, parsed.data.slug, id)) {
    return { error: "That slug is already in use.", fieldErrors: { slug: ["This slug is already in use."] } };
  }

  const { error } = await db.from("categories").update(parsed.data).eq("id", id).is("deleted_at", null);
  if (error) {
    logger.error("category update failed", { error: error.message });
    return { error: "Could not save the category. Try again." };
  }

  await writeAudit({ actor: admin.userId, action: "category.update", entity: "categories", entityId: id, meta: { name: parsed.data.name } });
  revalidatePath("/admin/categories");
  redirect("/admin/categories");
}

async function setArchived(id: string, archived: boolean): Promise<ConfirmState> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return { error: "Sign in required." };
  }
  if (!z.string().uuid().safeParse(id).success) return { error: "Invalid category." };

  const db = adminDb();
  const { error } = await db
    .from("categories")
    .update({ deleted_at: archived ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) {
    logger.error("category archive failed", { error: error.message });
    return { error: "Could not update the category. Try again." };
  }

  await writeAudit({ actor: admin.userId, action: archived ? "category.archive" : "category.restore", entity: "categories", entityId: id });
  revalidatePath("/admin/categories");
  redirect("/admin/categories");
}

export async function archiveCategory(_prev: ConfirmState, formData: FormData): Promise<ConfirmState> {
  return setArchived(String(formData.get("id") ?? ""), true);
}

export async function restoreCategory(_prev: ConfirmState, formData: FormData): Promise<ConfirmState> {
  return setArchived(String(formData.get("id") ?? ""), false);
}
