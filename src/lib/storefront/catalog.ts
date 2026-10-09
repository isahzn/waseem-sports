import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getVariantStock } from "./availability";

export type NavSport = { id: string; name: string; slug: string };
/** A "Shop by sport" tile: the sport's name plus the photo the owner uploaded. */
export type SportTile = {
  id: string;
  name: string;
  slug: string;
  image_path: string | null;
  image_alt: string | null;
};
export type NavCategory = { id: string; name: string; slug: string; sport_id: string | null };

export type ProductCard = {
  id: string;
  slug: string;
  name: string;
  base_price: number;
  compare_at_price: number | null;
  is_featured: boolean;
  brand_name: string | null;
  primary_image: { storage_path: string; alt_text: string | null; is_primary: boolean; sort_order: number } | null;
  availability: "in_stock" | "low_stock" | "out_of_stock";
  /** Default (else first) active variant — this is the card's Add-to-cart target. */
  default_variant_id: string | null;
  /** Status of that one variant, so a card is never disabled for a sibling's stock. */
  default_variant_status: "in_stock" | "low_stock" | "out_of_stock" | null;
  variant_count: number;
};

export type ListFilters = {
  q?: string;
  sport_id?: string;
  category_id?: string;
  brand_id?: string;
  min_price?: number;
  max_price?: number;
  attr?: Record<string, string>; // attribute slug -> value
  featured?: boolean;
  /** Explicit product ids (landing-page curation). Order is preserved by the caller. */
  ids?: string[];
  sort?: "newest" | "price_asc" | "price_desc" | "name";
  page?: number;
};

export const PER_PAGE = 24;

/**
 * The sports to promote on the landing page, in the owner's order.
 *
 * Read live from the taxonomy rather than stored in the section content, so a
 * rename, reorder, photo change or hide/unhide under /admin/sports is visible on
 * the storefront immediately with nothing to republish.
 *
 * Two switches decide what appears, and they mean different things:
 *   is_visible   the sport exists for shoppers at all (nav, listing, its page).
 *   is_featured  "promote this in the homepage tiles" — the per-sport control
 *                for the landing page. Untick it and the sport keeps its page
 *                and its place in navigation, but loses its tile.
 * With no sport featured the section renders nothing, which is also how the
 * owner removes it for one sport at a time without touching the page builder.
 *
 * A read failure returns no tiles — the landing page keeps its other sections
 * instead of erroring out.
 */
export async function getShopBySport(limit = 12): Promise<SportTile[]> {
  const db = await createClient();
  const { data, error } = await db
    .from("sports")
    .select("id,name,slug,image_path,image_alt")
    .eq("is_visible", true)
    .eq("is_featured", true)
    .is("deleted_at", null)
    .order("sort_order")
    .order("name")
    .limit(Math.min(Math.max(Math.trunc(limit) || 12, 1), 12));
  if (error) return [];
  const sports = data ?? [];
  if (sports.length === 0) return [];
  // Fixes §2.1: hide sports with zero published products (e.g. Cricket,
  // Tennis right now). An empty sport keeps its page (honest empty state
  // there redirects — see sport/[slug]), but loses its homepage tile.
  const { data: counts } = await db
    .from("products")
    .select("sport_id")
    .eq("status", "published")
    .is("deleted_at", null)
    .in(
      "sport_id",
      sports.map((s) => s.id),
    )
    .limit(500);
  const withStock = new Set((counts ?? []).map((r) => r.sport_id));
  return sports.filter((s) => withStock.has(s.id));
}

type Db = Awaited<ReturnType<typeof createClient>>;

