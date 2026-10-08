import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/requireAdmin";
import { searchImages } from "@/lib/imagesearch/service";
import { logger } from "@/lib/security/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/admin/image-search — { product_id }.
 * Admin-only, rate-limited, quota-guarded, cached. With no provider (D6
 * open) it returns { configured: false } — a normal state, not an error.
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
  const { outcome, error } = await searchImages(body, { headers: request.headers, actor: admin.userId });
  if (error || !outcome) {
    if (error && error.status >= 500) logger.error("POST image-search failed");
    return NextResponse.json({ error: error?.message ?? "Search failed." }, { status: error?.status ?? 500 });
  }
  return NextResponse.json({ ok: true, ...outcome });
}
