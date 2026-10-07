"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { adminDb, requireAdmin } from "@/lib/auth/requireAdmin";
import { writeAudit } from "@/lib/catalog/audit";
import {
  brandInput,
  formBool,
  formNumber,
  formText,
  toFieldErrors,
} from "@/lib/catalog/schemas";
import { logger } from "@/lib/security/logger";
import type { ConfirmState } from "../_components/ConfirmSubmit";
import type { TaxonomyFormState } from "../_components/TaxonomyForm";

function formValues(formData: FormData) {
  return {
    name: formText(formData.get("name")) ?? "",
    slug: formText(formData.get("slug")) ?? "",
    description: formText(formData.get("description")),
    is_visible: formBool(formData.get("is_visible")),
    is_featured: formBool(formData.get("is_featured")),
    sort_order: formNumber(formData.get("sort_order")) ?? 0,
    logo_alt: formText(formData.get("imageAlt")),
  };
}

async function slugTaken(
  db: ReturnType<typeof adminDb>,
  slug: string,
  ignoreId?: string,
): Promise<boolean> {
  let query = db.from("brands").select("id").eq("slug", slug);
  if (ignoreId) query = query.neq("id", ignoreId);
  const { data } = await query.maybeSingle();
  return Boolean(data);
}

export async function createBrand(
  _prev: TaxonomyFormState,
  formData: FormData,
): Promise<TaxonomyFormState> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return { error: "Sign in required." };
  }

  const parsed = brandInput.safeParse(formValues(formData));
  if (!parsed.success) {
    return { error: "Check the highlighted fields.", fieldErrors: toFieldErrors(parsed.error) };
  }

  const db = adminDb();
  if (await slugTaken(db, parsed.data.slug)) {
    return { error: "That slug is already in use.", fieldErrors: { slug: ["This slug is already in use."] } };
  }

  const { data, error } = await db.from("brands").insert(parsed.data).select("id").single();
  if (error || !data) {
    logger.error("brand create failed", { error: error?.message });
    return { error: "Could not save the brand. Try again." };
  }

  await writeAudit({
    actor: admin.userId,
    action: "brand.create",
    entity: "brands",
    entityId: data.id,
    meta: { name: parsed.data.name },
  });
  revalidatePath("/admin/brands");
  redirect("/admin/brands");
}

export async function updateBrand(
  id: string,
  _prev: TaxonomyFormState,
  formData: FormData,
): Promise<TaxonomyFormState> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return { error: "Sign in required." };
  }
  if (!z.string().uuid().safeParse(id).success) return { error: "Invalid brand." };

  const parsed = brandInput.safeParse(formValues(formData));
  if (!parsed.success) {
    return { error: "Check the highlighted fields.", fieldErrors: toFieldErrors(parsed.error) };
  }

  const db = adminDb();
  if (await slugTaken(db, parsed.data.slug, id)) {
    return { error: "That slug is already in use.", fieldErrors: { slug: ["This slug is already in use."] } };
  }

  const { error } = await db.from("brands").update(parsed.data).eq("id", id).is("deleted_at", null);
  if (error) {
    logger.error("brand update failed", { error: error.message });
    return { error: "Could not save the brand. Try again." };
  }

  await writeAudit({
    actor: admin.userId,
    action: "brand.update",
    entity: "brands",
    entityId: id,
    meta: { name: parsed.data.name },
  });
  revalidatePath("/admin/brands");
  redirect("/admin/brands");
}

async function setArchived(id: string, archived: boolean): Promise<ConfirmState> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return { error: "Sign in required." };
  }
  if (!z.string().uuid().safeParse(id).success) return { error: "Invalid brand." };

  const db = adminDb();
  const { error } = await db
    .from("brands")
    .update({ deleted_at: archived ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) {
    logger.error("brand archive failed", { error: error.message });
    return { error: "Could not update the brand. Try again." };
  }

  await writeAudit({
    actor: admin.userId,
    action: archived ? "brand.archive" : "brand.restore",
    entity: "brands",
    entityId: id,
  });
  revalidatePath("/admin/brands");
  redirect("/admin/brands");
}

export async function archiveBrand(_prev: ConfirmState, formData: FormData): Promise<ConfirmState> {
  return setArchived(String(formData.get("id") ?? ""), true);
}

export async function restoreBrand(_prev: ConfirmState, formData: FormData): Promise<ConfirmState> {
  return setArchived(String(formData.get("id") ?? ""), false);
}