/** Header/footer navigation: visible taxonomy only (anon RLS already filters). */
export async function getNav(): Promise<{ sports: NavSport[]; categories: NavCategory[]; brands: NavSport[] }> {
  const db = await createClient();
  const [sports, cats, brands] = await Promise.all([
    db.from("sports").select("id,name,slug").eq("is_visible", true).is("deleted_at", null).order("sort_order").order("name"),
    db.from("categories").select("id,name,slug,sport_id").eq("is_visible", true).is("deleted_at", null).order("name"),
    db.from("brands").select("id,name,slug").eq("is_visible", true).is("deleted_at", null).order("name"),
  ]);
  return {
    sports: sports.data ?? [],
    categories: cats.data ?? [],
    brands: brands.data ?? [],
  };
}

/**
 * Availability rollup: the worst status across a product's active variants
 * (for badges) plus each variant's own status (so a card's Add-to-cart button
 * is judged on the variant it would actually add).
 */
async function availabilityMap(
  db: Db,
  productIds: string[],
): Promise<{
  product: Map<string, "in_stock" | "low_stock" | "out_of_stock">;
  variant: Map<string, "in_stock" | "low_stock" | "out_of_stock">;
}> {
  const product = new Map<string, "in_stock" | "low_stock" | "out_of_stock">();
  const variant = new Map<string, "in_stock" | "low_stock" | "out_of_stock">();
  if (productIds.length === 0) return { product, variant };
  const { data } = await db
    .from("variant_availability")
    .select("variant_id,product_id,status")
    .in("product_id", productIds);
  const rank = { out_of_stock: 0, low_stock: 1, in_stock: 2 } as const;
  for (const row of data ?? []) {
    const s = row.status as "in_stock" | "low_stock" | "out_of_stock";
    variant.set(row.variant_id, s);
    const cur = product.get(row.product_id);
    if (!cur || rank[s] < rank[cur]) product.set(row.product_id, s);
  }
  return { product, variant };
}

async function hydrateCards(
  db: Db,
  ids: string[],
): Promise<
  Map<
    string,
    Pick<
      ProductCard,
      "primary_image" | "availability" | "variant_count" | "brand_name" | "default_variant_id" | "default_variant_status"
    >
  >
> {
  type Hydrated = Pick<
    ProductCard,
    "primary_image" | "availability" | "variant_count" | "brand_name" | "default_variant_id" | "default_variant_status"
  >;
  const map = new Map<string, Hydrated>();
  if (ids.length === 0) return map;
  const [imgs, avail, variants] = await Promise.all([
    db.from("product_images").select("product_id,storage_path,alt_text,is_primary,sort_order").in("product_id", ids).order("sort_order").limit(ids.length * 5),
    availabilityMap(db, ids),
    db
      .from("product_variants")
      .select("id,product_id,is_default,sort_order")
      .in("product_id", ids)
      .eq("is_active", true)
      .is("deleted_at", null),
  ]);
  const counts = new Map<string, number>();
  const defaults = new Map<string, { id: string; isDefault: boolean; sortOrder: number }>();
  for (const v of variants.data ?? []) {
    counts.set(v.product_id, (counts.get(v.product_id) ?? 0) + 1);
    const cur = defaults.get(v.product_id);
    const better =
      !cur ||
      (v.is_default && !cur.isDefault) ||
      (v.is_default === cur.isDefault && (v.sort_order ?? 0) < cur.sortOrder);
    if (better) defaults.set(v.product_id, { id: v.id, isDefault: v.is_default, sortOrder: v.sort_order ?? 0 });
  }
  const byProduct = new Map<string, typeof imgs.data>();
  for (const img of imgs.data ?? []) {
    const list = byProduct.get(img.product_id) ?? [];
    list.push(img);
    byProduct.set(img.product_id, list);
  }
  for (const id of ids) {
    const list = (byProduct.get(id) ?? []).slice().sort((a, b) =>
      a.is_primary === b.is_primary ? a.sort_order - b.sort_order : a.is_primary ? -1 : 1,
    );
    const picked = defaults.get(id);
    map.set(id, {
      primary_image: list[0] ?? null,
      availability: avail.product.get(id) ?? "out_of_stock",
      default_variant_id: picked?.id ?? null,
      default_variant_status: picked ? (avail.variant.get(picked.id) ?? null) : null,
      variant_count: counts.get(id) ?? 0,
      brand_name: null,
    });
  }
  return map;
}

