import Link from "next/link";
import { cardImage } from "@/lib/storefront/images";
import { formatLKR } from "@/lib/storefront/money";
import type { ProductCard as Card } from "@/lib/storefront/catalog";
import { AddToCartButton } from "./AddToCartButton";
import { SaveButton } from "./SaveButton";

/** Design fallback mark (.mk): a serif monogram when a product has no photo. */
function monogram(name: string): string {
  const words = name
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "WS";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/**
 * Product card, exactly as the canonical design: square image (gradient
 * fallback + monogram when there is no photo), the `.off` badge for stock or a
 * discount, name, price with a struck-through compare-at, and `Add to cart`.
 */
export function ProductCard({ product }: { product: Card }) {
  const img = product.primary_image ? cardImage(product.primary_image) : null;
  const compare = product.compare_at_price !== null ? Number(product.compare_at_price) : null;
  const onSale = compare !== null && compare > Number(product.base_price);
  const off =
    product.availability === "out_of_stock"
      ? "Out of stock"
      : onSale && compare
        ? `−${Math.round((1 - Number(product.base_price) / compare) * 100)}%`
        : null;

  const addable = product.default_variant_id !== null && product.default_variant_status !== "out_of_stock";

  return (
    <article className="card">
      <Link href={`/product/${product.slug}`} aria-label={product.name}>
        <div className="img">
          {img ? (
            // Plain <img>: the design's layout is governed by `.img`, and the
            // supabase derivatives are already sized (IM-V6).
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={img.src}
              alt={product.primary_image?.alt_text || product.name}
              loading="lazy"
              decoding="async"
            />
          ) : (
            <span className="mk" aria-hidden="true">
              {monogram(product.name)}
            </span>
          )}
          {off && <span className="off">{off}</span>}
        </div>
        <div className="info">
          <span className="nm">{product.name}</span>
          <span className="pr">
            {formatLKR(product.base_price)}
            {onSale && <s>{formatLKR(product.compare_at_price)}</s>}
          </span>
          {product.brand_name && <span className="sold">{product.brand_name}</span>}
        </div>
      </Link>
      <AddToCartButton variantId={addable ? product.default_variant_id : null} />
      <SaveButton productId={product.id} productName={product.name} />
    </article>
  );
}
