import "server-only";
import { z } from "zod";
import { adminDb } from "@/lib/auth/requireAdmin";
import { writeAudit } from "@/lib/catalog/audit";
import { getSetting } from "@/lib/settings";
import { checkRateLimit, clientIp } from "@/lib/security/ratelimit";
import { logger } from "@/lib/security/logger";
import { storeProcessedImage } from "@/lib/uploads/store";
import { buildQueries, queriesHash } from "./queries";
import { rankCandidates } from "./rank";
import { BlockedError, fetchImageBytes } from "./ssrf";
import type { ImageSearchProvider, SearchOutcome } from "./types";

/** Provider registry. Only "none" exists — a real vendor plugs in here (D6). */
export function providerFor(name: string): ImageSearchProvider | null {
  if (name === "none" || name === "") return null;
  throw new Error(`Unknown image-search provider: ${name}`);
}

function providerName(): string {
  return (process.env.IMAGE_SEARCH_PROVIDER ?? "none").trim().toLowerCase() || "none";
}

function dailyQuota(): number {
  const n = Number(process.env.IMAGE_SEARCH_DAILY_QUOTA ?? 100);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 100;
}

function cacheDays(): number {
  const n = Number(process.env.IMAGE_SEARCH_CACHE_DAYS ?? 7);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 7;
}

/** Owner-editable allowlist of manufacturer/distributor domains. */
export async function getAllowlist(): Promise<string[]> {
  const raw = await getSetting<string[]>("image_search.domain_allowlist", []);
  if (!Array.isArray(raw)) return [];
  return raw.map((d) => String(d).trim().toLowerCase()).filter(Boolean).slice(0, 100);
}

export const searchInput = z.object({
  product_id: z.string().uuid("Invalid product."),
});

export const importInput = z.object({
  product_id: z.string().uuid("Invalid product."),
  image_url: z.string().trim().max(2000).url("Invalid image URL."),
  page_url: z.string().trim().max(2000).url("Invalid page URL."),
  /** Explicit rights acknowledgement — finding an image ≠ right to use it. */
  acknowledge_rights: z.literal(true, { invalid_type_error: "Confirm the rights warning first." }),
});

