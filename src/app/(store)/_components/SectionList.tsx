import Link from "next/link";
import { parseSectionContent } from "@/lib/cms/sections";
import type { RenderedSection } from "@/lib/cms/pages";
import { getNav, getShopBySport, listProducts } from "@/lib/storefront/catalog";
import { publicImageUrl } from "@/lib/storefront/images";
import { ProductCard } from "./ProductCard";
import { Hero, type HeroSlide } from "./Hero";
import { Countdown } from "./Countdown";

/**
 * Renders the landing page from CMS sections, in the order the owner set in
 * the admin builder. Each section re-validates its own stored content and
 * renders nothing when it cannot be trusted — the rest of the page still
 * renders. Every section is a server component: the grids read the catalog on
 * the server, so no content work happens in the browser.
 */

async function HeroSection({ content }: { content: Record<string, unknown> }) {
  const c = parseSectionContent("hero", content);
  if (!c) return null;
  const slides: HeroSlide[] = c.slides.map((s) => ({
    background: s.background,
    title: s.title,
    text: s.text,
    href: s.href,
    image: s.image_path ? { src: publicImageUrl(s.image_path), alt: "" } : null,
  }));
  return <Hero slides={slides} />;
}

/**
 * "Shop by sport" — the primary way into the catalog: one photo tile per sport
 * the owner has chosen to promote. The tiles are read live from the sports
 * taxonomy (name, photo, order, which sports appear), so this section only owns
 * its heading and cap; the owner manages the rest under /admin/sports.
 */
async function SportTilesSection({ content }: { content: Record<string, unknown> }) {
  const c = parseSectionContent("sport_tiles", content);
  if (!c) return null;
  const tiles = await getShopBySport(c.limit);
  if (tiles.length === 0) return null;
  // Fixes §2.1: under each sport show its top 10 products + a "See all"
  // button into that sport's page. Tiles with no products never arrive here
  // (getShopBySport filters them), so Cricket/Tennis stay hidden until stocked.
  const spotlights = await Promise.all(
    tiles.map(async (tile) => {
      const { cards } = await listProducts({ sport_id: tile.id, sort: "newest", page: 1 });
      return { tile, cards: cards.slice(0, 10) };
    }),
  );
  return (
    <>
      <div className="sec">
        <h2>{c.title || "Shop by sport"}</h2>
        <Link className="btn out" href="/shop">
          All products
        </Link>
      </div>
      <div className="sports">
        {tiles.map((tile) => (
          <Link className="sport" key={tile.id} href={`/sport/${tile.slug}`}>
            {tile.image_path ? (
              /* eslint-disable-next-line @next/next/no-img-element -- pre-made derivative, served directly (see lib/storefront/images.ts) */
              <img
                src={publicImageUrl(tile.image_path)}
                // Decorative: the sport name below is already the link's text,
                // so repeating the alt text here would say it twice.
                alt=""
                width={640}
                height={420}
                loading="lazy"
              />
            ) : null}
            <b className="nm">{tile.name}</b>
          </Link>
        ))}
      </div>
      {spotlights.map(({ tile, cards }) =>
        cards.length === 0 ? null : (
          <section key={tile.id} aria-label={`${tile.name} products`}>
            <div className="sec">
              <h2>{tile.name}</h2>
              <Link className="btn out" href={`/sport/${tile.slug}`}>
                See all products
              </Link>
            </div>
            <div className="grid">
              {cards.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        ),
      )}
    </>
  );
}

async function CategoryTilesSection({ content }: { content: Record<string, unknown> }) {
  const c = parseSectionContent("category_tiles", content);
  if (!c) return null;
  const nav = await getNav();
  if (nav.categories.length === 0) return null;
  return (
    <>
      {c.title && (
        <div className="sec">
          <h2>{c.title}</h2>
        </div>
      )}
      <div className="cats" role="tablist" aria-label="Shop by category">
        <Link className="chip" href="/shop">
          All
        </Link>
        {nav.categories.slice(0, c.limit).map((cat) => (
          <Link className="chip" key={cat.id} href={`/category/${cat.slug}`}>
            {cat.name}
          </Link>
        ))}
      </div>
    </>
  );
}

async function ProductGridSection({ content }: { content: Record<string, unknown> }) {
  const c = parseSectionContent("product_grid", content);
  if (!c) return null;

  let cards;
  if (c.product_ids.length > 0) {
    // Hand-picked: keep the owner's order, not the query's.
    const { cards: found } = await listProducts({ ids: c.product_ids });
    const byId = new Map(found.map((card) => [card.id, card]));
    cards = c.product_ids
      .map((id) => byId.get(id))
      .filter((card): card is NonNullable<typeof card> => Boolean(card))
      .slice(0, c.limit);
  } else {
    const { cards: found } = await listProducts({
      featured: c.source === "featured",
      sort: c.source === "featured" ? "newest" : c.source,
      page: 1,
    });
    cards = found.slice(0, c.limit);
  }
  if (cards.length === 0) return null;

  return (
    <>
      <div className="sec">
        <h2>{c.title || "Products"}</h2>
        {c.link_label && c.link_href ? (
          <Link className="btn out" href={c.link_href}>
            {c.link_label}
          </Link>
        ) : null}
      </div>
      <div className="grid">
        {cards.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </>
  );
}

function PromoStripSection({ content }: { content: Record<string, unknown> }) {
  const c = parseSectionContent("promo_strip", content);
  if (!c) return null;
  return (
    <div className="trust">
      {c.items.map((item) => (
        <div key={item}>{item}</div>
      ))}
    </div>
  );
}

function CountdownSection({ content }: { content: Record<string, unknown> }) {
  const c = parseSectionContent("promo_countdown", content);
  if (!c) return null;
  return (
    <div className="deal" style={{ marginTop: 22 }}>
      <div className="sec" style={{ margin: "6px 0 4px" }}>
        <h2 style={{ fontSize: 28 }}>{c.title}</h2>
        <Countdown endsAt={c.ends_at} />
      </div>
      {c.text && <p className="sold">{c.text}</p>}
      <Link className="btn" href={c.href}>
        {c.label}
      </Link>
    </div>
  );
}

function RichTextSection({ content }: { content: Record<string, unknown> }) {
  const c = parseSectionContent("rich_text", content);
  if (!c || (!c.title && !c.body)) return null;
  return (
    <>
      {c.title && (
        <div className="sec">
          <h2>{c.title}</h2>
        </div>
      )}
      {c.body && (
        <div className="box">
          <p style={{ margin: 0, whiteSpace: "pre-line" }}>{c.body}</p>
        </div>
      )}
    </>
  );
}

export async function SectionList({ sections }: { sections: RenderedSection[] }) {
  return (
    <>
      {sections.map((section) => {
        switch (section.type) {
          case "hero":
            return <HeroSection key={section.id} content={section.content} />;
          case "sport_tiles":
            return <SportTilesSection key={section.id} content={section.content} />;
          case "category_tiles":
            return <CategoryTilesSection key={section.id} content={section.content} />;
          case "product_grid":
            return <ProductGridSection key={section.id} content={section.content} />;
          case "promo_strip":
            return <PromoStripSection key={section.id} content={section.content} />;
          case "promo_countdown":
            return <CountdownSection key={section.id} content={section.content} />;
          case "rich_text":
            return <RichTextSection key={section.id} content={section.content} />;
          default:
            return null;
        }
      })}
    </>
  );
}
