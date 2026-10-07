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
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <nav aria-label="Breadcrumb" className="sold" style={{ marginBottom: 12 }}>
        <Link href="/shop">Back to shop</Link>
        {product.category_name && product.category_slug && (
          <>
            {" · "}
            <Link href={`/category/${product.category_slug}`}>{product.category_name}</Link>
          </>
        )}
        {" · "}
        <span aria-current="page">{product.name}</span>
      </nav>

      <VariantPicker product={product} />

      {product.description && (
        <section aria-labelledby="desc">
          <div className="sec">
            <h2 id="desc">About this product</h2>
          </div>
          <div className="box">
            <p style={{ margin: 0, whiteSpace: "pre-line" }}>{product.description}</p>
          </div>
        </section>
      )}

      {product.specs.length > 0 && (
        <section aria-labelledby="specs">
          <div className="sec">
            <h2 id="specs">Specifications</h2>
          </div>
          <div className="box tw">
            <table>
              <tbody>
                {product.specs.map((s) => (
                  <tr key={s.slug}>
                    <th scope="row">{s.name}</th>
                    <td>{s.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section aria-labelledby="related">
          <div className="sec">
            <h2 id="related">You may also like</h2>
          </div>
          <div className="grid">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
