import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireAdmin } from "@/lib/auth/requireAdmin";
import { createTransfer, listTransfers } from "@/lib/transfers/service";
import { logger } from "@/lib/security/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/transfers — create a PENDING_APPROVAL transfer.
 * Never executes: execution needs POST /:id/confirm with confirm:true.
 * Idempotent on idempotency_key (replay returns the original row).
 */
export async function POST(request: NextRequest) {
  let admin;
  try {
    // Creating a transfer moves toward money movement: owner-only (SECURITY.md §2).
    admin = await requireAdmin(["owner"]);
  } catch (err) {
    const status = err instanceof AuthError ? err.status : 401;
    return NextResponse.json({ error: status === 403 ? "Forbidden." : "Sign in required." }, { status });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { row, error } = await createTransfer(body, { headers: request.headers, actor: admin.userId });
  if (error || !row) {
    if (error && error.status >= 500) logger.error("POST /api/transfers failed");
    return NextResponse.json({ error: error?.message ?? "Could not create the transfer." }, { status: error?.status ?? 500 });
  }
  return NextResponse.json({ ok: true, transfer: row }, { status: 201 });
}

/** GET /api/transfers — admin history (service-role reads, admin-gated). */
export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const transfers = await listTransfers(100);
  return NextResponse.json({ ok: true, transfers });
}
