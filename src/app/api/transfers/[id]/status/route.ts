import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { verifyTransfer } from "@/lib/transfers/service";
import { logger } from "@/lib/security/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/transfers/:id/status — re-query the provider and settle
 * PROCESSING transfers. Read-only for terminal states.
 */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const { id } = await context.params;
  const { row, error } = await verifyTransfer(id, admin.userId);
  if (error || !row) {
    if (error && error.status >= 500) logger.error("GET transfer status failed", { id });
    return NextResponse.json({ error: error?.message ?? "Transfer not found." }, { status: error?.status ?? 404 });
  }
  return NextResponse.json({ ok: true, transfer: row });
}