/** Strip PostgREST `or()` metacharacters from free-text search. */
function cleanSearch(q: string): string {
  return q.replace(/[,()]/g, " ").trim().slice(0, 100);
}

/** Upper bound on rows pulled back per search facet (keeps the query bounded). */
const SEARCH_FACET_LIMIT = 300;
/** Upper bound on matched ids handed to the listing query. */
const SEARCH_ID_LIMIT = 500;

/**
 * Build a `%term%` pattern safe to embed in a PostgREST filter.
 *
 * ILIKE wildcards and the characters PostgREST's `or()`/`like` grammar treats
 * as syntax are stripped, so a customer typing `%` or `*` cannot widen the
 * match, and a typed quote cannot break out of the filter.
 */
function likeTerm(term: string): string {
  const bare = term.replace(/[%_*"'\\]/g, "").slice(0, 60);
  return `%${bare}%`;
}

/**
 * Resolve a search phrase to product ids, using everything the shop knows
 * about a product: its own text, the taxonomy it sits in, its variants and its
 * specs.
 *
 * Why matching only `products.name`/`slug` was wrong (the bug this fixes): the
 * seeded badminton product is named "Yonex Double Racket", so neither its name
 * nor its slug contains the word a customer types. "badminton" therefore
 * returned nothing even though it is the correct, spelled-correctly word. The
 * product is filed under the `badminton` sport and category; that is the link
 * a shopper expects search to use.
 *
 * Terms are intersected, so `football boots` narrows to football boots rather
 * than widening to everything matching either word. Every set is recomputed
 * from the database on each search — nothing is cached or enumerated in code —
 * so a product added in the admin is searchable on the very next query.
 *
 * Returns `null` when the phrase has no usable terms (1-character input),
 * which lets the caller keep the plain name/slug behaviour.
 */
async function searchProductIds(db: Db, q: string): Promise<string[] | null> {
  const terms = q
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)
    .slice(0, 6);
  if (terms.length === 0) return null;

  /** Ids of published, non-deleted products only — never leak drafts. */
  const publishedIds = async (
    column: "sport_id" | "category_id" | "brand_id",
    values: string[],
  ): Promise<string[]> => {
    if (values.length === 0) return [];
    const { data } = await db
      .from("products")
      .select("id")
      .eq("status", "published")
      .is("deleted_at", null)
      .in(column, values)
      .limit(SEARCH_FACET_LIMIT);
    return (data ?? []).map((r) => r.id);
  };

  const perTerm: Set<string>[] = [];

  for (const term of terms) {
    const like = likeTerm(term);
    const [ownText, sportRows, catRows, brandRows, variantRows, specRows] = await Promise.all([
      db
        .from("products")
        .select("id")
        .eq("status", "published")
        .is("deleted_at", null)
        .or(`name.ilike.${like},slug.ilike.${like},description.ilike.${like}`)
        .limit(SEARCH_FACET_LIMIT),
      db.from("sports").select("id").eq("is_visible", true).is("deleted_at", null).ilike("name", like).limit(SEARCH_FACET_LIMIT),
      db.from("categories").select("id").eq("is_visible", true).is("deleted_at", null).ilike("name", like).limit(SEARCH_FACET_LIMIT),
      db.from("brands").select("id").eq("is_visible", true).is("deleted_at", null).ilike("name", like).limit(SEARCH_FACET_LIMIT),
      db
        .from("product_variants")
        .select("product_id")
        .is("deleted_at", null)
        .or(`name.ilike.${like},sku.ilike.${like}`)
        .limit(SEARCH_FACET_LIMIT),
      db.from("product_attribute_values").select("product_id").ilike("value_text", like).limit(SEARCH_FACET_LIMIT),
    ]);

    const ids = new Set<string>();
    for (const row of ownText.data ?? []) ids.add(row.id);
    for (const row of variantRows.data ?? []) ids.add(row.product_id);
    for (const row of specRows.data ?? []) ids.add(row.product_id);

    // Products filed under a sport / category / brand whose name matched.
    const [bySport, byCategory, byBrand] = await Promise.all([
      publishedIds("sport_id", (sportRows.data ?? []).map((r) => r.id)),
      publishedIds("category_id", (catRows.data ?? []).map((r) => r.id)),
      publishedIds("brand_id", (brandRows.data ?? []).map((r) => r.id)),
    ]);
    for (const id of [...bySport, ...byCategory, ...byBrand]) ids.add(id);

    perTerm.push(ids);
    // Nothing matched this term, so the AND can only get smaller: stop early.
    if (ids.size === 0) break;
  }

  // AND across terms: keep only ids that matched every term.
  let result: Set<string> = perTerm[0] ?? new Set<string>();
  for (const ids of perTerm.slice(1)) {
    result = new Set([...result].filter((id) => ids.has(id)));
    if (result.size === 0) break;
  }

  return [...result].slice(0, SEARCH_ID_LIMIT);
}

export type TaxonomyHit = {
  id: string;
  name: string;
  slug: string;
  kind: "sport" | "category";
  /** Category hits carry their linked sport's slug, so callers link the canonical /sport/* URL directly. */
  sportSlug: string | null;
};

/**
 * Sports and categories whose name matches the phrase, so the search page can
 * offer a way into the right aisle even when no product matches yet (e.g. a
 * sport the owner has created but not stocked). Never invents results — an
 * unmatched word yields an empty list.
 */
export async function searchTaxonomy(q: string): Promise<TaxonomyHit[]> {
  const terms = q
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)
    .slice(0, 4);
  if (terms.length === 0) return [];

  const db = await createClient();
  const hits: TaxonomyHit[] = [];
  for (const term of terms) {
    const like = likeTerm(term);
    const [sports, cats] = await Promise.all([
      db.from("sports").select("id,name,slug").eq("is_visible", true).is("deleted_at", null).ilike("name", like).order("sort_order").limit(8),
      db
        .from("categories")
        .select("id,name,slug,sport_id,sports:sport_id(slug)")
        .eq("is_visible", true)
        .is("deleted_at", null)
        .ilike("name", like)
        .order("name")
        .limit(8),
    ]);
    for (const s of sports.data ?? []) hits.push({ ...s, kind: "sport", sportSlug: null });
    for (const c of (cats.data ?? []) as {
      id: string;
      name: string;
      slug: string;
      sports: { slug: string } | { slug: string }[] | null;
    }[]) {
      const linked = Array.isArray(c.sports) ? (c.sports[0] ?? null) : c.sports;
      hits.push({ id: c.id, name: c.name, slug: c.slug, kind: "category", sportSlug: linked?.slug ?? null });
    }
  }
  // De-duplicate (a word can match the same row on two passes).
  const seen = new Set<string>();
  return hits.filter((h) => (seen.has(`${h.kind}:${h.id}`) ? false : (seen.add(`${h.kind}:${h.id}`), true)));
}

