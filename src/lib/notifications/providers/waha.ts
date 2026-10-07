import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { logger } from "@/lib/security/logger";
import type { NotificationMessage, Notifier, SendResult } from "../types";

/**
 * WAHA (WhatsApp HTTP API) adapter — self-hosted on a VPS (decision D4).
 *
 * Everything here is best-effort and never throws: a WhatsApp outage must never
 * reach the order flow. When `WAHA_URL` / `WAHA_API_KEY` are absent the adapter
 * is simply "not configured" and nothing is attempted (D33).
 *
 * VERIFY (spec §10, WA-V1…V7) — the exact endpoint shapes below are written to
 * WAHA's documented API but have NOT been exercised against a live session:
 *   WA-V4  session-status list and the QR-fetch endpoint shape
 *   WA-V7  webhook event names and the HMAC header name
 * The send path (`POST /api/sendText`, `X-Api-Key`) is the one shape quoted in
 * the WAHA docs (spec §2). Until a real session exists, treat every call here as
 * unproven — the phase ships with WAHA disabled.
 */

const SEND_TIMEOUT_MS = 15_000;

export function wahaBaseUrl(): string | null {
  const url = process.env.WAHA_URL?.trim();
  return url ? url.replace(/\/+$/, "") : null;
}

export function wahaApiKey(): string | null {
  const key = process.env.WAHA_API_KEY?.trim();
  return key ? key : null;
}

export function wahaSessionName(): string {
  return process.env.WAHA_SESSION?.trim() || "default";
}

/** True only when both the endpoint and the API key exist. */
export function isWahaConfigured(): boolean {
  return Boolean(wahaBaseUrl() && wahaApiKey());
}

async function wahaFetch(
  path: string,
  init: RequestInit = {},
): Promise<{ ok: boolean; status: number; json: unknown; text: string }> {
  const base = wahaBaseUrl();
  const key = wahaApiKey();
  if (!base || !key) return { ok: false, status: 0, json: null, text: "not configured" };
  try {
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        "X-Api-Key": key,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      cache: "no-store",
    });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { ok: res.ok, status: res.status, json, text };
  } catch (err) {
    return { ok: false, status: 0, json: null, text: err instanceof Error ? err.message : "network error" };
  }
}

/** Short, safe description of a WAHA failure — never includes the API key. */
function describeFailure(status: number, text: string): string {
  const clean = text.replace(/\s+/g, " ").trim().slice(0, 160);
  if (status === 0) return `WAHA unreachable: ${clean}`;
  return `WAHA responded ${status}${clean ? `: ${clean}` : ""}`;
}

/** POST /api/sendText — the send shape quoted in the WAHA docs (spec §2). */
export async function sendText(chatId: string, text: string): Promise<SendResult> {
  const res = await wahaFetch("/api/sendText", {
    method: "POST",
    body: JSON.stringify({ session: wahaSessionName(), chatId, text }),
  });
  if (!res.ok) return { ok: false, error: describeFailure(res.status, res.text) };
  const raw = res.json as { id?: { _serialized?: string } | string; _data?: { id?: { _serialized?: string } } } | null;
  const id =
    (typeof raw?.id === "string" ? raw.id : raw?.id?._serialized) ??
    raw?._data?.id?._serialized ??
    undefined;
  return { ok: true, providerMessageId: id };
}

export type WahaSessionStatus = {
  configured: boolean;
  status: string | null;
  /** The paired number as WAHA reports it, when available. */
  me: string | null;
  error: string | null;
};

/** GET /api/sessions/{session}. VERIFY WA-V4: the status vocabulary. */
export async function getSessionStatus(): Promise<WahaSessionStatus> {
  if (!isWahaConfigured()) {
    return { configured: false, status: null, me: null, error: null };
  }
  const res = await wahaFetch(`/api/sessions/${encodeURIComponent(wahaSessionName())}`);
  if (!res.ok) {
    return { configured: true, status: null, me: null, error: describeFailure(res.status, res.text) };
  }
  const json = res.json as { status?: string; me?: { id?: string; pushName?: string } } | null;
  return {
    configured: true,
    status: json?.status ?? null,
    me: json?.me?.id ?? null,
    error: null,
  };
}

