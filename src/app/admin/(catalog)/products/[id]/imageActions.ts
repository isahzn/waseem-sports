"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/catalog/audit";
import { logger } from "@/lib/security/logger";

const uuid = z.string().uuid();

/** Make one image the product's primary (unset the rest first). */
export async function setPrimaryImage(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const productId = String(formData.get("product_id") ?? "");
  if (!uuid.safeParse(id).success || !uuid.safeParse(productId).success) return;

  const db = await createClient();
  const { error: clearErr } = await db.from("product_images").update({ is_primary: false }).eq("product_id", productId);
  if (clearErr) {
    logger.error("image primary clear failed", { error: clearErr.message });
    return;
  }
  const { error } = await db.from("product_images").update({ is_primary: true }).eq("id", id).eq("product_id", productId);
  if (error) logger.error("image primary set failed", { error: error.message });
  else await writeAudit({ actor: admin.userId, action: "image.primary", entity: "product_images", entityId: id });

  revalidatePath(`/admin/products/${productId}`);
}

/** Delete an image row + both stored files (derived + thumbnail). */
export async function deleteImage(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const productId = String(formData.get("product_id") ?? "");
  if (!uuid.safeParse(id).success || !uuid.safeParse(productId).success) return;

  const db = await createClient();
  const { data: img } = await db.from("product_images").select("storage_path").eq("id", id).eq("product_id", productId).single();
  if (!img) return;

  const { error } = await db.from("product_images").delete().eq("id", id);
  if (error) {
    logger.error("image delete failed", { error: error.message });
    return;
  }

  // Storage cleanup is best-effort: the DB row is the source of truth.
  try {
    const storage = createAdminClient().storage.from("product-media");
    await storage.remove([img.storage_path, thumbPath(img.storage_path)]);
  } catch (err) {
    logger.error("image storage cleanup failed", { error: err instanceof Error ? err.message : String(err) });
  }

  await writeAudit({ actor: admin.userId, action: "image.delete", entity: "product_images", entityId: id });
  revalidatePath(`/admin/products/${productId}`);
  redirect(`/admin/products/${productId}`);
}

function thumbPath(path: string): string {
  const dot = path.lastIndexOf(".");
  if (dot < 0) return `${path}-thumb`;
  return `${path.slice(0, dot)}-thumb${path.slice(dot)}`;
}
