import Link from "next/link";
import { notFound } from "next/navigation";
import { getProduct, getRelated, getShopInfo } from "@/lib/storefront/catalog";
import { formatLKR } from "@/lib/storefront/money";
import { whatsappHref } from "@/lib/storefront/contact-links";
import { ProductCard } from "../../_components/ProductCard";
import { RecordView, RecentlyViewedRow } from "../../_components/RecentlyViewed";
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
  const [related, info] = await Promise.all([getRelated(product), getShopInfo()]);
  const whatsapp = info["public.store_whatsapp"] ? whatsappHref(info["public.store_whatsapp"]!) : null;
  const askText = `Hi Waseem Sports! I have a question about ${product.name} (${product.slug}).`;
  const askHref = whatsapp ? `${whatsapp}?text=${encodeURIComponent(askText)}` : null;

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
        {product.sport_name && product.sport_slug ? (
          <>
            {" · "}
            <Link href={`/sport/${product.sport_slug}`}>{product.sport_name}</Link>
          </>
        ) : product.category_name && product.category_slug ? (
          <>
            {" · "}
            <Link href={`/category/${product.category_slug}`}>{product.category_name}</Link>
          </>
        ) : null}
        {" · "}
        <span aria-current="page">{product.name}</span>
      </nav>

      <RecordView slug={product.slug} name={product.name} price={formatLKR(product.base_price)} />
      <VariantPicker product={product} />

      <div className="box" style={{ marginTop: 16 }}>
        <p className="sold" style={{ margin: 0 }}>
          Cash on delivery — pay the rider when your order arrives. Delivery cost is confirmed with you
          before packing.
        </p>
        {askHref && (
          <p style={{ margin: "10px 0 0" }}>
            <a className="btn out" href={askHref} target="_blank" rel="noopener noreferrer">
              Ask about this product on WhatsApp
            </a>
          </p>
        )}
      </div>

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

      <RecentlyViewedRow currentSlug={product.slug} />

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
