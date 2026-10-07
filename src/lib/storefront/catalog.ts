import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getVariantStock } from "./availability";

export type NavSport = { id: string; name: string; slug: string };
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
  sort?: "newest" | "price_asc" | "price_desc" | "name";
  page?: number;
};

export const PER_PAGE = 24;

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

/** Availability rollup: worst status across a product's active variants. */
async function availabilityMap(
  db: Db,
  productIds: string[],
): Promise<Map<string, "in_stock" | "low_stock" | "out_of_stock">> {
  const out = new Map<string, "in_stock" | "low_stock" | "out_of_stock">();
  if (productIds.length === 0) return out;
  const { data } = await db.from("variant_availability").select("product_id,status").in("product_id", productIds);
  const rank = { out_of_stock: 0, low_stock: 1, in_stock: 2 } as const;
  for (const row of data ?? []) {
    const s = row.status as "in_stock" | "low_stock" | "out_of_stock";
    const cur = out.get(row.product_id);
    if (!cur || rank[s] < rank[cur]) out.set(row.product_id, s);
  }
  return out;
}

async function hydrateCards(
  db: Db,
  ids: string[],
): Promise<Map<string, Pick<ProductCard, "primary_image" | "availability" | "variant_count" | "brand_name">>> {
  const map = new Map<string, Pick<ProductCard, "primary_image" | "availability" | "variant_count" | "brand_name">>();
  if (ids.length === 0) return map;
  const [imgs, avail, variants] = await Promise.all([
    db.from("product_images").select("product_id,storage_path,alt_text,is_primary,sort_order").in("product_id", ids).order("sort_order").limit(ids.length * 5),
    availabilityMap(db, ids),
    db.from("product_variants").select("product_id").in("product_id", ids).eq("is_active", true).is("deleted_at", null),
  ]);
  const counts = new Map<string, number>();
  for (const v of variants.data ?? []) counts.set(v.product_id, (counts.get(v.product_id) ?? 0) + 1);
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
    map.set(id, {
      primary_image: list[0] ?? null,
      availability: avail.get(id) ?? "out_of_stock",
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
  if (filters.min_price !== undefined) query = query.gte("base_price", filters.min_price);
  if (filters.max_price !== undefined) query = query.lte("base_price", filters.max_price);
  if (filters.q) {
    const needle = cleanSearch(filters.q);
    if (needle) query = query.or(`name.ilike.%${needle}%,slug.ilike.%${needle}%`);
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
  const { data, count, error } = await query
    .order(spec.column, { ascending: spec.ascending })
    .range(from, to);
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
