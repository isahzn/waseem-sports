import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import sharp from "sharp";
import { requireAdmin, AuthError } from "@/lib/auth/requireAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, clientIp } from "@/lib/security/ratelimit";
import { writeAudit } from "@/lib/catalog/audit";
import { logger } from "@/lib/security/logger";

export const runtime = "nodejs";
export const maxDuration = 60;

const BUCKET = "product-media";
const MASTER = 1600;
const THUMB = 400;

const rectSchema = z.object({
  id: z.string().uuid(),
  // Normalised 1:1 square against the CURRENT derivative (0–1). The editor
  // clamps to the visible frame, so the server re-clamps defensively.
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  size: z.number().min(0.05).max(1),
});

function thumbPath(path: string): string {
  const dot = path.lastIndexOf(".");
  if (dot < 0) return `${path}-thumb`;
  return `${path.slice(0, dot)}-thumb${path.slice(dot)}`;
}

/**
 * POST /api/admin/images/crop — re-crop a product photo (D20, manual-first).
 * Applies the owner's 1:1 recipe to the stored derivative, writes NEW
 * immutable paths, updates the row, deletes the old files. Originals are not
 * retained in this version (see docs/EXTRACTED-PHOTOS.md limitation) — the
 * crop source is the 1600px derivative, which is ample for card/PDP use.
 */
export async function POST(request: NextRequest) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (err) {
    return NextResponse.json({ error: "Forbidden." }, { status: err instanceof AuthError ? err.status : 403 });
  }

  const ip = clientIp(request.headers);
  const { allowed } = await checkRateLimit(`crop:${ip}`, 30);
  if (!allowed) return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = rectSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid crop." }, { status: 422 });
  const { id, x, y, size } = parsed.data;

  const supabase = createAdminClient();
  const { data: row } = await supabase
    .from("product_images")
    .select("id,product_id,storage_path")
    .eq("id", id)
    .single();
  if (!row) return NextResponse.json({ error: "Image not found." }, { status: 404 });

  const { data: file, error: dlErr } = await supabase.storage.from(BUCKET).download(row.storage_path);
  if (dlErr || !file) {
    logger.error("crop download failed", { error: dlErr?.message });
    return NextResponse.json({ error: "Could not read the image." }, { status: 500 });
  }
  const src = Buffer.from(await file.arrayBuffer());
  const meta = await sharp(src).metadata().catch(() => null);
  if (!meta?.width || !meta?.height) {
    return NextResponse.json({ error: "Could not read the image." }, { status: 422 });
  }

  // Normalised → pixels, clamped inside the frame.
  const px = Math.max(0, Math.min(meta.width - 1, Math.round(x * meta.width)));
  const py = Math.max(0, Math.min(meta.height - 1, Math.round(y * meta.height)));
  const edge = Math.max(8, Math.min(meta.width - px, meta.height - py, Math.round(size * Math.min(meta.width, meta.height))));

  let derived: Buffer;
  let thumb: Buffer;
  try {
    const base = sharp(src).extract({ left: px, top: py, width: edge, height: edge });
    derived = await base.clone().resize(MASTER, MASTER, { fit: "cover" }).webp({ quality: 82 }).toBuffer();
    thumb = await base.clone().resize(THUMB, THUMB, { fit: "cover" }).webp({ quality: 75 }).toBuffer();
  } catch (err) {
    logger.error("crop failed", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Could not apply the crop." }, { status: 422 });
  }

  const name = randomUUID();
  const storagePath = `products/${name}.webp`;
  const thumbnailPath = `products/${name}-thumb.webp`;
  const storage = supabase.storage.from(BUCKET);
  const { error: upErr } = await storage.upload(storagePath, derived, { contentType: "image/webp", upsert: false });
  if (upErr) {
    logger.error("crop upload failed", { error: upErr.message });
    return NextResponse.json({ error: "Could not store the image." }, { status: 500 });
  }
  const { error: thErr } = await storage.upload(thumbnailPath, thumb, { contentType: "image/webp", upsert: false });
  if (thErr) {
    await storage.remove([storagePath]);
    return NextResponse.json({ error: "Could not store the image." }, { status: 500 });
  }

  const { error: rowErr } = await supabase.from("product_images").update({ storage_path: storagePath }).eq("id", id);
  if (rowErr) {
    await storage.remove([storagePath, thumbnailPath]);
    logger.error("crop row update failed", { error: rowErr.message });
    return NextResponse.json({ error: "Could not save the crop." }, { status: 500 });
  }
  // Old files go last: the row is already correct, cleanup is best-effort.
  await storage.remove([row.storage_path, thumbPath(row.storage_path)]);

  await writeAudit({ actor: admin.userId, action: "image.crop", entity: "product_images", entityId: id, meta: { rect: { x, y, size } } });
  revalidatePath(`/admin/products/${row.product_id}`);
  return NextResponse.json({ storage_path: storagePath });
}
