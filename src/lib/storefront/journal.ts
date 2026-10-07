import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Journal reads.
 *
 * Posts are ordinary CMS pages kept in a reserved slug namespace —
 * `blog/<slug>` — so the owner writes them with the same builder as every
 * other page, and no new table is needed. Only published rows are visible,
 * because the anon RLS policy on `pages` exposes exactly those.
 */

export const JOURNAL_PREFIX = "blog/";

export type JournalPost = {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string | null;
};

export type JournalPostDetail = JournalPost & { body: string };

type SectionRow = { content: unknown; is_visible: boolean | null; sort_order: number | null };

/** Guard for the slug before it is used as a query value. */
export function isJournalSlug(slug: string): boolean {
  return (
    slug.length > JOURNAL_PREFIX.length &&
    slug.length <= 160 &&
    /^blog\/[a-z0-9][a-z0-9/-]*$/.test(slug)
  );
}

/** Text carried by a CMS section, whatever shape its type uses. */
function sectionText(content: unknown): string {
  if (!content || typeof content !== "object") return "";
  const c = content as { body?: unknown; text?: unknown; title?: unknown };
  for (const value of [c.body, c.text, c.title]) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

/** Visible sections, in order, joined into one body. */
function sectionsToBody(rows: SectionRow[] | null | undefined): string {
  return (rows ?? [])
    .filter((s) => s.is_visible !== false)
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((s) => sectionText(s.content))
    .filter(Boolean)
    .join("\n\n");
}

function excerptOf(body: string, max = 200): string {
  const flat = body.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1).trimEnd()}…`;
}

/** Post date in the shop's voice (e.g. "6 October 2026"). */
export function formatPostDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

const SELECT = "slug,title,published_at,page_sections(content,is_visible,sort_order)";

/** Published posts, newest first. Never throws: an empty list is a state. */
export async function listJournalPosts(): Promise<JournalPost[]> {
  const db = await createClient();
  const { data, error } = await db
    .from("pages")
    .select(SELECT)
    .like("slug", `${JOURNAL_PREFIX}%`)
    .eq("status", "published")
    .is("deleted_at", null)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(50);
  if (error || !data) return [];

  return data.map((row) => {
    const body = sectionsToBody(row.page_sections as unknown as SectionRow[]);
    return {
      slug: row.slug,
      title: row.title,
      excerpt: excerptOf(body),
      publishedAt: row.published_at,
    };
  });
}

/** One published post by its full `blog/...` slug, or null when unknown. */
export async function getJournalPost(slug: string): Promise<JournalPostDetail | null> {
  if (!isJournalSlug(slug)) return null;
  const db = await createClient();
  const { data, error } = await db
    .from("pages")
    .select(SELECT)
    .eq("slug", slug)
    .eq("status", "published")
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !data) return null;

  const body = sectionsToBody(data.page_sections as unknown as SectionRow[]);
  return {
    slug: data.slug,
    title: data.title,
    body,
    excerpt: excerptOf(body),
    publishedAt: data.published_at,
  };
}
