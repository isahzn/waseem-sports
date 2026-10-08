import "server-only";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";
import { detectImageType } from "./magic";
import { logger } from "@/lib/security/logger";

/**
 * Shared image pipeline (uploads route + Phase 09 imports — one code path,
 * per the Phase 09 amendment). Bytes in: magic-byte check, dimension caps,
 * sharp re-encode (strips payloads/EXIF, sRGB WebP + thumbnail), storage
 * upload, `product_images` row with optional import provenance.
 */

export const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_DIMENSION = 6000; // px — rejected, not downscaled
const DERIVATIVE_MAX = 1600; // px on the long edge
const THUMB_SIZE = 400;
export const BUCKET = "product-media";

export type ImageProvenance = {
  source_url?: string | null;
  source_note?: string | null;
  license_note?: string | null;
};

export type StoreResult =
  | { ok: true; id: string; storage_path: string; kind: string }
  | { ok: false; error: string; status: number };

export async function storeProcessedImage(
  bytes: Uint8Array,
  opts: { productId: string; altText?: string; provenance?: ImageProvenance },
): Promise<StoreResult> {
  if (bytes.length === 0) return { ok: false, error: "Empty file.", status: 400 };
  if (bytes.length > MAX_BYTES) return { ok: false, error: "File too large (max 10 MB).", status: 413 };

  const kind = detectImageType(bytes);
  if (!kind) {
    logger.warn("image rejected: bad magic bytes", { size: bytes.length });
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

  const name = randomUUID();
  const storagePath = `products/${name}.webp`;
  const thumbnailPath = `products/${name}-thumb.webp`;

  let derived: Buffer;
  let thumb: Buffer;
  try {
    const pipeline = sharp(Buffer.from(bytes), { animated: false }).rotate().resize({
      width: DERIVATIVE_MAX,
      height: DERIVATIVE_MAX,
      fit: "inside",
      withoutEnlargement: true,
    });
    derived = await pipeline.clone().webp({ quality: 82 }).toBuffer();
    thumb = await pipeline.clone().resize({ width: THUMB_SIZE, height: THUMB_SIZE, fit: "inside", withoutEnlargement: true }).webp({ quality: 75 }).toBuffer();
  } catch (err) {
    logger.error("image re-encode failed", { error: err instanceof Error ? err.message : String(err) });
    return { ok: false, error: "Could not process the image.", status: 422 };
  }
  if (derived.length > MAX_BYTES || thumb.length > MAX_BYTES) {
    return { ok: false, error: "Processed image too large.", status: 413 };
  }

  const supabase = createAdminClient();
  const storage = supabase.storage.from(BUCKET);
  const { error: upErr } = await storage.upload(storagePath, derived, { contentType: "image/webp", upsert: false });
  if (upErr) {
    logger.error("image storage failed", { error: upErr.message });
    return { ok: false, error: "Could not store the image.", status: 500 };
  }
  const { error: thErr } = await storage.upload(thumbnailPath, thumb, { contentType: "image/webp", upsert: false });
  if (thErr) {
    await storage.remove([storagePath]);
    logger.error("image thumbnail failed", { error: thErr.message });
    return { ok: false, error: "Could not store the image.", status: 500 };
  }

  const { data: existing } = await supabase
    .from("product_images")
    .select("id,sort_order")
    .eq("product_id", opts.productId)
    .order("sort_order", { ascending: false })
    .limit(1);
  const nextSort = existing && existing.length > 0 ? (existing[0].sort_order ?? 0) + 1 : 0;

  const { data: row, error: rowErr } = await supabase
    .from("product_images")
    .insert({
      product_id: opts.productId,
      storage_path: storagePath,
      alt_text: opts.altText?.trim().slice(0, 300) || null,
      sort_order: nextSort,
      is_primary: (existing?.length ?? 0) === 0,
      source_url: opts.provenance?.source_url ?? null,
      source_note: opts.provenance?.source_note ?? null,
      license_note: opts.provenance?.license_note ?? null,
    })
    .select("id")
    .single();
  if (rowErr || !row) {
    await storage.remove([storagePath, thumbnailPath]);
    logger.error("image row failed", { error: rowErr?.message });
    return { ok: false, error: "Could not save the image record.", status: 500 };
  }
  return { ok: true, id: row.id, storage_path: storagePath, kind };
}
