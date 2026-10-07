import { z } from "zod";

/**
 * Landing-page section model (Phase 07).
 *
 * `page_sections.type` is a free-text column validated here, and `content` is
 * jsonb. Every render path parses content with these schemas before use, so a
 * hand-edited or half-written row can never crash a storefront page — it is
 * dropped and the section's default shows instead.
 *
 * Section types mirror the canonical design's own inventory (docs/DESIGN-TOKENS
 * §4): hero carousel, category tiles, product grids, trust strip, countdown
 * deal, rich text.
 */

export const SECTION_TYPES = [
  "hero",
  "category_tiles",
  "product_grid",
  "promo_strip",
  "promo_countdown",
  "rich_text",
] as const;

export type SectionType = (typeof SECTION_TYPES)[number];

export const SECTION_LABELS: Record<SectionType, { name: string; hint: string }> = {
  hero: { name: "Hero carousel", hint: "Full-width slides with a photo, headline and button." },
  category_tiles: { name: "Category chips", hint: "The scrolling chip row of categories." },
  product_grid: { name: "Product grid", hint: "A row of product cards, from a rule or hand-picked." },
  promo_strip: { name: "Trust strip", hint: "Short promises in a row (delivery, payment, returns)." },
  promo_countdown: { name: "Countdown deal", hint: "A bordered promo with a live countdown." },
  rich_text: { name: "Text block", hint: "A heading and paragraph copy." },
};

/** Internal links only for anything the shop owns; absolute http(s) also allowed. */
const hrefField = z
  .string()
  .trim()
  .max(300)
  .refine(
    (v) => v === "" || v.startsWith("/") || /^https?:\/\//.test(v),
    "Links must start with / or http(s)://",
  )
  .default("/shop");

/** The design's own hero gradient — the default for a new slide. */
export const DEFAULT_HERO_BACKGROUND = "linear-gradient(120deg,#062418,#0f4a33)";

