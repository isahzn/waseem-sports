import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
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
    admin = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
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
