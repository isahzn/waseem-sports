import Link from "next/link";
import { notFound } from "next/navigation";
import { getProduct, getRelated } from "@/lib/storefront/catalog";
import { ProductCard } from "../../_components/ProductCard";
import { VariantPicker } from "./VariantPicker";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return { title: "Product — Waseem Sports" };
  return {
    title: product.name ? `${product.name} — Waseem Sports` : "Product — Waseem Sports",
    description: product.description?.slice(0, 160) ?? `Buy ${product.name} at Waseem Sports. Cash on delivery.`,
    alternates: { canonical: `/product/${product.slug}` },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();
  const related = await getRelated(product);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description ?? undefined,
    brand: product.brand_name ? { "@type": "Brand", name: product.brand_name } : undefined,
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "LKR",
      lowPrice: Math.min(...product.variants.map((v) => v.price ?? product.base_price)),
      offerCount: product.variants.length,
      availability: product.variants.some((v) => v.status !== "out_of_stock")
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
  };

  return (
    <main className="flex flex-col gap-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link href="/shop" className="hover:text-ink">Shop</Link>
        {product.category_name && product.category_slug && (
          <>
            {" / "}
            <Link href={`/category/${product.category_slug}`} className="hover:text-ink">
              {product.category_name}
            </Link>
          </>
        )}
        {" / "}
        <span aria-current="page" className="text-ink">{product.name}</span>
      </nav>

      <VariantPicker product={product} />

      {product.description && (
        <section aria-labelledby="desc" className="max-w-3xl">
          <h2 id="desc" className="font-display text-2xl font-bold">About this product</h2>
          <p className="mt-2 whitespace-pre-line text-muted">{product.description}</p>
        </section>
      )}

      {product.specs.length > 0 && (
        <section aria-labelledby="specs" className="max-w-3xl">
          <h2 id="specs" className="font-display text-2xl font-bold">Specifications</h2>
          <dl className="mt-3 overflow-hidden rounded-md border border-line">
            {product.specs.map((s) => (
              <div key={s.slug} className="grid grid-cols-2 border-b border-line last:border-0">
                <dt className="bg-card px-4 py-2 text-sm text-muted">{s.name}</dt>
                <dd className="px-4 py-2 text-sm font-semibold">{s.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {related.length > 0 && (
        <section aria-labelledby="related">
          <h2 id="related" className="font-display text-2xl font-bold">You may also like</h2>
          <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
