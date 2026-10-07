import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listProducts, type ListFilters } from "@/lib/storefront/catalog";
import { ProductCard } from "./ProductCard";
import { ListingControls } from "./ListingControls";

export type ListingSearch = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function num(v: string | undefined): number | undefined {
  if (!v || v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.min(n, 999999999) : undefined;
}

/** Parse + clamp listing query params. Unknown sort values fall back to newest. */
export function parseListingQuery(sp: ListingSearch): ListFilters & { raw: Record<string, string> } {
  const sort = first(sp.sort);
  const raw: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    const f = first(v);
    if (f !== undefined && f !== "" && k !== "page") raw[k] = f;
  }
  const attr: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    if (k.startsWith("attr_")) {
      const f = first(v);
      if (f) attr[k.slice(5)] = f.slice(0, 80);
    }
  }
  return {
    q: first(sp.q)?.slice(0, 100),
    brand_id: undefined, // resolved by the caller from the `brand` slug
    min_price: num(first(sp.min)),
    max_price: num(first(sp.max)),
    attr,
    sort: sort === "price_asc" || sort === "price_desc" || sort === "name" ? sort : "newest",
    page: Math.min(50, Math.max(1, Math.floor(Number(first(sp.page)) || 1))),
    raw,
  };
}

/** Resolve a brand slug (from the filter dropdown) to its id. */
export async function resolveBrandId(slug: string | undefined): Promise<string | undefined> {
  if (!slug) return undefined;
  const db = await createClient();
  const { data } = await db.from("brands").select("id").eq("slug", slug).is("deleted_at", null).single();
  return data?.id;
}

function pageHref(basePath: string, raw: Record<string, string>, page: number): string {
  const sp = new URLSearchParams({ ...raw, page: String(page) });
  return `${basePath}?${sp.toString()}`;
}

/**
 * Shared listing renderer: title, controls, grid, pagination.
 * `scope` carries the page's fixed filters (sport/category/brand/q).
 */
export async function ListingPage({
  title,
  subtitle,
  basePath,
  scope,
  searchParams,
}: {
  title: string;
  subtitle?: string;
  basePath: string;
  scope: Partial<ListFilters>;
  searchParams: ListingSearch;
}) {
  const parsed = parseListingQuery(searchParams);
  const brandSlug = first(searchParams.brand);
  const filters: ListFilters = {
    ...scope,
    q: scope.q ?? parsed.q,
    min_price: parsed.min_price,
    max_price: parsed.max_price,
    attr: parsed.attr,
    sort: parsed.sort,
    page: parsed.page,
    brand_id: scope.brand_id ?? (await resolveBrandId(brandSlug)),
  };

  const { cards, total, page, perPage } = await listProducts(filters);
  const pages = Math.max(1, Math.ceil(total / perPage));
  const raw = { ...parsed.raw, ...(brandSlug ? { brand: brandSlug } : {}) };

  return (
    <main className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-4xl font-bold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        <p className="mt-1 text-sm text-muted" aria-live="polite">
          {total === 0 ? "No products found." : `${total} product${total === 1 ? "" : "s"}`}
        </p>
      </div>

      <ListingControls base={scope} current={{ ...raw, ...(scope.q ? { q: scope.q } : {}) }} />

      {cards.length === 0 ? (
        <div role="status" className="rounded-md border border-dashed border-line bg-card px-6 py-12 text-center">
          <p className="font-display text-xl font-bold">Nothing matches</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            Try fewer filters, a different word, or browse the full shop.
          </p>
          <Link href="/shop" className="mt-4 inline-block rounded-sm bg-gold-600 px-4 py-2 text-sm font-semibold text-bronze-ink">
            Browse everything
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {cards.map((c) => (
            <ProductCard key={c.id} product={c} />
          ))}
        </div>
      )}

      {pages > 1 && (
        <nav aria-label="Pagination" className="flex flex-wrap items-center gap-2 text-sm">
          {page > 1 && (
            <Link href={pageHref(basePath, raw, page - 1)} className="rounded-sm border border-line px-3 py-1.5">
              ← Prev
            </Link>
          )}
          <span aria-current="page" className="rounded-sm border border-gold-600 bg-gold-600 px-3 py-1.5 font-semibold text-bronze-ink">
            {page}
          </span>
          <span className="text-muted">of {pages}</span>
          {page < pages && (
            <Link href={pageHref(basePath, raw, page + 1)} className="rounded-sm border border-line px-3 py-1.5">
              Next →
            </Link>
          )}
        </nav>
      )}
    </main>
  );
}