/** Sort column + direction for the listing query (validated — never raw user input). */
function sortSpec(sort: ListFilters["sort"]): { column: string; ascending: boolean } {
  switch (sort) {
    case "price_asc":
      return { column: "base_price", ascending: true };
    case "price_desc":
      return { column: "base_price", ascending: false };
    case "name":
      return { column: "name", ascending: true };
    case "newest":
    default:
      return { column: "published_at", ascending: false };
  }
}

/** Published product listing with filters + pagination. One page, capped. */
export async function listProducts(
  filters: ListFilters = {},
): Promise<{ cards: ProductCard[]; total: number; page: number; perPage: number }> {
  const db = await createClient();
  const page = Math.min(50, Math.max(1, Math.floor(filters.page ?? 1)));
  const from = (page - 1) * PER_PAGE;
  const to = from + PER_PAGE - 1;

  let query = db
    .from("products")
    .select("id,slug,name,base_price,compare_at_price,is_featured,brands(name)", { count: "exact" })
    .eq("status", "published")
    .is("deleted_at", null);

  if (filters.sport_id) query = query.eq("sport_id", filters.sport_id);
  if (filters.category_id) query = query.eq("category_id", filters.category_id);
  if (filters.brand_id) query = query.eq("brand_id", filters.brand_id);
  if (filters.featured) query = query.eq("is_featured", true);
  if (filters.ids && filters.ids.length > 0) {
    const ids = filters.ids.filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 24);
    if (ids.length === 0) return { cards: [], total: 0, page, perPage: PER_PAGE };
    query = query.in("id", ids);
  }
  if (filters.min_price !== undefined) query = query.gte("base_price", filters.min_price);
  if (filters.max_price !== undefined) query = query.lte("base_price", filters.max_price);
  if (filters.q) {
    const needle = cleanSearch(filters.q);
    if (needle) {
      const matched = await searchProductIds(db, needle);
      if (matched === null) {
        // Too short to tokenise — keep the plain name/slug match.
        query = query.or(`name.ilike.%${needle}%,slug.ilike.%${needle}%`);
      } else if (matched.length === 0) {
        return { cards: [], total: 0, page, perPage: PER_PAGE };
      } else {
        query = query.in("id", matched);
      }
    }
  }
  if (filters.attr && Object.keys(filters.attr).length > 0) {
    // Attribute filter via semi-join: products carrying ALL requested specs.
    const pairs = Object.entries(filters.attr).slice(0, 5);
    const defs = await db.from("attribute_definitions").select("id,slug").in("slug", pairs.map(([s]) => s));
    const bySlug = new Map((defs.data ?? []).map((d) => [d.slug, d.id]));
    for (const [slug, value] of pairs) {
      const attrId = bySlug.get(slug);
      if (!attrId) continue;
      const { data: hits } = await db
        .from("product_attribute_values")
        .select("product_id")
        .eq("attribute_id", attrId)
        .eq("value_text", value);
      const ids = (hits ?? []).map((h) => h.product_id);
      if (ids.length === 0) {
        return { cards: [], total: 0, page, perPage: PER_PAGE };
      }
      query = query.in("id", ids.slice(0, 500));
    }
  }

  const spec = sortSpec(filters.sort);
  const ordered = query.order(spec.column, { ascending: spec.ascending });
  const { data, count, error } = await ordered.range(from, to);
  if (error && /range/i.test(error.message)) {
    // PostgREST answers 416 ("Requested range not satisfiable") when the
    // requested offset starts past the last row — which a hand-typed or crafted
    // `?page=99999` produces, since the page clamp alone cannot know how many
    // rows exist. Ask for page 1 purely to read the real total, then render a
    // normal empty page instead of throwing a 500 at the customer.
    const first = await ordered.range(0, PER_PAGE - 1);
    return { cards: [], total: first.count ?? 0, page, perPage: PER_PAGE };
  }
  if (error) throw new Error(`Catalog query failed: ${error.message}`);

  const rows = data ?? [];
  const extra = await hydrateCards(db, rows.map((r: { id: string }) => r.id));
  const cards: ProductCard[] = rows.map(
    (r: {
      id: string; slug: string; name: string; base_price: number;
      compare_at_price: number | null; is_featured: boolean;
      brands: { name: string } | { name: string }[] | null;
    }) => {
      const brand = Array.isArray(r.brands) ? r.brands[0]?.name ?? null : (r.brands?.name ?? null);
      const e = extra.get(r.id);
      return {
        id: r.id,
        slug: r.slug,
        name: r.name,
        base_price: r.base_price,
        compare_at_price: r.compare_at_price,
        is_featured: r.is_featured,
        brand_name: brand,
        primary_image: e?.primary_image ?? null,
        availability: e?.availability ?? "out_of_stock",
        default_variant_id: e?.default_variant_id ?? null,
        default_variant_status: e?.default_variant_status ?? null,
        variant_count: e?.variant_count ?? 0,
      };
    },
  );
  return { cards, total: count ?? 0, page, perPage: PER_PAGE };
}

