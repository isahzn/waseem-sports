import Link from "next/link";
import type { Metadata } from "next";
import { formatPostDate, listJournalPosts } from "@/lib/storefront/journal";

export const metadata: Metadata = {
  title: "Journal — Waseem Sports",
  description: "Gear notes, new arrivals and buying help from the Waseem Sports shop.",
  alternates: { canonical: "/blog" },
};

/** Card mark, matching the design's `.mk` fallback used on product photos. */
function mark(title: string): string {
  const words = title
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "WS";
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}

/** `/blog/<slug>` maps onto a CMS page stored as `blog/<slug>`. */
function postHref(slug: string): string {
  return `/blog/${slug.replace(/^blog\//, "")}`;
}

function teaser(excerpt: string, max = 110): string {
  return excerpt.length <= max ? excerpt : `${excerpt.slice(0, max - 1).trimEnd()}…`;
}

export default async function JournalIndexPage() {
  const posts = await listJournalPosts();

  return (
    <main>
      <h1 style={{ fontSize: "40px" }}>Journal</h1>
      <p className="sold mt-1">
        Gear notes, new arrivals and buying help — written by the shop.
      </p>

      {posts.length === 0 ? (
        <div className="box mt-3">
          <h2>The first posts are on the way</h2>
          <p className="sold">
            Nothing is published yet. We are writing up gear guides and buying help for the season.
          </p>
          <p>
            <Link className="btn" href="/shop">
              Browse the shop
            </Link>
          </p>
        </div>
      ) : (
        <div className="grid mt-3">
          {posts.map((post) => {
            const date = formatPostDate(post.publishedAt);
            return (
              <article className="card" key={post.slug}>
                <Link href={postHref(post.slug)} aria-label={post.title}>
                  <div className="img">
                    <span className="mk" aria-hidden="true">
                      {mark(post.title)}
                    </span>
                  </div>
                  <div className="info">
                    <span className="nm">{post.title}</span>
                    {date && <span className="sold">{date}</span>}
                    {post.excerpt && <span className="sold">{teaser(post.excerpt)}</span>}
                  </div>
                </Link>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
