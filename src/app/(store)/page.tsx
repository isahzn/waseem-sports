import Link from "next/link";
import { getNav, listProducts } from "@/lib/storefront/catalog";
import { cardImage } from "@/lib/storefront/images";
import { ProductCard } from "./_components/ProductCard";

export const metadata = {
  title: "Waseem Sports — Sports Gear in Sri Lanka",
  description: "Quality sports gear in Colombo, Sri Lanka. Cash on delivery, island-wide shipping.",
};

/**
 * Home: temporary hardcoded section composition (Phase 07 wires the CMS).
 * Sections mirror the canonical design: hero slides, category chips,
 * best sellers (featured), full grid, trust row.
 */
export default async function HomePage() {
  const [nav, featured, latest] = await Promise.all([
    getNav(),
    listProducts({ page: 1 }),
    listProducts({ sort: "newest", page: 1 }),
  ]);
  const featuredCards = [...featured.cards].filter((c) => c.availability !== "out_of_stock").slice(0, 4);
  const heroPicks = latest.cards.slice(0, 3);

  return (
    <main className="flex flex-col gap-10">
      <section aria-label="Featured" className="grid gap-4 md:grid-cols-3">
        {heroPicks.length === 0 && (
          <div className="rounded-md border border-line bg-pine-950 p-8 md:col-span-3">
            <h1 className="font-display text-4xl font-bold">Waseem Sports</h1>
            <p className="mt-2 max-w-md text-muted">
              Quality sports gear is on its way to this shelf. The catalog opens as soon as the
              first products are published.
            </p>
            <Link href="/shop" className="mt-4 inline-block rounded-sm bg-gold-600 px-5 py-2.5 text-sm font-semibold text-bronze-ink">
              Browse the shop
            </Link>
          </div>
        )}
        {heroPicks.map((p) => {
          const img = p.primary_image ? cardImage(p.primary_image) : null;
          return (
            <Link
              key={p.id}
              href={`/product/${p.slug}`}
              className="relative overflow-hidden rounded-md border border-line bg-pine-950"
            >
              {img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={img.src}
                  width={img.width}
                  height={img.height}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="aspect-[4/3] w-full object-cover opacity-80"
                />
              ) : (
                <div aria-hidden="true" className="aspect-[4/3] w-full bg-pine-900" />
              )}
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                <span className="font-display text-2xl font-bold text-white">{p.name}</span>
                <span className="mt-1 block text-sm font-semibold text-gold-400">Shop now →</span>
              </span>
            </Link>
          );
        })}
      </section>

      {nav.categories.length > 0 && (
        <section aria-label="Categories">
          <ul className="flex flex-wrap gap-2">
            {nav.categories.slice(0, 12).map((c) => (
              <li key={c.id}>
                <Link
                  href={`/category/${c.slug}`}
                  className="inline-block rounded-sm border border-line bg-card px-4 py-2 text-sm font-semibold hover:border-gold-600"
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {featuredCards.length > 0 && (
        <section aria-labelledby="best-sellers">
          <h2 id="best-sellers" className="font-display text-3xl font-bold">Best sellers</h2>
          <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
            {featuredCards.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {latest.cards.length > 0 && (
        <section aria-labelledby="picked">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="picked" className="font-display text-3xl font-bold">Picked for you</h2>
            <Link href="/shop" className="rounded-sm border border-line px-4 py-2 text-sm font-semibold">
              See all
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
            {latest.cards.slice(0, 8).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      <section aria-label="Why shop with us" className="grid gap-3 rounded-md border border-line bg-card p-5 sm:grid-cols-2 lg:grid-cols-4">
        {["Cash on delivery", "Island-wide delivery", "Genuine products", "Easy returns"].map((t) => (
          <p key={t} className="text-sm font-semibold">{t}</p>
        ))}
      </section>
    </main>
  );
}
