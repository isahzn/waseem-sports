import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { validateQuote } from "@/lib/transfers/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/transfers/validate — server-side quote, no DB write. */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const res = await validateQuote(body);
  if (!res.ok) return NextResponse.json({ ok: false, errors: res.errors }, { status: 400 });
  return NextResponse.json({ ok: true, ...res.quote });
}
