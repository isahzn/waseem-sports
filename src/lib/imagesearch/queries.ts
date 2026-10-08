import { createHash } from "node:crypto";

/**
 * Deterministic query builder (Phase 09 task 1). Templates are built from
 * the product's own data — name, brand, sport, category, attributes — never
 * from hardcoded product names. Pure module: no server imports, so the
 * harness executes it directly.
 */

export type ProductQueryInput = {
  name: string;
  brand?: string | null;
  sport?: string | null;
  category?: string | null;
  /** Key attribute values (e.g. ["English Willow", "Short Handle"]). */
  attributes?: string[];
};

/** Normalize one query: lowercase, strip punctuation, collapse whitespace. */
export function normalizeQuery(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/["'“”‘’]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/[\s-]+/g, " ")
    .trim()
    .slice(0, 150);
}

/** Build up to 4 search queries from the product (most specific first). */
export function buildQueries(input: ProductQueryInput): string[] {
  const clean = (v: string | null | undefined): string => (v ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
  const name = clean(input.name);
  if (!name) return [];
  const brand = clean(input.brand);
  const sport = clean(input.sport);
  const category = clean(input.category);
  const attrs = (input.attributes ?? []).map(clean).filter(Boolean).slice(0, 3);

  const out: string[] = [];
  const push = (q: string) => {
    const n = normalizeQuery(q);
    if (n && !out.includes(n)) out.push(n);
  };

  if (brand && category) push(`${brand} ${name} ${category}`);
  else if (brand) push(`${brand} ${name}`);
  else if (category) push(`${name} ${category}`);
  push(`${name} official`);
  for (const a of attrs) {
    if (out.length >= 4) break;
    push(`${name} ${a}`);
  }
  if (out.length < 4 && sport && category) push(`${sport} ${category} ${name}`);
  return out.slice(0, 4);
}

/** Stable cache key for a query set. */
export function queriesHash(queries: string[]): string {
  return createHash("sha256").update(queries.map(normalizeQuery).join("\n")).digest("hex");
}