const gradientField = z
  .string()
  .trim()
  .max(200)
  .refine(
    (v) => v === "" || /^(linear-gradient|radial-gradient)\([^;{}]*$/.test(v),
    "Use a plain CSS gradient, e.g. linear-gradient(120deg,#062418,#0f4a33)",
  )
  .default(DEFAULT_HERO_BACKGROUND);

const imagePathField = z
  .string()
  .trim()
  .max(500)
  .refine((p) => !p.includes("..") && !p.startsWith("/") && !p.startsWith("\\"), "Invalid image path.")
  .default("");

// ---------- hero ----------

export const heroSlideSchema = z.object({
  title: z.string().trim().min(1, "Slide title is required.").max(80),
  text: z.string().trim().max(240).default(""),
  background: gradientField,
  href: hrefField,
  image_path: imagePathField,
});

export const heroSchema = z.object({
  slides: z.array(heroSlideSchema).min(1, "A carousel needs at least one slide.").max(6),
});

// ---------- category tiles ----------

export const categoryTilesSchema = z.object({
  title: z.string().trim().max(80).default(""),
  limit: z.coerce.number().int().min(1).max(24).default(12),
});

// ---------- product grid ----------

export const PRODUCT_SOURCES = ["featured", "newest", "price_asc", "price_desc", "name"] as const;

export const productGridSchema = z.object({
  title: z.string().trim().max(80).default(""),
  source: z.enum(PRODUCT_SOURCES).default("newest"),
  limit: z.coerce.number().int().min(1).max(24).default(5),
  link_label: z.string().trim().max(40).default(""),
  link_href: hrefField.default(""),
  /** Hand-picked products win over `source` when present (order preserved). */
  product_ids: z.array(z.string().uuid()).max(12).default([]),
});

// ---------- trust strip ----------

export const promoStripSchema = z.object({
  items: z.array(z.string().trim().min(1).max(90)).min(1).max(6),
});

// ---------- countdown deal ----------

export const promoCountdownSchema = z.object({
  title: z.string().trim().max(80).default("Deal of the day"),
  text: z.string().trim().max(240).default(""),
  /** ISO timestamp; empty hides the clock and leaves the copy. */
  ends_at: z
    .string()
    .trim()
    .max(40)
    .refine((v) => v === "" || !Number.isNaN(Date.parse(v)), "Use a valid date and time.")
    .default(""),
  label: z.string().trim().max(40).default("Shop the deal"),
  href: hrefField,
});

// ---------- rich text ----------

export const richTextSchema = z.object({
  title: z.string().trim().max(120).default(""),
  body: z.string().trim().max(8000).default(""),
});

export const SECTION_SCHEMAS = {
  hero: heroSchema,
  category_tiles: categoryTilesSchema,
  product_grid: productGridSchema,
  promo_strip: promoStripSchema,
  promo_countdown: promoCountdownSchema,
  rich_text: richTextSchema,
} as const;

export type SectionContentMap = {
  hero: z.infer<typeof heroSchema>;
  category_tiles: z.infer<typeof categoryTilesSchema>;
  product_grid: z.infer<typeof productGridSchema>;
  promo_strip: z.infer<typeof promoStripSchema>;
  promo_countdown: z.infer<typeof promoCountdownSchema>;
  rich_text: z.infer<typeof richTextSchema>;
};

export type SectionContent = SectionContentMap[SectionType];

/** Parse stored content. Returns null when the row is not usable. */
export function parseSectionContent<K extends SectionType>(
  type: K,
  value: unknown,
): SectionContentMap[K] | null {
  const parsed = SECTION_SCHEMAS[type].safeParse(value);
  // The schema is chosen by the generic `type`, so the parsed value is the
  // matching member of the content map; TypeScript cannot see through the
  // indexed access, hence the cast.
  return parsed.success ? (parsed.data as SectionContentMap[K]) : null;
}

export function isSectionType(value: string): value is SectionType {
  return (SECTION_TYPES as readonly string[]).includes(value);
}

/** Content used for a brand-new section, and for an unreadable row. */
export function defaultContent(type: SectionType): SectionContent {
  switch (type) {
    case "hero":
      return {
        slides: [
          {
            title: "Game on",
            text: "Footballs, basketballs and racquets, ready to play.",
            background: "linear-gradient(120deg,#062418,#0f4a33)",
            href: "/shop",
            image_path: "",
          },
        ],
      };
    case "category_tiles":
      return { title: "", limit: 12 };
    case "product_grid":
      return {
        title: "Best sellers",
        source: "featured",
        limit: 5,
        link_label: "",
        link_href: "",
        product_ids: [],
      };
    case "promo_strip":
      return {
        items: [
          "Free delivery over LKR 10,000",
          "Cash on delivery",
          "7-day easy returns",
          "SMS and email order updates",
        ],
      };
    case "promo_countdown":
      return { title: "Deal of the day", text: "", ends_at: "", label: "Shop the deal", href: "/shop" };
    case "rich_text":
    default:
      return { title: "", body: "" };
  }
}

/** One-line description of a section for the builder's list. */
export function sectionSummary(type: SectionType, content: unknown): string {
  const parsed = parseSectionContent(type, content);
  if (!parsed) return "Content needs attention — showing defaults.";
  switch (type) {
    case "hero": {
      const c = parsed as SectionContentMap["hero"];
      const titles = c.slides.map((s) => s.title).join(", ");
      return `${c.slides.length} slide${c.slides.length === 1 ? "" : "s"}: ${titles}`;
    }
    case "category_tiles": {
      const c = parsed as SectionContentMap["category_tiles"];
      return `Up to ${c.limit} categories${c.title ? ` · ${c.title}` : ""}`;
    }
    case "product_grid": {
      const c = parsed as SectionContentMap["product_grid"];
      const how = c.product_ids.length > 0 ? `${c.product_ids.length} hand-picked` : `by rule: ${c.source}`;
      return `${c.title || "Untitled"} · ${how} · ${c.limit} items`;
    }
    case "promo_strip": {
      const c = parsed as SectionContentMap["promo_strip"];
      return c.items.join(" · ");
    }
    case "promo_countdown": {
      const c = parsed as SectionContentMap["promo_countdown"];
      return c.ends_at ? `Ends ${new Date(c.ends_at).toLocaleString()}` : `${c.title} (no end time set)`;
    }
    case "rich_text": {
      const c = parsed as SectionContentMap["rich_text"];
      const first = c.body.split("\n").find((l) => l.trim()) ?? "";
      return `${c.title || "Text block"}${first ? ` · ${first.slice(0, 60)}` : ""}`;
    }
    default:
      return "";
  }
}

export type FormParseResult =
  | { ok: true; content: SectionContent }
  | { ok: false; errors: string[] };

function text(fd: FormData, key: string): string {
  const v = fd.get(key);
  return v === null ? "" : String(v).trim();
}

function toFieldErrors(error: z.ZodError): string[] {
  return error.issues.map((i) => `${i.path.join(".") || "Value"}: ${i.message}`);
}

/**
 * Build validated content from the builder's FormData. Every field is read
 * defensively — an owner typing into the form is untrusted input.
 */
export function contentFromForm(type: SectionType, fd: FormData): FormParseResult {
  let raw: unknown;
  switch (type) {
    case "hero": {
      const slideCount = Math.min(6, Math.max(1, Number(fd.get("slide_count")) || 1));
      const slides = [];
      for (let i = 0; i < slideCount; i++) {
        const title = text(fd, `slide_${i}_title`);
        if (!title) continue; // an emptied slide row is dropped, not saved blank
        slides.push({
          title,
          text: text(fd, `slide_${i}_text`),
          background: text(fd, `slide_${i}_background`) || DEFAULT_HERO_BACKGROUND,
          href: text(fd, `slide_${i}_href`) || "/shop",
          image_path: text(fd, `slide_${i}_image_path`),
        });
      }
      raw = { slides };
      break;
    }
    case "category_tiles":
      raw = { title: text(fd, "title"), limit: fd.get("limit") };
      break;
    case "product_grid":
      raw = {
        title: text(fd, "title"),
        source: text(fd, "source") || "newest",
        limit: fd.get("limit"),
        link_label: text(fd, "link_label"),
        link_href: text(fd, "link_href"),
        product_ids: fd
          .getAll("product_ids")
          .map((v) => String(v))
          .filter((v) => v.length > 0),
      };
      break;
    case "promo_strip":
      raw = {
        items: text(fd, "items")
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean),
      };
      break;
    case "promo_countdown": {
      const entered = text(fd, "ends_at");
      const parsed = entered ? new Date(entered) : null;
      raw = {
        title: text(fd, "title"),
        text: text(fd, "text"),
        ends_at: parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : "",
        label: text(fd, "label"),
        href: text(fd, "href"),
      };
      break;
    }
    case "rich_text":
      raw = { title: text(fd, "title"), body: text(fd, "body") };
      break;
  }

  const parsed = SECTION_SCHEMAS[type].safeParse(raw);
  if (!parsed.success) return { ok: false, errors: toFieldErrors(parsed.error) };
  return { ok: true, content: parsed.data as SectionContent };
}

/** ISO timestamp → the `datetime-local` value the form input expects. */
export function toLocalInput(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