/**
 * Start (or re-pair) the session. The QR is then fetched separately for the
 * admin to scan. VERIFY WA-V4: `/start` and `/logout` endpoint shapes.
 */
export async function startSession(): Promise<{ ok: boolean; error?: string }> {
  const res = await wahaFetch(`/api/sessions/${encodeURIComponent(wahaSessionName())}/start`, { method: "POST" });
  return res.ok ? { ok: true } : { ok: false, error: describeFailure(res.status, res.text) };
}

export async function logoutSession(): Promise<{ ok: boolean; error?: string }> {
  const res = await wahaFetch(`/api/sessions/${encodeURIComponent(wahaSessionName())}/logout`, { method: "POST" });
  return res.ok ? { ok: true } : { ok: false, error: describeFailure(res.status, res.text) };
}

export async function restartSession(): Promise<{ ok: boolean; error?: string }> {
  const stop = await wahaFetch(`/api/sessions/${encodeURIComponent(wahaSessionName())}/stop`, { method: "POST" });
  if (!stop.ok && stop.status !== 0) logger.warn("waha stop failed", { status: stop.status });
  return startSession();
}

/**
 * GET /api/{session}/auth/qr?format=image — returns a PNG we render as a data
 * URL, so the browser never talks to WAHA and the API key never leaves the
 * server (spec §5.4). VERIFY WA-V4: the exact QR endpoint in the current
 * version; this is the documented shape at the time of writing.
 */
export async function getQr(): Promise<{ ok: boolean; dataUrl?: string; error?: string }> {
  const base = wahaBaseUrl();
  const key = wahaApiKey();
  if (!base || !key) return { ok: false, error: "WAHA is not configured." };
  try {
    const res = await fetch(
      `${base}/api/${encodeURIComponent(wahaSessionName())}/auth/qr?format=image`,
      { headers: { "X-Api-Key": key, Accept: "image/png" }, signal: AbortSignal.timeout(SEND_TIMEOUT_MS), cache: "no-store" },
    );
    if (!res.ok) return { ok: false, error: `WAHA responded ${res.status} for the QR.` };
    const type = res.headers.get("content-type") ?? "image/png";
    if (!type.startsWith("image/")) return { ok: false, error: "WAHA did not return a QR image." };
    const bytes = Buffer.from(await res.arrayBuffer());
    return { ok: true, dataUrl: `data:${type};base64,${bytes.toString("base64")}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not reach WAHA for the QR." };
  }
}

/**
 * Constant-time comparison of the inbound webhook signature against
 * HMAC-SHA256(rawBody, WAHA_HOOK_HMAC_KEY). Accepts hex or base64 encodings and
 * an optional `sha256=` prefix. Hash comparison is length-checked first.
 */
export function verifyWahaSignature(rawBody: string, headerValue: string | null, key: string | null): boolean {
  if (!key || !headerValue) return false;
  const provided = headerValue.trim().replace(/^sha256=/i, "");
  const digest = createHmac("sha256", key).update(rawBody, "utf8").digest();
  const candidates = [digest.toString("hex"), digest.toString("base64")];
  return candidates.some((expected) => {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(provided, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

/** The inbound webhook signing key, or null when unset. */
export function wahaHookKey(): string | null {
  const key = process.env.WAHA_HOOK_HMAC_KEY?.trim();
  return key ? key : null;
}

export class WahaNotifier implements Notifier {
  readonly channel = "whatsapp" as const;
  readonly provider = "waha";

  async send(message: NotificationMessage): Promise<SendResult> {
    if (!isWahaConfigured()) return { ok: false, error: "WAHA is not configured." };
    try {
      return await sendText(message.recipient, message.body);
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "WAHA send failed." };
    }
  }
}
