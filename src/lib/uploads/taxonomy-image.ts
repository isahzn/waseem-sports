import "server-only";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";
import { detectImageType } from "./magic";
import { logger } from "@/lib/security/logger";
import { BUCKET, MAX_BYTES, MAX_DIMENSION } from "./store";

/**
 * Image pipeline for taxonomy rows that carry a single photo (today: sports,
 * for the homepage "Shop by Sport" tiles).
 *
 * It is deliberately the same hardening as `storeProcessedImage` — magic-byte
 * check, dimension cap, sharp re-encode (which strips payloads and EXIF), a
 * random storage name — because a tile photo is uploaded through the same
 * admin form flow as a product photo and must not be a weaker door. What is
 * different is the shape: a taxonomy row holds one path in a text column, not
 * a `product_images` row with a thumbnail, so this writes one derivative and
 * hands the path back for the caller to save.
 */

const TILE_MAX = 1200; // px on the long edge — a tile never renders wider

export type TaxonomyImageResult =
  | { ok: true; storage_path: string }
  | { ok: false; error: string; status: number };

export async function storeSportImage(bytes: Uint8Array): Promise<TaxonomyImageResult> {
  if (bytes.length === 0) return { ok: false, error: "Empty file.", status: 400 };
  if (bytes.length > MAX_BYTES) return { ok: false, error: "File too large (max 10 MB).", status: 413 };

  if (!detectImageType(bytes)) {
    logger.warn("sport image rejected: bad magic bytes", { size: bytes.length });
    return { ok: false, error: "Not a supported image (JPEG, PNG, WebP, AVIF).", status: 415 };
  }

  let meta;
  try {
    meta = await sharp(bytes).metadata();
  } catch {
    return { ok: false, error: "Could not read the image.", status: 422 };
  }
  if (!meta.width || !meta.height) return { ok: false, error: "Could not read the image.", status: 422 };
  if (meta.width > MAX_DIMENSION || meta.height > MAX_DIMENSION) {
    return { ok: false, error: `Image too large (max ${MAX_DIMENSION}px per side).`, status: 413 };
  }

  let derived: Buffer;
  try {
    derived = await sharp(Buffer.from(bytes), { animated: false })
      .rotate()
      .resize({ width: TILE_MAX, height: TILE_MAX, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch (err) {
    logger.error("sport image re-encode failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, error: "Could not process the image.", status: 422 };
  }
  if (derived.length > MAX_BYTES) return { ok: false, error: "Processed image too large.", status: 413 };

  // `sports/` prefix keeps taxonomy photos out of the product image namespace,
  // so nothing that lists `products/*` picks one up.
  const storagePath = `sports/${randomUUID()}.webp`;
  const { error } = await createAdminClient()
    .storage.from(BUCKET)
    .upload(storagePath, derived, { contentType: "image/webp", upsert: false });
  if (error) {
    logger.error("sport image storage failed", { error: error.message });
    return { ok: false, error: "Could not store the image.", status: 500 };
  }

  return { ok: true, storage_path: storagePath };
}

/**
 * Best-effort removal of a replaced/cleared tile photo. A failure here leaves
 * an orphan object in storage — never a broken row — so it is logged, not
 * surfaced to the owner as an error.
 */
export async function discardStoredImage(path: string | null | undefined): Promise<void> {
  if (!path || !path.startsWith("sports/")) return;
  try {
    await createAdminClient().storage.from(BUCKET).remove([path]);
  } catch (err) {
    logger.warn("sport image cleanup failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
