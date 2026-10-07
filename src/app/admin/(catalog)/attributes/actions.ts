"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/catalog/audit";
import {
  attributeInput,
  formBool,
  formNumber,
  formText,
  toFieldErrors,
} from "@/lib/catalog/schemas";
import { logger } from "@/lib/security/logger";
import type { AttributeFormState } from "./AttributeForm";

const inputTypes = ["text", "number", "select", "boolean"] as const;

function formValues(formData: FormData) {
  const rawOptions = String(formData.get("options") ?? "");
  const options = rawOptions
    .split("\n")
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
  const inputType = String(formData.get("input_type") ?? "text");
  return {
    name: formText(formData.get("name")) ?? "",
    slug: formText(formData.get("slug")) ?? "",
    input_type: (inputTypes as readonly string[]).includes(inputType) ? inputType : "text",
    options,
    is_filterable: formBool(formData.get("is_filterable")),
    is_variant_option: formBool(formData.get("is_variant_option")),
    sort_order: formNumber(formData.get("sort_order")) ?? 0,
  };
}

type Db = Awaited<ReturnType<typeof createClient>>;

async function slugTaken(db: Db, slug: string, ignoreId?: string): Promise<boolean> {
  let query = db.from("attribute_definitions").select("id").eq("slug", slug);
  if (ignoreId) query = query.neq("id", ignoreId);
  const { data } = await query.maybeSingle();
  return Boolean(data);
}

export async function createAttribute(
  _prev: AttributeFormState,
  formData: FormData,
): Promise<AttributeFormState> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return { error: "Sign in required." };
  }

  const parsed = attributeInput.safeParse(formValues(formData));
  if (!parsed.success) {
    return { error: "Check the highlighted fields.", fieldErrors: toFieldErrors(parsed.error) };
  }

  const db = await createClient();
  if (await slugTaken(db, parsed.data.slug)) {
    return { error: "That slug is already in use.", fieldErrors: { slug: ["This slug is already in use."] } };
  }

  const { data, error } = await db.from("attribute_definitions").insert(parsed.data).select("id").single();
  if (error || !data) {
    logger.error("attribute create failed", { error: error?.message });
    return { error: "Could not save the attribute. Try again." };
  }

  await writeAudit({ actor: admin.userId, action: "attribute.create", entity: "attribute_definitions", entityId: data.id, meta: { name: parsed.data.name } });
  revalidatePath("/admin/attributes");
  redirect("/admin/attributes");
}

export async function updateAttribute(
  id: string,
  _prev: AttributeFormState,
  formData: FormData,
): Promise<AttributeFormState> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return { error: "Sign in required." };
  }
  if (!z.string().uuid().safeParse(id).success) return { error: "Invalid attribute." };

  const parsed = attributeInput.safeParse(formValues(formData));
  if (!parsed.success) {
    return { error: "Check the highlighted fields.", fieldErrors: toFieldErrors(parsed.error) };
  }

  const db = await createClient();
  if (await slugTaken(db, parsed.data.slug, id)) {
    return { error: "That slug is already in use.", fieldErrors: { slug: ["This slug is already in use."] } };
  }

  // Guard: attribute in use as a variant dimension or on products cannot change type.
  const { data: existing } = await db.from("attribute_definitions").select("input_type").eq("id", id).single();
  if (existing && existing.input_type !== parsed.data.input_type) {
    const [vals, variants] = await Promise.all([
      db.from("product_attribute_values").select("product_id").eq("attribute_id", id).limit(1),
      db.from("product_variants").select("id").limit(1),
    ]);
    const inUse =
      (vals.data?.length ?? 0) > 0 ||
      (parsed.data.is_variant_option && (variants.data?.length ?? 0) > 0 && existing.input_type === "select");
    if (inUse) {
      return { error: "This attribute is in use — its type cannot be changed. Create a new attribute instead." };
    }
  }

  const { error } = await db.from("attribute_definitions").update(parsed.data).eq("id", id);
  if (error) {
    logger.error("attribute update failed", { error: error.message });
    return { error: "Could not save the attribute. Try again." };
  }

  await writeAudit({ actor: admin.userId, action: "attribute.update", entity: "attribute_definitions", entityId: id, meta: { name: parsed.data.name } });
  revalidatePath("/admin/attributes");
  redirect("/admin/attributes");
}

export async function deleteAttribute(
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return { error: "Sign in required." };
  }
  const id = String(formData.get("id") ?? "");
  if (!z.string().uuid().safeParse(id).success) return { error: "Invalid attribute." };

  const db = await createClient();
  const { data: vals } = await db.from("product_attribute_values").select("product_id").eq("attribute_id", id).limit(1);
  if (vals && vals.length > 0) {
    return { error: "This attribute is used on products and cannot be deleted. Remove it from those products first." };
  }

  const { error } = await db.from("attribute_definitions").delete().eq("id", id);
  if (error) {
    logger.error("attribute delete failed", { error: error.message });
    return { error: "Could not delete the attribute. Try again." };
  }

  await writeAudit({ actor: admin.userId, action: "attribute.delete", entity: "attribute_definitions", entityId: id });
  revalidatePath("/admin/attributes");
  redirect("/admin/attributes");
}
