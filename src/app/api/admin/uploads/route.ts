import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/requireAdmin";
import { checkRateLimit, clientIp } from "@/lib/security/ratelimit";
import { writeAudit } from "@/lib/catalog/audit";
import { storeProcessedImage, MAX_BYTES } from "@/lib/uploads/store";

export const runtime = "nodejs";
export const maxDuration = 60;

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * POST /api/admin/uploads — multipart: file, product_id, alt_text?.
 * Hardened per SECURITY.md §10: admin-only, rate-limited, magic-byte check,
 * size + dimension caps, sharp re-encode (strips payloads/EXIF), random names.
 * The pipeline itself lives in `lib/uploads/store.ts`, shared with the
 * Phase 09 import path so uploads and imports behave identically.
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
  const altText = String(form.get("alt_text") ?? "");
  if (!(file instanceof File)) return fail("No file provided.", 400);
  if (!/^[0-9a-f-]{36}$/i.test(productId)) return fail("Invalid product.", 400);
  if (file.size === 0) return fail("Empty file.", 400);
  if (file.size > MAX_BYTES) return fail("File too large (max 10 MB).", 413);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const stored = await storeProcessedImage(bytes, { productId, altText });
  if (!stored.ok) return fail(stored.error, stored.status);

  await writeAudit({ actor: admin.userId, action: "image.upload", entity: "product_images", entityId: stored.id, meta: { productId, kind: stored.kind } });
  return NextResponse.json({ id: stored.id, storage_path: stored.storage_path }, { status: 201 });
}
