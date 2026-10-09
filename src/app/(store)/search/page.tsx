import Link from "next/link";
import { searchTaxonomy } from "@/lib/storefront/catalog";
import { ListingPage, type ListingSearch } from "../_components/ListingPage";

export const metadata = {
  title: "Search — Waseem Sports",
  description: "Search the Waseem Sports catalog.",
};

/**
 * Search results.
 *
 * The matching itself lives in `listProducts` (`lib/storefront/catalog.ts`): it
 * looks at the product's own text plus the sport, category, brand, variant and
 * spec records it is attached to, so a word like "badminton" finds the badminton
 * products even when their names are brand names. This page adds the second
 * half of a useful result — a way straight into a matching sport or category,
 * which matters most when the shop has created the aisle but not stocked it yet.
 */
export default async function SearchPage({ searchParams }: { searchParams: Promise<ListingSearch> }) {
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.trim().slice(0, 100) ?? "";

  const hits = q ? await searchTaxonomy(q) : [];
  const sports = hits.filter((h) => h.kind === "sport");
  const categories = hits.filter((h) => h.kind === "category");

  const topContent =
    hits.length > 0 ? (
      <div className="box mt-3">
        <p className="sold mt-0">Jump to a section</p>
        <div className="cats" style={{ marginTop: 8 }}>
          {sports.map((s) => (
            <Link key={s.id} className="chip" href={`/sport/${s.slug}`}>
              {s.name}
            </Link>
          ))}
          {categories.map((c) => (
            <Link key={c.id} className="chip" href={c.sportSlug ? `/sport/${c.sportSlug}` : `/category/${c.slug}`}>
              {c.name}
            </Link>
          ))}
        </div>
      </div>
    ) : null;

  return (
    <ListingPage
      title={q ? `Results for “${q}”` : "Search"}
      subtitle={
        q
          ? undefined
          : "Type a word above — a sport (football, badminton), a product, or a brand."
      }
      basePath="/search"
      scope={q ? { q } : {}}
      searchParams={sp}
      topContent={topContent}
    />
  );
}
