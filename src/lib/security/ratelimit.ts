import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

const DEFAULT_WINDOW_MS = 15 * 60 * 1000; // 15 min

// In-memory fallback for local dev without a DB (single instance only).
// Production uses the Postgres `rate_limits` table (migration 0002).
const memoryBuckets = new Map<string, { count: number; resetAt: number }>();

function memoryCheck(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const bucket = memoryBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    memoryBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }
  bucket.count += 1;
  return {
    allowed: bucket.count <= limit,
    remaining: Math.max(0, limit - bucket.count),
    resetAt: bucket.resetAt,
  };
}

/**
 * Sliding-window-ish rate limiter backed by the Postgres `rate_limits`
 * table (D8: no extra vendor). Falls back to process memory when Supabase
 * is not configured (local scaffold), which is single-instance only.
 *
 * @param key      e.g. `login:127.0.0.1` — caller must scope by action + IP/user
 * @param limit    max attempts per window
 * @param windowMs window length in ms
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number = DEFAULT_WINDOW_MS,
): Promise<RateLimitResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return memoryCheck(key, limit, windowMs);

  try {
    const admin = createAdminClient();
    const windowStart = new Date(Date.now() - windowMs).toISOString();
    // Count recent hits in this window.
    const { count, error } = await admin
      .from("rate_limits")
      .select("id", { count: "exact", head: true })
      .eq("key", key)
      .gte("created_at", windowStart);
    if (error) throw error;

    const used = count ?? 0;
    const allowed = used < limit;
    if (allowed) {
      await admin.from("rate_limits").insert({ key });
    }
    // Opportunistic cleanup (old rows); failure is non-fatal.
    await admin.from("rate_limits").delete().lt("created_at", windowStart);
    return {
      allowed,
      remaining: Math.max(0, limit - used - (allowed ? 1 : 0)),
      resetAt: Date.now() + windowMs,
    };
  } catch {
    // DB failure must not lock everyone out — fail open with memory
    // fallback so login stays usable; the outage is logged by the caller.
    return memoryCheck(key, limit, windowMs);
  }
}

export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}