async function productContext(productId: string): Promise<{
  name: string;
  brand: string | null;
  sport: string | null;
  category: string | null;
  attributes: string[];
} | null> {
  const db = adminDb();
  const { data: product } = await db
    .from("products")
    .select("id,name,brand_id,sport_id,category_id")
    .eq("id", productId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!product) return null;
  const [brand, sport, category, attrs] = await Promise.all([
    product.brand_id ? db.from("brands").select("name").eq("id", product.brand_id).maybeSingle() : Promise.resolve({ data: null }),
    product.sport_id ? db.from("sports").select("name").eq("id", product.sport_id).maybeSingle() : Promise.resolve({ data: null }),
    product.category_id ? db.from("categories").select("name").eq("id", product.category_id).maybeSingle() : Promise.resolve({ data: null }),
    db.from("product_attribute_values").select("value_text").eq("product_id", productId).limit(5),
  ]);
  return {
    name: product.name,
    brand: (brand.data as { name?: string } | null)?.name ?? null,
    sport: (sport.data as { name?: string } | null)?.name ?? null,
    category: (category.data as { name?: string } | null)?.name ?? null,
    attributes: ((attrs.data ?? []) as { value_text?: string }[]).map((a) => String(a.value_text ?? "")).filter(Boolean),
  };
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Search recommended images. Disabled (no provider) is a normal state:
 * returns the would-be queries with `configured: false`, spends nothing.
 * Live calls consume the daily quota; cache hits do not.
 */
export async function searchImages(
  input: unknown,
  opts: { headers: Headers; actor: string | null },
): Promise<{ outcome?: SearchOutcome; error?: { status: number; message: string } }> {
  const parsed = searchInput.safeParse(input);
  if (!parsed.success) return { error: { status: 400, message: "Invalid product." } };

  const key = `imagesearch:${clientIp(opts.headers)}`;
  if (!(await checkRateLimit(key, 20)).allowed) {
    return { error: { status: 429, message: "Too many searches — wait a few minutes and try again." } };
  }

  const ctx = await productContext(parsed.data.product_id);
  if (!ctx) return { error: { status: 404, message: "Product not found." } };
  const queries = buildQueries(ctx);
  const name = providerName();
  if (name === "none") {
    return { outcome: { configured: false, reason: "No image-search provider is set up yet (IMAGE_SEARCH_PROVIDER is empty). Manual upload still works.", queries } };
  }

  let provider: ImageSearchProvider;
  try {
    const p = providerFor(name);
    if (!p) return { outcome: { configured: false, reason: "No image-search provider is set up yet.", queries } };
    provider = p;
  } catch (err) {
    logger.error("image-search provider misconfigured", { error: err instanceof Error ? err.message : String(err) });
    return { error: { status: 500, message: "Image search is misconfigured." } };
  }

  const db = adminDb();
  const hash = queriesHash(queries);
  const cutoff = new Date(Date.now() - cacheDays() * 86400000).toISOString();
  const { data: hit } = await db.from("image_search_cache").select("results,created_at").eq("query_hash", hash).maybeSingle();
  const allowlist = await getAllowlist();
  if (hit && hit.created_at >= cutoff) {
    const candidates = rankCandidates((hit.results ?? []) as never[], allowlist);
    return { outcome: { configured: true, queries, candidates, cached: true } };
  }

  // Quota: counted per provider call, never on cache hits or disabled state.
  const day = todayKey();
  const { data: quotaRow } = await db.from("image_search_quota").select("count").eq("day", day).maybeSingle();
  const used = (quotaRow?.count as number | undefined) ?? 0;
  if (used >= dailyQuota()) {
    return { error: { status: 429, message: "Today's image-search quota is used up — manual upload still works." } };
  }

  let raw;
  try {
    raw = await provider.search(queries, 10);
  } catch (err) {
    logger.error("image-search provider failed", { error: err instanceof Error ? err.message : String(err) });
    return { error: { status: 502, message: "Image search failed — manual upload still works." } };
  }
  await db.from("image_search_quota").upsert({ day, count: used + 1, updated_at: new Date().toISOString() });
  await db.from("image_search_cache").upsert({ query_hash: hash, queries, results: raw as never });
  // Opportunistic expiry; failure is non-fatal.
  await db.from("image_search_cache").delete().lt("created_at", cutoff);

  const candidates = rankCandidates(raw, allowlist);
  await writeAudit({ actor: opts.actor, action: "image.search", entity: "products", entityId: parsed.data.product_id, meta: { queries: queries.length, candidates: candidates.length } });
  return { outcome: { configured: true, queries, candidates, cached: false } };
}

/**
 * Import one owner-picked candidate through the shared pipeline:
 * SSRF-guarded fetch -> magic bytes -> sharp re-encode -> storage ->
 * product_images row with provenance. Requires the explicit rights checkbox.
 */
export async function importCandidate(
  input: unknown,
  opts: { headers: Headers; actor: string | null },
): Promise<{ id?: string; storage_path?: string; error?: { status: number; message: string } }> {
  const parsed = importInput.safeParse(input);
  if (!parsed.success) {
    return { error: { status: 400, message: parsed.error.issues[0]?.message ?? "Check the import details." } };
  }
  const key = `imageimport:${clientIp(opts.headers)}`;
  if (!(await checkRateLimit(key, 20)).allowed) {
    return { error: { status: 429, message: "Too many imports — wait a few minutes and try again." } };
  }
  const v = parsed.data;

  let fetched;
  try {
    fetched = await fetchImageBytes(v.image_url);
  } catch (err) {
    if (err instanceof BlockedError) return { error: { status: 400, message: err.message } };
    logger.error("image import fetch failed", { error: err instanceof Error ? err.message : String(err) });
    return { error: { status: 502, message: "Could not fetch that image. Try another, or upload manually." } };
  }

  let pageHost = "";
  try {
    pageHost = new URL(v.page_url).hostname.toLowerCase();
  } catch {
    return { error: { status: 400, message: "Invalid page URL." } };
  }
  const stored = await storeProcessedImage(fetched.bytes, {
    productId: v.product_id,
    altText: "",
    provenance: {
      source_url: fetched.finalUrl,
      source_note: `Imported from ${pageHost}`,
      license_note: "Rights unverified — finding an image does not grant commercial use. Confirm the licence before publishing.",
    },
  });
  if (!stored.ok) return { error: { status: stored.status, message: stored.error } };

  await writeAudit({ actor: opts.actor, action: "image.import", entity: "product_images", entityId: stored.id, meta: { productId: v.product_id, source: pageHost } });
  return { id: stored.id, storage_path: stored.storage_path };
}
