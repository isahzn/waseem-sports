"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { heroImage } from "@/lib/storefront/images";
import { formatLKR } from "@/lib/storefront/money";
import type { ProductDetail } from "@/lib/storefront/catalog";
import { useCart } from "../../_components/CartProvider";

/** Design fallback mark (.mk) for a product with no photo. */
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
 * PDP purchase panel, laid out exactly like the canonical design: `.two` with
 * the `.img.big` gallery on the left and the buy box on the right (44px title,
 * 34px price, `.chip` options, `.q` quantity stepper, `.btn` add / `.btn.alt`
 * buy now). Price comes from the selected variant (override or base) — the
 * client never invents a price; checkout re-prices server-side via priceCart
 * (Phase 05). Out-of-stock variants stay disabled with a clear label (D11).
 */
export function VariantPicker({ product }: { product: ProductDetail }) {
  const { add } = useCart();
  const router = useRouter();
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

  const selectable = Boolean(variant) && variant.status !== "out_of_stock";
  const maxQty = variant ? (variant.tracked ? Math.min(100, Math.max(1, variant.available)) : 100) : 1;
  const optionEntries = variant ? Object.entries(variant.options ?? {}) : [];

  function buyNow() {
    if (!variant || !selectable) return;
    add(variant.id, qty);
    router.push("/cart");
  }

  return (
    <div className="two">
      <div>
        {hero ? (
          <div className="img big" style={{ borderRadius: 4 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={hero.src} alt={current?.alt_text || product.name} fetchPriority="high" width={hero.width} height={hero.height} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        ) : (
          <div className="img big" style={{ borderRadius: 4 }}>
            <span className="mk" aria-hidden="true">
              {monogram(product.name)}
            </span>
          </div>
        )}

        {gallery.length > 1 && (
          <ul aria-label="Product photos" className="cats" style={{ padding: "12px 0" }}>
            {gallery.map((img) => (
              <li key={img.id}>
                <button
                  type="button"
                  onClick={() => setImageId(img.id)}
                  aria-pressed={current?.id === img.id}
                  aria-label={`View photo${img.alt_text ? `: ${img.alt_text}` : ""}`}
                  className={current?.id === img.id ? "chip on" : "chip"}
                  style={{ padding: 0, overflow: "hidden", width: 72 }}
                >
                  <span className="img" style={{ width: "100%" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}/storage/v1/object/public/product-media/${img.storage_path.replace(/(\.[a-z]+)$/, "-thumb$1")}`}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      width={72}
                      height={72}
                    />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        {product.brand_name && <p className="sold" style={{ margin: 0 }}>{product.brand_name}</p>}
        <h1 style={{ fontSize: "44px", marginTop: 4 }}>{product.name}</h1>
        {(product.category_name || product.sport_name) && (
          <p className="sold" style={{ margin: "6px 0 0" }}>
            {[product.category_name, product.sport_name].filter(Boolean).join(" · ")}
          </p>
        )}
        <p className="pr" style={{ fontSize: "34px", margin: "12px 0 4px" }} aria-live="polite">
          {formatLKR(price)}
          {product.compare_at_price !== null && Number(product.compare_at_price) > Number(product.base_price) && (
            <s>{formatLKR(product.compare_at_price)}</s>
          )}
        </p>

        <p className="sold" style={{ margin: 0 }}>
          {variant && variant.status === "out_of_stock" ? (
            <b style={{ color: "var(--au)" }}>Out of stock</b>
          ) : variant && variant.status === "low_stock" ? (
            <b style={{ color: "var(--gl)" }}>Low stock — only {variant.available} left</b>
          ) : (
            <span>In stock</span>
          )}
        </p>

        {activeVariants.length > 1 && (
          <fieldset style={{ border: 0, padding: 0, margin: "16px 0 0" }}>
            <legend style={{ fontWeight: 600, padding: 0 }}>Choose an option</legend>
            <div className="cats" style={{ padding: "8px 0" }}>
              {activeVariants.map((v) => {
                const oos = v.status === "out_of_stock";
                return (
                  <button
                    key={v.id}
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
                    className={v.id === variant?.id ? "chip on" : "chip"}
                    style={oos ? { opacity: 0.5, cursor: "not-allowed", textDecoration: "line-through" } : undefined}
                  >
                    {v.name}
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}

        {optionEntries.length > 0 && (
          <dl className="sold" style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {optionEntries.map(([k, val]) => (
              <div key={k}>
                <dt style={{ fontSize: 12 }}>{k}</dt>
                <dd style={{ margin: 0, fontWeight: 600, color: "var(--tx)" }}>{val}</dd>
              </div>
            ))}
          </dl>
        )}

        <div className="buy-bar" style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span className="q" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              aria-label="Reduce quantity"
              disabled={!selectable || qty <= 1}
              onClick={() => setQty((q) => Math.max(1, q - 1))}
            >
              −
            </button>
            <span aria-live="polite" style={{ minWidth: 18, textAlign: "center", fontWeight: 600 }}>
              {qty}
            </span>
            <button
              type="button"
              aria-label="Increase quantity"
              disabled={!selectable || qty >= maxQty}
              onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
            >
              +
            </button>
          </span>

          <button
            type="button"
            className="btn"
            disabled={!selectable}
            style={{ opacity: selectable ? 1 : 0.5, cursor: selectable ? "pointer" : "not-allowed" }}
            onClick={() => variant && selectable && add(variant.id, qty)}
          >
            {selectable ? "Add to cart" : "Out of stock"}
          </button>

          <button
            type="button"
            className="btn alt"
            disabled={!selectable}
            style={{ opacity: selectable ? 1 : 0.5, cursor: selectable ? "pointer" : "not-allowed" }}
            onClick={buyNow}
          >
            Buy now
          </button>
        </div>

        {!selectable && (
          <p className="sold" style={{ marginTop: 8 }}>
            This option is out of stock. Pick another above.
          </p>
        )}
      </div>
    </div>
  );
}
