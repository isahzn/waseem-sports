import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * The admin area's shared-password gate.
 *
 * The owner asked for `/admin` to open with one password instead of an account
 * (2026-10-07 — recorded as D42 in `docs/DECISIONS.md`). This module is that
 * gate: a constant-time password check plus a signed, http-only cookie that
 * stands in for a session. It deliberately replaces nothing — when
 * `ADMIN_PASSCODE` is unset the account path (`requireAdmin` + Supabase Auth,
 * the `admin_users` role row) is exactly as it was.
 *
 * Security notes, deliberately spelled out:
 * - The password lives in `.env` (`ADMIN_PASSCODE`), never in the source tree.
 * - The cookie is HMAC-signed, so it cannot be forged without the signing key;
 *   it is http-only, SameSite=Lax, and `Secure` whenever the site is https.
 * - `/admin/login` is rate-limited like the account login (10 tries / 15 min / IP).
 * - A passcode session has no `auth.users` row, so anything it writes records
 *   `actor: null` in the audit log rather than inventing an identity.
 */

/** Cookie holding the signed admin session. */
export const PASSCODE_COOKIE = "ws_admin";

/** How long a passcode session lasts. */
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** The configured admin password, or null when the password gate is off. */
export function adminPasscode(): string | null {
  const value = process.env.ADMIN_PASSCODE?.trim();
  return value ? value : null;
}

/** True when `/admin` accepts the shared password instead of an account. */
export function passcodeGateEnabled(): boolean {
  return adminPasscode() !== null;
}

/**
 * HMAC key for the session cookie. A dedicated `ADMIN_SESSION_SECRET` is
 * preferred, because it can be rotated without changing the password; without
 * one the key is derived from the password, which still means an attacker needs
 * the password to forge a cookie.
 */
function signingKey(): Buffer {
  const secret = process.env.ADMIN_SESSION_SECRET?.trim();
  if (secret) return Buffer.from(secret, "utf8");
  return createHmac("sha256", "waseem-sports/admin-session/v1")
    .update(adminPasscode() ?? "")
    .digest();
}

function sign(payload: string): string {
  return createHmac("sha256", signingKey()).update(payload).digest("base64url");
}

/** Length-independent-safe comparison of two strings. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** Constant-time password check. False when the gate is off. */
export function verifyPasscode(input: string): boolean {
  const expected = adminPasscode();
  if (!expected) return false;
  return safeEqual(input.trim(), expected);
}

/** Mint a session value: `<expiry-ms>.<hmac>`. */
export function createSessionValue(now: number = Date.now()): string {
  const exp = String(now + SESSION_TTL_MS);
  return `${exp}.${sign(exp)}`;
}

/** Verify signature, shape and expiry of a session value. */
export function verifySessionValue(value: string | undefined | null): boolean {
  if (!value) return false;
  const [exp, mac] = value.split(".");
  if (!exp || !mac || !/^\d{10,}$/.test(exp)) return false;
  if (!safeEqual(mac, sign(exp))) return false;
  return Number(exp) > Date.now();
}

/** True when the request carries a valid passcode session. Read-only. */
export async function hasAdminSession(): Promise<boolean> {
  try {
    const store = await cookies();
    return verifySessionValue(store.get(PASSCODE_COOKIE)?.value);
  } catch {
    return false;
  }
}

/** Start a passcode session. Server actions / route handlers only. */
export async function issueAdminSession(): Promise<void> {
  const store = await cookies();
  store.set(PASSCODE_COOKIE, createSessionValue(), {
    httpOnly: true,
    sameSite: "lax",
    // Local production runs on plain http://127.0.0.1, so `NODE_ENV` alone
    // would send a cookie the browser refuses to store. Follow the configured
    // site URL instead: https there means Secure here.
    secure: (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://"),
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

/** End a passcode session. */
export async function clearAdminSession(): Promise<void> {
  try {
    const store = await cookies();
    store.delete(PASSCODE_COOKIE);
  } catch {
    // Nothing to clear (already signed out) — never block the redirect.
  }
}
