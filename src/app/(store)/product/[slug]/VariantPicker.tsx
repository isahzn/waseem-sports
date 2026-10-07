"use client";

import { useMemo, useState } from "react";
import { heroImage } from "@/lib/storefront/images";
import { formatLKR } from "@/lib/storefront/money";
import type { ProductDetail } from "@/lib/storefront/catalog";
import { useCart } from "../../_components/CartProvider";

/**
 * PDP purchase panel: gallery + variant picker + quantity + add to cart.
 * Price comes from the selected variant (override or base) — the client never
 * invents a price; checkout re-prices server-side via priceCart (Phase 05).
 * Out-of-stock variants are disabled with a clear label (D11).
 */
export function VariantPicker({ product }: { product: ProductDetail }) {
  const { add } = useCart();
  const activeVariants = useMemo(
    () => product.variants.filter((v) => v.is_active),
    [product],
  );
  const [variantId, setVariantId] = useState(
    activeVariants.find((v) => v.status !== "out_of_stock")?.id ?? activeVariants[0]?.id ?? "",
  );
  const [qty, setQty] = useState(1);

  const variant = activeVariants.find((v) => v.id === variantId) ?? activeVariants[0];
  const price = variant && variant.price !== null ? variant.price : product.base_price;

  // Gallery: selected variant's images first, then the rest (primary first).
  const gallery = useMemo(() => {
    if (!variant) return product.images;
    const own = product.images.filter((i) => i.variant_id === variant.id);
    const rest = product.images.filter((i) => i.variant_id !== variant.id);
    return [...own, ...rest];
  }, [product.images, variant]);
  const [imageId, setImageId] = useState<string | null>(null);
  const current = gallery.find((i) => i.id === imageId) ?? gallery[0];
  const hero = current ? heroImage(current) : null;

  const selectable = variant && variant.status !== "out_of_stock";
  const maxQty = variant ? (variant.tracked ? Math.min(100, Math.max(1, variant.available)) : 100) : 1;
  const optionEntries = variant ? Object.entries(variant.options ?? {}) : [];

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div>
        {hero ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={hero.src}
            width={hero.width}
            height={hero.height}
            alt={current?.alt_text || product.name}
            fetchPriority="high"
            className="aspect-square w-full rounded-md border border-line object-cover"
          />
        ) : (
          <div role="img" aria-label={`${product.name} — no photo yet`} className="flex aspect-square w-full items-center justify-center rounded-md border border-line bg-pine-950">
            <span className="text-muted">No photo yet</span>
          </div>
        )}
        {gallery.length > 1 && (
          <ul aria-label="Product photos" className="mt-3 grid grid-cols-5 gap-2">
            {gallery.map((img) => (
              <li key={img.id}>
                <button
                  type="button"
                  onClick={() => setImageId(img.id)}
                  aria-pressed={current?.id === img.id}
                  aria-label={`View photo${img.alt_text ? `: ${img.alt_text}` : ""}`}
                  className={`overflow-hidden rounded-sm border ${current?.id === img.id ? "border-gold-600" : "border-line"}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}/storage/v1/object/public/product-media/${img.storage_path.replace(/(\.[a-z]+)$/, "-thumb$1")}`}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    width={400}
                    height={400}
                    className="aspect-square w-full object-cover"
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        {product.brand_name && <p className="text-sm text-muted">{product.brand_name}</p>}
        <h1 className="mt-1 font-display text-4xl font-bold">{product.name}</h1>
        <p className="mt-3 text-3xl font-bold" aria-live="polite">
          {formatLKR(price)}
          {product.compare_at_price !== null && Number(product.compare_at_price) > Number(product.base_price) && (
            <s className="ml-3 text-lg font-normal text-muted">{formatLKR(product.compare_at_price)}</s>
          )}
        </p>
        <p className="mt-2 text-sm">
          {variant && variant.status === "out_of_stock" ? (
            <span className="font-semibold text-red-300">Out of stock</span>
          ) : variant && variant.status === "low_stock" ? (
            <span className="font-semibold text-gold-400">Low stock — only {variant.available} left</span>
          ) : (
            <span className="text-muted">In stock</span>
          )}
        </p>

        {activeVariants.length > 1 && (
          <fieldset className="mt-5">
            <legend className="font-semibold">Choose an option</legend>
            <ul className="mt-2 flex flex-wrap gap-2">
              {activeVariants.map((v) => {
                const oos = v.status === "out_of_stock";
                return (
                  <li key={v.id}>
                    <button
                      type="button"
                      disabled={oos}
                      onClick={() => {
                        setVariantId(v.id);
                        setQty(1);
                        setImageId(null);
                      }}
                      aria-pressed={v.id === variant?.id}
                      aria-label={oos ? `${v.name} — out of stock` : v.name}
                      title={oos ? "Out of stock" : v.name}
                      className={`rounded-sm border px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 disabled:line-through ${
                        v.id === variant?.id ? "border-gold-600 bg-gold-600 text-bronze-ink" : "border-line"
                      }`}
                    >
                      {v.name}
                    </button>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        )}

        {optionEntries.length > 0 && (
          <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
            {optionEntries.map(([k, val]) => (
              <div key={k} className="rounded-sm bg-card px-3 py-1.5">
                <dt className="text-xs text-muted">{k}</dt>
                <dd className="font-semibold">{val}</dd>
              </div>
            ))}
          </dl>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <span className="font-semibold">Qty</span>
            <input
              type="number"
              min={1}
              max={maxQty}
              value={qty}
              onChange={(e) => setQty(Math.min(maxQty, Math.max(1, Number(e.target.value) || 1)))}
              disabled={!selectable}
              className="w-20 rounded-sm border border-line bg-surface px-3 py-2"
            />
          </label>
          <button
            type="button"
            disabled={!selectable || !variant}
            onClick={() => variant && add(variant.id, qty)}
            className="rounded-sm bg-gold-600 px-6 py-2.5 text-sm font-semibold text-bronze-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            {selectable ? "Add to cart" : "Out of stock"}
          </button>
        </div>
        {!selectable && (
          <p className="mt-2 text-sm text-muted">This option is out of stock. Pick another above.</p>
        )}
      </div>
    </div>
  );
}
