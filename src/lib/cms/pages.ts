import "server-only";
import { createClient } from "@/lib/supabase/server";
import { defaultContent, isSectionType, parseSectionContent, type SectionType } from "./sections";

/**
 * CMS reads for pages + their sections.
 *
 * The storefront renders whatever the owner publishes; a section whose stored
 * content does not validate is skipped (never rendered half-written). When no
 * landing page exists at all, the storefront falls back to
 * `defaultLandingSections()` — the composition the design ships with — so the
 * home page is never blank.
 */

export const LANDING_SLUG = "home";

export type RenderedSection = {
  id: string;
  type: SectionType;
  content: Record<string, unknown>;
  sort_order: number;
};

export type PageSummary = {
  id: string;
  slug: string;
  title: string;
  status: string;
  updated_at: string | null;
  published_at: string | null;
  section_count: number;
};

export type AdminSection = {
  id: string;
  page_id: string;
  type: SectionType;
  content: Record<string, unknown>;
  draft_content: Record<string, unknown> | null;
  is_visible: boolean;
  sort_order: number;
};

export type AdminPage = {
  id: string;
  slug: string;
  title: string;
  status: string;
  seo_title: string | null;
  seo_description: string | null;
  published_at: string | null;
  updated_at: string | null;
};

/** The design's own landing composition — also the seed's, and the fallback. */
export function defaultLandingSections(): RenderedSection[] {
  return [
    {
      id: "default-hero",
      type: "hero",
      sort_order: 0,
      content: {
        slides: [
          {
            title: "Game on",
            text: "Footballs, basketballs and racquets, ready to play.",
            background: "linear-gradient(120deg,#062418,#0f4a33)",
            href: "/shop",
            image_path: "",
          },
          {
            title: "New arrivals",
            text: "Skating shoes and swim gear just landed.",
            background: "linear-gradient(120deg,#2b2109,#7a5f1e)",
            href: "/shop",
            image_path: "",
          },
          {
            title: "Train at home",
            text: "Dumbbells, gym gloves and more, delivered fast.",
            background: "linear-gradient(120deg,#0a120e,#0b3d2a)",
            href: "/shop",
            image_path: "",
          },
        ],
      },
    },
    { id: "default-cats", type: "category_tiles", sort_order: 1, content: { title: "", limit: 12 } },
    {
      id: "default-best",
      type: "product_grid",
      sort_order: 2,
      content: { title: "Best sellers", source: "featured", limit: 5, link_label: "", link_href: "", product_ids: [] },
    },
    {
      id: "default-picked",
      type: "product_grid",
      sort_order: 3,
      content: { title: "Picked for you", source: "newest", limit: 12, link_label: "See all", link_href: "/shop", product_ids: [] },
    },
    { id: "default-trust", type: "promo_strip", sort_order: 4, content: defaultContent("promo_strip") },
  ];
}

/** Visible, valid sections of the published page at `slug` (empty when none). */
export async function getPublishedSections(slug: string): Promise<RenderedSection[]> {
  const db = await createClient();
  const { data: page } = await db
    .from("pages")
    .select("id")
    .eq("slug", slug)
    .eq("status", "published")
    .is("deleted_at", null)
    .maybeSingle();
  if (!page) return [];

  const { data } = await db
    .from("page_sections")
    .select("id,type,content,sort_order")
    .eq("page_id", page.id)
    .eq("is_visible", true)
    .order("sort_order", { ascending: true });

  const out: RenderedSection[] = [];
  for (const row of data ?? []) {
    if (!isSectionType(row.type)) continue;
    const content = parseSectionContent(row.type, row.content);
    if (!content) continue;
    out.push({ id: row.id, type: row.type, content: content as Record<string, unknown>, sort_order: row.sort_order });
  }
  return out;
}

/** Landing sections, or the design's default composition when unpublished. */
export async function getLandingSections(): Promise<RenderedSection[]> {
  const sections = await getPublishedSections(LANDING_SLUG);
  return sections.length > 0 ? sections : defaultLandingSections();
}

/** Admin: every page with its section count. */
export async function listPages(): Promise<PageSummary[]> {
  const db = await createClient();
  const { data: pages } = await db
    .from("pages")
    .select("id,slug,title,status,updated_at,published_at")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });
  const rows = pages ?? [];
  if (rows.length === 0) return [];

  const { data: sections } = await db
    .from("page_sections")
    .select("page_id")
    .in("page_id", rows.map((p) => p.id));
  const counts = new Map<string, number>();
  for (const s of sections ?? []) counts.set(s.page_id, (counts.get(s.page_id) ?? 0) + 1);

  return rows.map((p) => ({ ...p, section_count: counts.get(p.id) ?? 0 }));
}

/** Admin: one page plus ALL of its sections, including hidden ones. */
export async function getPageWithSections(
  id: string,
): Promise<{ page: AdminPage; sections: AdminSection[] } | null> {
  const db = await createClient();
  const { data: page } = await db
    .from("pages")
    .select("id,slug,title,status,seo_title,seo_description,published_at,updated_at")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!page) return null;

  const { data: sections } = await db
    .from("page_sections")
    .select("id,page_id,type,content,draft_content,is_visible,sort_order")
    .eq("page_id", id)
    .order("sort_order", { ascending: true });

  return {
    page,
    sections: (sections ?? [])
      .filter((s) => isSectionType(s.type))
      .map((s) => ({
        id: s.id,
        page_id: s.page_id,
        type: s.type as SectionType,
        content: (s.content ?? {}) as Record<string, unknown>,
        draft_content: (s.draft_content ?? null) as Record<string, unknown> | null,
        is_visible: s.is_visible,
        sort_order: s.sort_order,
      })),
  };
}
