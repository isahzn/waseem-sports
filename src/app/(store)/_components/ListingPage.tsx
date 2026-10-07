import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getNav, listProducts, type ListFilters } from "@/lib/storefront/catalog";
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
 * Shared listing renderer, laid out like the canonical design's `shop()` route:
 * a category chip row, a `.sec` heading with the result count, the filter box,
 * the product `.grid` and chip pagination.
 *
 * `scope` carries the page's fixed filters (sport/category/brand/q).
 * `activeCategorySlug` drives the chip state: `null` marks "All", a slug marks
 * that category, and leaving it undefined marks nothing (sport/brand/search).
 */
export async function ListingPage({
  title,
  subtitle,
  basePath,
  scope,
  searchParams,
  activeCategorySlug,
}: {
  title: string;
  subtitle?: string;
  basePath: string;
  scope: Partial<ListFilters>;
  searchParams: ListingSearch;
  activeCategorySlug?: string | null;
}) {
  const parsed = parseListingQuery(searchParams);
  const nav = await getNav();
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
    <main>
      <div className="cats">
        <Link className={`chip${activeCategorySlug === null ? " on" : ""}`} href="/shop">
          All
        </Link>
        {nav.categories.slice(0, 11).map((c) => (
          <Link
            key={c.id}
            className={`chip${activeCategorySlug === c.slug ? " on" : ""}`}
            href={`/category/${c.slug}`}
          >
            {c.name}
          </Link>
        ))}
      </div>

      <div className="sec">
        <h1>{title}</h1>
        <span className="sold" aria-live="polite">
          {total === 0 ? "No products found." : `${total} product${total === 1 ? "" : "s"}`}
        </span>
      </div>
      {subtitle && <p className="sold">{subtitle}</p>}

      <ListingControls base={scope} current={{ ...raw, ...(scope.q ? { q: scope.q } : {}) }} />

      {cards.length === 0 ? (
        <div className="box" role="status">
          <h2>Nothing matches</h2>
          <p className="sold">Try fewer filters, a different word, or browse the full shop.</p>
          <Link className="btn" href="/shop">
            Browse everything
          </Link>
        </div>
      ) : (
        <div className="grid">
          {cards.map((c) => (
            <ProductCard key={c.id} product={c} />
          ))}
        </div>
      )}

      {pages > 1 && (
        <nav aria-label="Pagination" className="cats">
          {page > 1 && (
            <Link className="chip" href={pageHref(basePath, raw, page - 1)}>
              ← Prev
            </Link>
          )}
          <span aria-current="page" className="chip on">
            {page}
          </span>
          <span className="sold" style={{ alignSelf: "center" }}>
            of {pages}
          </span>
          {page < pages && (
            <Link className="chip" href={pageHref(basePath, raw, page + 1)}>
              Next →
            </Link>
          )}
        </nav>
      )}
    </main>
  );
}
