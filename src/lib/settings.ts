import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * `store_settings` access (key/value jsonb). Public `public.*` keys are read by
 * the storefront through the anon client (see `getShopInfo` in
 * `lib/storefront/catalog.ts`); everything else — order numbering, COD policy,
 * notification toggles — is server-only and read with the service-role client.
 *
 * Writes are service-role only by RLS, so callers must run `requireAdmin()`
 * first (this helper authorizes nothing by itself); audit the change too.
 */

export type SettingValue = string | number | boolean | null | Record<string, unknown> | unknown[];

/** Read one setting (service role). Returns `fallback` when absent/unreadable. */
export async function getSetting<T extends SettingValue>(key: string, fallback: T): Promise<T> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("store_settings").select("value").eq("key", key).maybeSingle();
    if (error || !data) return fallback;
    const value = data.value as T | null;
    return value === null || value === undefined ? fallback : value;
  } catch {
    return fallback;
  }
}

/** Read many settings at once (service role) as a plain map. */
export async function getSettingsMap(keys: string[]): Promise<Map<string, unknown>> {
  const out = new Map<string, unknown>();
  if (keys.length === 0) return out;
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("store_settings").select("key,value").in("key", keys);
    for (const row of data ?? []) out.set(row.key, row.value);
  } catch {
    // fall through with whatever was read
  }
  return out;
}

/** Upsert one setting. Service role; caller must be an authenticated admin. */
export async function setSetting(
  key: string,
  value: SettingValue,
  actor: string | null,
): Promise<{ error?: string }> {
  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("store_settings")
      .upsert({ key, value: value as never, updated_by: actor, updated_at: new Date().toISOString() });
    if (error) return { error: error.message };
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/** COD stock-reservation policy (D2). `placed` is the oversell-safe default. */
export type ReservePolicy = "placed" | "confirmed";

export async function getReservePolicy(): Promise<ReservePolicy> {
  const raw = await getSetting<string>("cod.reserve_stock_on", "placed");
  return raw === "confirmed" ? "confirmed" : "placed";
}

/** Order-number prefix (D21, default `WS`; `place_order` falls back to `ORD`). */
export async function getOrderPrefix(): Promise<string> {
  const raw = await getSetting<string>("order.number_prefix", "WS");
  return typeof raw === "string" && raw.trim() !== "" ? raw.trim() : "WS";
}

/** Max quantity per variant in one order (D22, default 100). */
export async function getMaxQtyPerVariant(): Promise<number> {
  const raw = await getSetting<number | string>("order.max_qty_per_variant", 100);
  const n = typeof raw === "string" ? Number(raw) : raw;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 100;
}
