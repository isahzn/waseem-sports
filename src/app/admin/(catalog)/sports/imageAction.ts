"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { adminDb, requireAdmin } from "@/lib/auth/requireAdmin";
import { writeAudit } from "@/lib/catalog/audit";
import { checkRateLimit, clientIp } from "@/lib/security/ratelimit";
import { logger } from "@/lib/security/logger";
import { discardStoredImage, storeSportImage } from "@/lib/uploads/taxonomy-image";
import type { SportImageState } from "./SportImageField";

const uuid = z.string().uuid();

const MAX_LABEL = 300;

/**
 * Sport tile photo: upload, replace, remove.
 *
 * The tile is what a shopper sees first for a sport, so the owner needs to
 * change it without a developer. Hardening lives in `lib/uploads/taxonomy-image`
 * (same magic-byte + sharp re-encode rules as product photos); this action only
 * authorises, rate-limits, saves the path and audits.
 */

async function actor() {
  try {
    return await requireAdmin();
  } catch {
    return null;
  }
}

function revalidate(sportId: string) {
  revalidatePath("/admin/sports");
  revalidatePath(`/admin/sports/${sportId}`);
  revalidatePath("/");
}

export async function uploadSportImage(
  _prev: SportImageState,
  formData: FormData,
): Promise<SportImageState> {
  const admin = await actor();
  if (!admin) return { error: "Sign in required." };

  const sportId = String(formData.get("sport_id") ?? "");
  if (!uuid.safeParse(sportId).success) return { error: "Invalid sport." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an image first." };

  const ip = clientIp(await headers());
  const { allowed } = await checkRateLimit(`upload:${ip}`, 30);
  if (!allowed) return { error: "Too many uploads. Try again later." };

  const db = adminDb();
  const { data: current } = await db.from("sports").select("image_path").eq("id", sportId).single();
  if (!current) return { error: "Invalid sport." };

  const stored = await storeSportImage(new Uint8Array(await file.arrayBuffer()));
  if (!stored.ok) return { error: stored.error };

  const altText = String(formData.get("image_alt") ?? "").trim().slice(0, MAX_LABEL);
  const { error } = await db
    .from("sports")
    .update({
      image_path: stored.storage_path,
      ...(altText ? { image_alt: altText } : {}),
    })
    .eq("id", sportId);
  if (error) {
    logger.error("sport image row failed", { error: error.message });
    await discardStoredImage(stored.storage_path);
    return { error: "Could not save the image. Try again." };
  }

  // The previous tile photo is unreachable from the storefront now; drop it so
  // replaced images do not pile up in storage.
  if (current.image_path && current.image_path !== stored.storage_path) {
    await discardStoredImage(current.image_path);
  }

  await writeAudit({
    actor: admin.userId,
    action: "sport.image.upload",
    entity: "sports",
    entityId: sportId,
  });
  revalidate(sportId);
  return { ok: true };
}

export async function removeSportImage(
  _prev: SportImageState,
  formData: FormData,
): Promise<SportImageState> {
  const admin = await actor();
  if (!admin) return { error: "Sign in required." };

  const sportId = String(formData.get("sport_id") ?? "");
  if (!uuid.safeParse(sportId).success) return { error: "Invalid sport." };

  const db = adminDb();
  const { data: current } = await db.from("sports").select("image_path").eq("id", sportId).single();
  if (!current) return { error: "Invalid sport." };

  const { error } = await db
    .from("sports")
    .update({ image_path: null })
    .eq("id", sportId);
  if (error) {
    logger.error("sport image clear failed", { error: error.message });
    return { error: "Could not remove the image. Try again." };
  }

  await discardStoredImage(current.image_path);
  await writeAudit({
    actor: admin.userId,
    action: "sport.image.remove",
    entity: "sports",
    entityId: sportId,
  });
  revalidate(sportId);
  return { ok: true };
}
