import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireAdmin } from "@/lib/auth/requireAdmin";
import { confirmTransfer } from "@/lib/transfers/service";
import { logger } from "@/lib/security/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/transfers/:id/confirm — explicit approval + execution.
 * Body: { idempotency_key, confirm: true }. The key must match the row;
 * replays/double-clicks return the same row — never a second transfer.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  let admin;
  try {
    // Executing money movement: owner-only (SECURITY.md §2).
    admin = await requireAdmin(["owner"]);
  } catch (err) {
    const status = err instanceof AuthError ? err.status : 401;
    return NextResponse.json({ error: status === 403 ? "Forbidden." : "Sign in required." }, { status });
  }
  const { id } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const payload = { ...(typeof body === "object" && body !== null ? body : {}), id };
  const { row, error } = await confirmTransfer(payload, { headers: request.headers, actor: admin.userId });
  if (error || !row) {
    if (error && error.status >= 500) logger.error("POST transfer confirm failed", { id });
    return NextResponse.json({ error: error?.message ?? "Could not confirm the transfer." }, { status: error?.status ?? 500 });
  }
  return NextResponse.json({ ok: true, transfer: row });
}