export type ProductDetail = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  base_price: number;
  compare_at_price: number | null;
  is_featured: boolean;
  brand_name: string | null;
  sport_name: string | null;
  category_name: string | null;
  sport_slug: string | null;
  category_slug: string | null;
  variants: {
    id: string;
    name: string;
    sku: string | null;
    price: number | null;
    options: Record<string, string>;
    is_default: boolean;
    is_active: boolean;
    on_hand: number;
    reserved: number;
    available: number;
    tracked: boolean;
    status: "in_stock" | "low_stock" | "out_of_stock";
  }[];
  images: { id: string; storage_path: string; alt_text: string | null; is_primary: boolean; sort_order: number; variant_id: string | null }[];
  specs: { name: string; slug: string; value: string }[];
};

/** Full product detail by slug. Returns null when not publicly visible. */
export async function getProduct(slug: string): Promise<ProductDetail | null> {
  const db = await createClient();
  const { data: p } = await db
    .from("products")
    .select("id,slug,name,description,base_price,compare_at_price,is_featured,brands(name),sports: sport_id(name,slug),categories: category_id(name,slug)")
    .eq("slug", slug)
    .eq("status", "published")
    .is("deleted_at", null)
    .single();
  if (!p) return null;

  const [variantsRes, imagesRes, availRes, specsRes] = await Promise.all([
    db.from("product_variants").select("id,name,sku,price,options,is_default,is_active").eq("product_id", p.id).is("deleted_at", null).order("sort_order"),
    db.from("product_images").select("id,storage_path,alt_text,is_primary,sort_order,variant_id").eq("product_id", p.id).order("sort_order"),
    db.from("variant_availability").select("variant_id,status").eq("product_id", p.id),
    db.from("product_attribute_values").select("value_text,attribute_definitions!inner(name,slug)").eq("product_id", p.id),
  ]);

  // Counts come from the server-only stock helper (the public
  // `variant_availability` projection carries status only, by design).
  const stock = await getVariantStock((variantsRes.data ?? []).map((v) => v.id));
  const avail = new Map((availRes.data ?? []).map((a) => [a.variant_id, a.status as "in_stock" | "low_stock" | "out_of_stock"]));
  const one = <T>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: p.description,
    base_price: p.base_price,
    compare_at_price: p.compare_at_price,
    is_featured: p.is_featured,
    brand_name: one(p.brands as { name: string } | { name: string }[] | null)?.name ?? null,
    sport_name: one(p.sports as { name: string; slug: string } | { name: string; slug: string }[] | null)?.name ?? null,
    category_name: one(p.categories as { name: string; slug: string } | { name: string; slug: string }[] | null)?.name ?? null,
    sport_slug: one(p.sports as { name: string; slug: string } | { name: string; slug: string }[] | null)?.slug ?? null,
    category_slug: one(p.categories as { name: string; slug: string } | { name: string; slug: string }[] | null)?.slug ?? null,
    variants: (variantsRes.data ?? []).map((v) => {
      const s = stock.get(v.id);
      const onHand = s?.onHand ?? 0;
      const reserved = s?.reserved ?? 0;
      const viewStatus = avail.get(v.id);
      return {
        id: v.id,
        name: v.name,
        sku: v.sku,
        price: v.price,
        options: (v.options ?? {}) as Record<string, string>,
        is_default: v.is_default,
        is_active: v.is_active,
        on_hand: onHand,
        reserved,
        available: s?.available ?? 0,
        tracked: s?.tracked ?? true,
        // The public projection is the source of truth for the label; a missing
        // entry for a variant we could not read stays "out_of_stock".
        status: viewStatus ?? "out_of_stock",
      };
    }),
    images: (imagesRes.data ?? []).slice().sort((a, b) =>
      a.is_primary === b.is_primary ? a.sort_order - b.sort_order : a.is_primary ? -1 : 1,
    ),
    specs: (specsRes.data ?? []).map((s) => {
      const def = one(s.attribute_definitions as { name: string; slug: string } | { name: string; slug: string }[] | null);
      return { name: def?.name ?? "", slug: def?.slug ?? "", value: s.value_text };
    }),
  };
}

