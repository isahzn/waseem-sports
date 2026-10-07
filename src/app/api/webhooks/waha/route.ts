import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/security/logger";
import { verifyWahaSignature, wahaHookKey } from "@/lib/notifications/providers/waha";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/waha — inbound WAHA events (delivery acks, session state).
 *
 * Hard rule: verification happens over the **raw body** before anything is
 * parsed or stored, and an unsigned or wrongly-signed request is rejected with
 * 401 (PHASE 06 task "reject anything unsigned"). With no
 * `WAHA_HOOK_HMAC_KEY` configured the route refuses every caller, so the
 * disabled state is also the safe state.
 *
 * Events are stored in the existing `webhook_events` table (`unique(provider,
 * event_id)`), which gives replay protection and an audit trail. Duplicate
 * deliveries return 200 and change nothing (spec test 8).
 *
 * VERIFY (WA-V7): the HMAC header name and the event id field in WAHA's current
 * webhook payload. Several header names are accepted defensively; a real event
 * is needed to confirm which one WAHA sends, and this route is unproven until
 * then.
 */

const SIGNATURE_HEADERS = [
  "x-webhook-hmac",
  "x-waha-hmac",
  "x-hub-signature-256",
  "x-signature",
];

function signatureFrom(request: NextRequest): string | null {
  for (const name of SIGNATURE_HEADERS) {
    const value = request.headers.get(name);
    if (value) return value;
  }
  return null;
}

export async function POST(request: NextRequest) {
  const key = wahaHookKey();
  if (!key) {
    logger.warn("waha webhook rejected: no HMAC key configured");
    return NextResponse.json({ error: "Webhook verification is not configured." }, { status: 401 });
  }

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return NextResponse.json({ error: "Unreadable body." }, { status: 400 });
  }
  if (!raw) return NextResponse.json({ error: "Empty body." }, { status: 400 });

  if (!verifyWahaSignature(raw, signatureFrom(request), key)) {
    logger.warn("waha webhook rejected: bad or missing signature", { bytes: raw.length });
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let payload: Record<string, unknown> | null = null;
  try {
    payload = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const event = (payload.event ?? null) as { id?: string } | string | null;
  const eventId =
    (typeof payload.id === "string" && payload.id) ||
    (event && typeof event === "object" && typeof event.id === "string" && event.id) ||
    (typeof payload.eventId === "string" && payload.eventId) ||
    createHash("sha256").update(raw, "utf8").digest("hex");

  try {
    const admin = createAdminClient();
    const { error } = await admin.from("webhook_events").upsert(
      { provider: "waha", event_id: eventId, payload },
      { onConflict: "provider,event_id", ignoreDuplicates: true },
    );
    if (error) {
      logger.error("waha webhook store failed", { error: error.message });
      return NextResponse.json({ error: "Could not store the event." }, { status: 500 });
    }
  } catch (err) {
    logger.error("waha webhook store threw", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Could not store the event." }, { status: 500 });
  }

  // TODO(PHASE 06 follow-up, needs a live session): map delivery acks /
  // session-state events onto the matching notification row. Storage only for
  // now — enough for replay protection and diagnosis.
  return NextResponse.json({ ok: true, event_id: eventId }, { status: 200 });
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed." }, { status: 405 });
}
