import Link from "next/link";
import { cardImage } from "@/lib/storefront/images";
import { formatLKR } from "@/lib/storefront/money";
import type { ProductCard as Card } from "@/lib/storefront/catalog";

/**
 * Product card per the canonical design: square image, name, price.
 * No photo → neutral "no photo yet" block (D19). Never a broken image.
 */
export function ProductCard({ product }: { product: Card }) {
  const img = product.primary_image ? cardImage(product.primary_image) : null;
  const onSale =
    product.compare_at_price !== null && Number(product.compare_at_price) > Number(product.base_price);

  return (
    <article className="overflow-hidden rounded-md border border-line bg-card">
      <Link href={`/product/${product.slug}`} aria-label={product.name} className="block">
        {img ? (
          // Plain img with explicit dimensions: IM-V6 interim (no Next optimiser dependency).
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img.src}
            width={img.width}
            height={img.height}
            alt={product.primary_image?.alt_text || product.name}
            loading="lazy"
            decoding="async"
            className="aspect-square w-full object-cover"
          />
        ) : (
          <div role="img" aria-label={`${product.name} — no photo yet`} className="flex aspect-square w-full items-center justify-center bg-pine-950 px-4 text-center">
            <span className="text-sm text-muted">No photo yet</span>
          </div>
        )}
      </Link>
      <div className="p-3">
        {product.brand_name && <p className="text-xs text-muted">{product.brand_name}</p>}
        <h3 className="mt-0.5 font-semibold">
          <Link href={`/product/${product.slug}`} className="hover:underline">
            {product.name}
          </Link>
        </h3>
        <p className="mt-1 flex flex-wrap items-baseline gap-2">
          <span className="font-bold">{formatLKR(product.base_price)}</span>
          {onSale && (
            <s className="text-xs text-muted">{formatLKR(product.compare_at_price)}</s>
          )}
        </p>
        <p className="mt-1 text-xs">
          {product.availability === "out_of_stock" ? (
            <span className="font-semibold text-red-300">Out of stock</span>
          ) : product.availability === "low_stock" ? (
            <span className="font-semibold text-gold-400">Low stock</span>
          ) : (
            <span className="text-muted">In stock</span>
          )}
        </p>
      </div>
    </article>
  );
}
