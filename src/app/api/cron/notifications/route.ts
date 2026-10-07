import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { processOutbox } from "@/lib/notifications/outbox";
import { logger } from "@/lib/security/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET/POST /api/cron/notifications
 *
 * The scheduler Supabase `pg_cron` + `pg_net` calls over HTTPS (D30). It drains
 * the outbox: queued/failed rows, capped retries with backoff, `last_error`
 * recorded. Auth is `SCHEDULED_JOBS_SECRET` — no secret configured means the
 * route refuses every caller rather than running unauthenticated. The handler
 * never throws: `processOutbox` returns a summary and this returns it.
 *
 * Accepts the secret as `Authorization: Bearer <secret>`, `x-cron-secret` or
 * `?secret=` so a pg_net SQL job can send it however is easiest.
 */

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length || ab.length === 0) return false;
  return timingSafeEqual(ab, bb);
}

function providedSecret(request: NextRequest): string | null {
  const auth = request.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  const header = request.headers.get("x-cron-secret");
  if (header) return header.trim();
  const query = request.nextUrl.searchParams.get("secret");
  return query ? query.trim() : null;
}

function authorized(request: NextRequest): { ok: boolean; status: number; error?: string } {
  const expected = process.env.SCHEDULED_JOBS_SECRET?.trim();
  if (!expected) return { ok: false, status: 503, error: "Scheduled jobs are not configured." };
  const provided = providedSecret(request);
  if (!provided || !safeEqual(provided, expected)) return { ok: false, status: 401, error: "Unauthorized." };
  return { ok: true, status: 200 };
}

async function handle(request: NextRequest) {
  const auth = authorized(request);
  if (!auth.ok) {
    if (auth.status === 401) logger.warn("cron notifications rejected", { reason: "bad secret" });
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const limitParam = Number(request.nextUrl.searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 200) : undefined;
  const summary = await processOutbox(limit);
  return NextResponse.json(summary, { status: summary.ok ? 200 : 500 });
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
