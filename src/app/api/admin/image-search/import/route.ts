import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/requireAdmin";
import { importCandidate } from "@/lib/imagesearch/service";
import { logger } from "@/lib/security/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/admin/image-search/import — { product_id, image_url, page_url,
 * acknowledge_rights: true }. SSRF-guarded fetch into the shared pipeline
 * with provenance recorded. The rights checkbox is mandatory.
 */
export async function POST(request: NextRequest) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (err) {
    return NextResponse.json({ error: "Forbidden." }, { status: err instanceof AuthError ? err.status : 403 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { id, storage_path, error } = await importCandidate(body, { headers: request.headers, actor: admin.userId });
  if (error || !id) {
    if (error && error.status >= 500) logger.error("POST image-search import failed");
    return NextResponse.json({ error: error?.message ?? "Import failed." }, { status: error?.status ?? 500 });
  }
  return NextResponse.json({ ok: true, id, storage_path }, { status: 201 });
}
