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
  sportInput,
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
    image_alt: formText(formData.get("imageAlt")),
    seo_title: formText(formData.get("seo_title")),
    seo_description: formText(formData.get("seo_description")),
  };
}

async function slugTaken(
  db: Awaited<ReturnType<typeof createClient>>,
  slug: string,
  ignoreId?: string,
): Promise<boolean> {
  let query = db.from("sports").select("id").eq("slug", slug);
  if (ignoreId) query = query.neq("id", ignoreId);
  const { data } = await query.maybeSingle();
  return Boolean(data);
}

export async function createSport(
  _prev: TaxonomyFormState,
  formData: FormData,
): Promise<TaxonomyFormState> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return { error: "Sign in required." };
  }

  const parsed = sportInput.safeParse(formValues(formData));
  if (!parsed.success) {
    return { error: "Check the highlighted fields.", fieldErrors: toFieldErrors(parsed.error) };
  }

  const db = await createClient();
  if (await slugTaken(db, parsed.data.slug)) {
    return { error: "That slug is already in use.", fieldErrors: { slug: ["This slug is already in use."] } };
  }

  const { data, error } = await db.from("sports").insert(parsed.data).select("id").single();
  if (error || !data) {
    logger.error("sport create failed", { error: error?.message });
    return { error: "Could not save the sport. Try again." };
  }

  await writeAudit({
    actor: admin.userId,
    action: "sport.create",
    entity: "sports",
    entityId: data.id,
    meta: { name: parsed.data.name },
  });
  revalidatePath("/admin/sports");
  redirect("/admin/sports");
}

export async function updateSport(
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
  if (!z.string().uuid().safeParse(id).success) return { error: "Invalid sport." };

  const parsed = sportInput.safeParse(formValues(formData));
  if (!parsed.success) {
    return { error: "Check the highlighted fields.", fieldErrors: toFieldErrors(parsed.error) };
  }

  const db = await createClient();
  if (await slugTaken(db, parsed.data.slug, id)) {
    return { error: "That slug is already in use.", fieldErrors: { slug: ["This slug is already in use."] } };
  }

  const { error } = await db.from("sports").update(parsed.data).eq("id", id).is("deleted_at", null);
  if (error) {
    logger.error("sport update failed", { error: error.message });
    return { error: "Could not save the sport. Try again." };
  }

  await writeAudit({
    actor: admin.userId,
    action: "sport.update",
    entity: "sports",
    entityId: id,
    meta: { name: parsed.data.name },
  });
  revalidatePath("/admin/sports");
  redirect("/admin/sports");
}

async function setArchived(id: string, archived: boolean): Promise<ConfirmState> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return { error: "Sign in required." };
  }
  if (!z.string().uuid().safeParse(id).success) return { error: "Invalid sport." };

  const db = await createClient();
  const { error } = await db
    .from("sports")
    .update({ deleted_at: archived ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) {
    logger.error("sport archive failed", { error: error.message });
    return { error: "Could not update the sport. Try again." };
  }

  await writeAudit({
    actor: admin.userId,
    action: archived ? "sport.archive" : "sport.restore",
    entity: "sports",
    entityId: id,
  });
  revalidatePath("/admin/sports");
  redirect("/admin/sports");
}

export async function archiveSport(_prev: ConfirmState, formData: FormData): Promise<ConfirmState> {
  return setArchived(String(formData.get("id") ?? ""), true);
}

export async function restoreSport(_prev: ConfirmState, formData: FormData): Promise<ConfirmState> {
  return setArchived(String(formData.get("id") ?? ""), false);
}
