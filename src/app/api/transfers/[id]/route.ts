import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { getTransfer, transferTimeline } from "@/lib/transfers/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/transfers/:id — detail + timeline. */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const { id } = await context.params;
  const transfer = await getTransfer(id);
  if (!transfer) return NextResponse.json({ error: "Transfer not found." }, { status: 404 });
  const timeline = await transferTimeline(id);
  return NextResponse.json({ ok: true, transfer, timeline });
}