/** Related products: same category, else same sport, else newest. Max 4. */
export async function getRelated(product: ProductDetail): Promise<ProductCard[]> {
  const db = await createClient();
  const { data: prod } = await db.from("products").select("category_id,sport_id").eq("id", product.id).single();
  if (!prod) return [];
  if (prod.category_id) {
    const { cards } = await listProducts({ category_id: prod.category_id, page: 1 });
    const same = cards.filter((c) => c.id !== product.id).slice(0, 4);
    if (same.length > 0) return same;
  }
  if (prod.sport_id) {
    const { cards } = await listProducts({ sport_id: prod.sport_id, page: 1 });
    const same = cards.filter((c) => c.id !== product.id).slice(0, 4);
    if (same.length > 0) return same;
  }
  const { cards } = await listProducts({ page: 1 });
  return cards.filter((c) => c.id !== product.id).slice(0, 4);
}

/** Facets for the listing filter panel. */
export async function getFacets(current: ListFilters): Promise<{
  brands: { id: string; name: string; slug: string }[];
  priceBounds: { min: number; max: number };
  attributes: { slug: string; name: string; values: string[] }[];
}> {
  const db = await createClient();
  const [brandsRes, boundsRes, defsRes] = await Promise.all([
    db.from("brands").select("id,name,slug").eq("is_visible", true).is("deleted_at", null).order("name"),
    db.from("products").select("base_price").eq("status", "published").is("deleted_at", null).order("base_price", { ascending: true }).limit(2000),
    db.from("attribute_definitions").select("id,slug,name,input_type,options").eq("is_filterable", true).order("sort_order"),
  ]);
  const prices = (boundsRes.data ?? []).map((r) => Number(r.base_price)).filter(Number.isFinite);
  void current;
  return {
    brands: brandsRes.data ?? [],
    priceBounds: { min: prices[0] ?? 0, max: prices[prices.length - 1] ?? 0 },
    attributes: (defsRes.data ?? []).map((d) => ({
      slug: d.slug,
      name: d.name,
      values: Array.isArray(d.options) ? (d.options as string[]) : [],
    })),
  };
}

