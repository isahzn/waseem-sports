import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { requireAdmin, AuthError } from "@/lib/auth/requireAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, clientIp } from "@/lib/security/ratelimit";
import { writeAudit } from "@/lib/catalog/audit";
import { detectImageType } from "@/lib/uploads/magic";
import { logger } from "@/lib/security/logger";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_DIMENSION = 6000; // px — above this is rejected, not downscaled
const DERIVATIVE_MAX = 1600; // px on the long edge
const THUMB_SIZE = 400; // px square-ish (fit inside)
const BUCKET = "product-media";

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * POST /api/admin/uploads — multipart: file, product_id, alt_text?.
 * Hardened per SECURITY.md §10: admin-only, rate-limited, magic-byte check,
 * size + dimension caps, sharp re-encode (strips payloads/EXIF), random names.
 */
export async function POST(request: NextRequest) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (err) {
    const status = err instanceof AuthError ? err.status : 403;
    return fail("Forbidden.", status);
  }

  const ip = clientIp(request.headers);
  const { allowed } = await checkRateLimit(`upload:${ip}`, 30);
  if (!allowed) return fail("Too many uploads. Try again later.", 429);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("Invalid upload.", 400);
  }

  const file = form.get("file");
  const productId = String(form.get("product_id") ?? "");
  const altText = String(form.get("alt_text") ?? "").trim().slice(0, 300);
  if (!(file instanceof File)) return fail("No file provided.", 400);
  if (!/^[0-9a-f-]{36}$/i.test(productId)) return fail("Invalid product.", 400);
  if (file.size === 0) return fail("Empty file.", 400);
  if (file.size > MAX_BYTES) return fail("File too large (max 10 MB).", 413);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = detectImageType(bytes);
  if (!kind) {
    logger.warn("upload rejected: bad magic bytes", { size: file.size });
    return fail("Not a supported image (JPEG, PNG, WebP, AVIF).", 415);
  }

  // Re-encode via sharp: strips embedded payloads/EXIF, normalises to sRGB
  // WebP. Metadata check first so giant dimensions are rejected, not processed.
  let meta;
  try {
    meta = await sharp(bytes).metadata();
  } catch {
    return fail("Could not read the image.", 422);
  }
  if (!meta.width || !meta.height) return fail("Could not read the image.", 422);
  if (meta.width > MAX_DIMENSION || meta.height > MAX_DIMENSION) {
    return fail(`Image too large (max ${MAX_DIMENSION}px per side).`, 413);
  }

  const name = randomUUID();
  const storagePath = `products/${name}.webp`;
  const thumbnailPath = `products/${name}-thumb.webp`;

  let derived: Buffer;
  let thumb: Buffer;
  try {
    const pipeline = sharp(bytes, { animated: false }).rotate().resize({
      width: DERIVATIVE_MAX,
      height: DERIVATIVE_MAX,
      fit: "inside",
      withoutEnlargement: true,
    });
    derived = await pipeline.clone().webp({ quality: 82 }).toBuffer();
    thumb = await pipeline.clone().resize({ width: THUMB_SIZE, height: THUMB_SIZE, fit: "inside", withoutEnlargement: true }).webp({ quality: 75 }).toBuffer();
  } catch (err) {
    logger.error("upload re-encode failed", { error: err instanceof Error ? err.message : String(err) });
    return fail("Could not process the image.", 422);
  }
  // Deterministic save-time derivatives per the image-pipeline spec amendment.
  if (derived.length > MAX_BYTES || thumb.length > MAX_BYTES) {
    return fail("Processed image too large.", 413);
  }

  const supabase = createAdminClient();
  const storage = supabase.storage.from(BUCKET);
  const { error: upErr } = await storage.upload(storagePath, derived, {
    contentType: "image/webp",
    upsert: false,
  });
  if (upErr) {
    logger.error("upload storage failed", { error: upErr.message });
    return fail("Could not store the image.", 500);
  }
  const { error: thErr } = await storage.upload(thumbnailPath, thumb, {
    contentType: "image/webp",
    upsert: false,
  });
  if (thErr) {
    await storage.remove([storagePath]);
    logger.error("upload thumbnail failed", { error: thErr.message });
    return fail("Could not store the image.", 500);
  }

  // Next sort position; first image of the product becomes primary.
  const { data: existing } = await supabase
    .from("product_images")
    .select("id,sort_order")
    .eq("product_id", productId)
    .order("sort_order", { ascending: false })
    .limit(1);
  const nextSort = existing && existing.length > 0 ? (existing[0].sort_order ?? 0) + 1 : 0;

  const { data: row, error: rowErr } = await supabase
    .from("product_images")
    .insert({
      product_id: productId,
      storage_path: storagePath,
      alt_text: altText || null,
      sort_order: nextSort,
      is_primary: (existing?.length ?? 0) === 0,
    })
    .select("id")
    .single();
  if (rowErr || !row) {
    await storage.remove([storagePath, thumbnailPath]);
    logger.error("upload row failed", { error: rowErr?.message });
    return fail("Could not save the image record.", 500);
  }

  await writeAudit({ actor: admin.userId, action: "image.upload", entity: "product_images", entityId: row.id, meta: { productId, kind } });
  return NextResponse.json({ id: row.id, storage_path: storagePath }, { status: 201 });
}
