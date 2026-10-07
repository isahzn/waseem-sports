import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { logger } from "@/lib/security/logger";

/**
 * Guest order tracking tokens (no customer accounts — HANDOFF decision 3).
 * The raw token exists only in the customer's link; the DB stores
 * sha256(token + pepper). Guessing an order number without the token reveals
 * nothing (orders are service-role-readable only).
 */

const TOKEN_BYTES = 32; // 256 bits, per phase spec ("random 32 bytes")

/** Fresh URL-safe token for a new order. */
export function generateTrackingToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

function pepper(): string {
  const secret = process.env.ORDER_TRACKING_SECRET ?? env.ORDER_TRACKING_SECRET ?? "";
  if (!secret) {
    // Never silently weaken tracking in production: the token hash is the only
    // thing protecting order data, so a missing pepper is a real defect.
    if (process.env.NODE_ENV === "production") {
      logger.error("ORDER_TRACKING_SECRET is not set — tracking token hashing is unsalted");
    }
    return "";
  }
  return secret;
}

/** sha256(token + pepper), hex. Matches what `place_order` receives. */
export function hashTrackingToken(token: string): string {
  return createHash("sha256").update(`${token}${pepper()}`, "utf8").digest("hex");
}

/** Constant-time comparison of two hex digests. */
export function tokensMatch(a: string, b: string): boolean {
  if (a.length !== b.length || a.length === 0) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
  } catch {
    return false;
  }
}

/** Accept only plausible token shapes before hashing (cheap input guard). */
export function parseTrackingToken(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const token = raw.trim();
  if (token.length < 16 || token.length > 200) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(token)) return null;
  return token;
}

function siteBase(): string {
  return (env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");
}

/** Customer-facing tracking link for an order (the raw token from checkout). */
export function buildTrackingUrl(orderNumber: string, token: string): string {
  return `${siteBase()}/order/${encodeURIComponent(orderNumber)}?t=${encodeURIComponent(token)}`;
}

/**
 * Tracking link for a notification message (PHASE 06).
 *
 * Only `sha256(token + pepper)` is stored, so a notification sent for a later
 * status has no raw token to rebuild the checkout link with. The stored hash is
 * therefore the capability in the message link: it lives only in `orders`
 * (service-role-readable) and travels only to that customer's phone, exactly as
 * the raw token does. `getTrackedOrder` accepts it as an alternative to the raw
 * token — same data, same audience, no plaintext token ever stored (D44).
 */
export function buildNotificationTrackingUrl(orderNumber: string, tokenHash: string): string {
  return `${siteBase()}/order/${encodeURIComponent(orderNumber)}?t=${encodeURIComponent(tokenHash)}`;
}
