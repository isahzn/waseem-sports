import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cardImage } from "@/lib/storefront/images";

/**
 * Search index for the Fuse.js autocomplete (Fixes §2.3).
 *
 * Choice documented: client-side Fuse.js over Postgres FTS for V1.
 * The catalog is small (tens of products, one shop), so shipping a ~2KB
 * index once and fuzzy-matching in the browser gives typo/partial/brand/code
 * matching with zero new Postgres extensions and no extra query per keystroke.
 * Server-side `listProducts` keeps its ILIKE taxonomy matching as the
 * full-results fallback (see lib/storefront/catalog.ts `searchProductIds`).
 * If the catalog grows past a few thousand SKUs, add `pg_trgm` + a tsvector
 * column and move ranking server-side (planned with the Neon cutover,
 * docs/NEON-MIGRATION-PLAN.md §3 — do not add Supabase-only migrations now).
 */

export type SearchIndexItem = {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  sport: string | null;
  price: number;
  thumb: string | null;
  codes: string;
};

export async function GET() {
  const db = await createClient();
  const { data: products } = await db
    .from("products")
    .select("id,slug,name,base_price,brands(name),sports:sport_id(name)")
    .eq("status", "published")
    .is("deleted_at", null)
    .order("name")
    .limit(2000);
  const rows = products ?? [];
  const ids = rows.map((r: { id: string }) => r.id);

  const [imgsRes, variantsRes] = await Promise.all([
    ids.length > 0
      ? db
          .from("product_images")
          .select("product_id,storage_path,alt_text,is_primary,sort_order")
          .in("product_id", ids)
          .order("sort_order")
          .limit(ids.length * 3)
      : Promise.resolve({ data: [] as never[] }),
    ids.length > 0
      ? db.from("product_variants").select("product_id,name,sku").in("product_id", ids).is("deleted_at", null).limit(4000)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
  const thumbByProduct = new Map<string, string>();
  for (const img of (imgsRes.data ?? []) as {
    product_id: string;
    storage_path: string;
    alt_text: string | null;
    is_primary: boolean;
    sort_order: number;
  }[]) {
    if (!thumbByProduct.has(img.product_id)) {
      thumbByProduct.set(
        img.product_id,
        cardImage({ storage_path: img.storage_path, alt_text: img.alt_text, is_primary: img.is_primary, sort_order: img.sort_order }).src,
      );
    }
  }
  const codesByProduct = new Map<string, string[]>();
  for (const v of (variantsRes.data ?? []) as { product_id: string; name: string; sku: string | null }[]) {
    const list = codesByProduct.get(v.product_id) ?? [];
    if (v.sku) list.push(v.sku);
    if (v.name && v.name !== "Default") list.push(v.name);
    codesByProduct.set(v.product_id, list);
  }

  const items: SearchIndexItem[] = rows.map(
    (r: {
      id: string;
      slug: string;
      name: string;
      base_price: number;
      brands: { name: string } | { name: string }[] | null;
      sports: { name: string } | { name: string }[] | null;
    }) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      brand: one(r.brands)?.name ?? null,
      sport: one(r.sports)?.name ?? null,
      price: Number(r.base_price),
      thumb: thumbByProduct.get(r.id) ?? null,
      codes: (codesByProduct.get(r.id) ?? []).join(" "),
    }),
  );

  return NextResponse.json(
    { items },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } },
  );
}
