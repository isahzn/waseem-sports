import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { formatPostDate, getJournalPost } from "@/lib/storefront/journal";

/** Journal posts are CMS pages kept under the reserved `blog/` slug namespace. */
async function loadPost(slug: string) {
  // A single route segment only; anything with a dot, slash or encoding is
  // rejected by the slug guard inside getJournalPost.
  return getJournalPost(`blog/${slug}`);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await loadPost(slug);
  if (!post) return { title: "Journal — Waseem Sports" };
  return {
    title: `${post.title} — Waseem Sports`,
    description: post.excerpt,
    alternates: { canonical: `/blog/${slug}` },
  };
}

export default async function JournalPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await loadPost(slug);
  if (!post) notFound();

  const date = formatPostDate(post.publishedAt);

  return (
    <main>
      <p className="sold mt-0">
        <Link href="/blog" className="underline">
          ← Journal
        </Link>
      </p>

      <h1 style={{ fontSize: "40px" }}>{post.title}</h1>
      {date && <p className="sold mt-1">{date}</p>}

      <div className="box mt-3">
        <p className="whitespace-pre-line mt-0">{post.body}</p>
      </div>

      <p className="sold mt-3">
        <Link href="/shop" className="underline">
          Shop the gear
        </Link>{" "}
        ·{" "}
        <Link href="/contact" className="underline">
          Ask us anything
        </Link>
      </p>
    </main>
  );
}