/** Static-ish CMS page by slug (Phase 07 wires the builder; this renders published rows). */
export async function getPage(slug: string): Promise<{ title: string; body: string } | null> {
  const db = await createClient();
  const { data } = await db
    .from("pages")
    .select("title,page_sections!inner(content)")
    .eq("slug", slug)
    .eq("status", "published")
    .is("deleted_at", null)
    .single();
  if (!data) return null;
  const sections = (data.page_sections ?? []) as { content: unknown }[];
  const texts = sections
    .map((s) => {
      const c = s.content as { text?: string; body?: string } | null;
      return typeof c?.text === "string" ? c.text : typeof c?.body === "string" ? c.body : "";
    })
    .filter(Boolean);
  return { title: (data as { title?: string }).title ?? slug, body: texts.join("\n\n") };
}

/** Public shop contact facts (blank values stay hidden per D23). */
export async function getShopInfo(): Promise<Record<string, string>> {
  const db = await createClient();
  const { data } = await db.from("store_settings").select("key,value").like("key", "public.%");
  const out: Record<string, string> = {};
  for (const row of data ?? []) {
    const v = typeof row.value === "string" ? row.value : JSON.stringify(row.value);
    if (v && v !== "" && v !== "null" && v !== '""') out[row.key] = String(row.value ?? "");
  }
  return out;
}
