"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { cardImage } from "@/lib/storefront/images";
import { formatLKR } from "@/lib/storefront/money";
import { removeFromWishlist, useWishlistIds } from "@/lib/storefront/saved-items";
import { AddToCartButton } from "../_components/AddToCartButton";

type ImageRow = { storage_path: string; alt_text: string | null; is_primary: boolean; sort_order: number };

type SavedItem = {
  id: string;
  slug: string;
  name: string;
  basePrice: number;
  compareAt: number | null;
  brand: string | null;
  image: ImageRow | null;
  defaultVariantId: string | null;
  status: "in_stock" | "low_stock" | "out_of_stock";
};

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function monogram(name: string): string {
  const words = name
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "WS";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** Load the saved ids' products, stock and variants in one pass (anon reads). */
async function fetchItems(ids: string[]): Promise<Map<string, SavedItem>> {
  const db = createClient();
  const [products, images, variants, availability] = await Promise.all([
    db.from("products").select("id,slug,name,base_price,compare_at_price,brands(name)").in("id", ids).eq("status", "published").is("deleted_at", null),
    db.from("product_images").select("product_id,storage_path,alt_text,is_primary,sort_order").in("product_id", ids).order("sort_order"),
    db.from("product_variants").select("id,product_id,name,is_default,sort_order").in("product_id", ids).eq("is_active", true).is("deleted_at", null),
    db.from("variant_availability").select("variant_id,product_id,status").in("product_id", ids),
  ]);
  if (products.error) throw new Error(products.error.message);

  const imageByProduct = new Map<string, ImageRow>();
  for (const row of (images.data ?? []) as (ImageRow & { product_id: string })[]) {
    const current = imageByProduct.get(row.product_id);
    if (!current || (row.is_primary && !current.is_primary) || (row.is_primary === current.is_primary && row.sort_order < current.sort_order)) {
      imageByProduct.set(row.product_id, {
        storage_path: row.storage_path,
        alt_text: row.alt_text,
        is_primary: row.is_primary,
        sort_order: row.sort_order,
      });
    }
  }

  // The variant a card would add: the default one, else the first by sort order
  // (same rule as the catalog's own card hydration).
  const defaultVariant = new Map<string, string>();
  const picked = new Map<string, { id: string; isDefault: boolean; sortOrder: number }>();
  for (const row of (variants.data ?? []) as { id: string; product_id: string; is_default: boolean; sort_order: number | null }[]) {
    const current = picked.get(row.product_id);
    const better =
      !current ||
      (row.is_default && !current.isDefault) ||
      (row.is_default === current.isDefault && (row.sort_order ?? 0) < current.sortOrder);
    if (better) picked.set(row.product_id, { id: row.id, isDefault: row.is_default, sortOrder: row.sort_order ?? 0 });
  }
  for (const [productId, variant] of picked) defaultVariant.set(productId, variant.id);

  const statusByVariant = new Map<string, "in_stock" | "low_stock" | "out_of_stock">();
  const rank = { out_of_stock: 0, low_stock: 1, in_stock: 2 } as const;
  const statusByProduct = new Map<string, "in_stock" | "low_stock" | "out_of_stock">();
  for (const row of (availability.data ?? []) as { variant_id: string; product_id: string; status: string }[]) {
    const status = row.status as "in_stock" | "low_stock" | "out_of_stock";
    statusByVariant.set(row.variant_id, status);
    const current = statusByProduct.get(row.product_id);
    if (!current || rank[status] < rank[current]) statusByProduct.set(row.product_id, status);
  }

  const out = new Map<string, SavedItem>();
  for (const row of (products.data ?? []) as {
    id: string;
    slug: string;
    name: string;
    base_price: number;
    compare_at_price: number | null;
    brands: { name: string } | { name: string }[] | null;
  }[]) {
    const variantId = defaultVariant.get(row.id) ?? null;
    out.set(row.id, {
      id: row.id,
      slug: row.slug,
      name: row.name,
      basePrice: Number(row.base_price),
      compareAt: row.compare_at_price === null ? null : Number(row.compare_at_price),
      brand: one(row.brands)?.name ?? null,
      image: imageByProduct.get(row.id) ?? null,
      defaultVariantId: variantId,
      status: statusByProduct.get(row.id) ?? "out_of_stock",
    });
  }
  // A variant that is itself out of stock must not be offered.
  for (const item of out.values()) {
    if (item.defaultVariantId && statusByVariant.get(item.defaultVariantId) === "out_of_stock") {
      item.defaultVariantId = null;
    }
  }
  return out;
}

export function WishlistView() {
  const ids = useWishlistIds();
  const [items, setItems] = useState<SavedItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Nothing saved: no fetch and no state writes — the empty state below is
    // derived, so this effect never sets state synchronously.
    if (ids.length === 0) return;
    let cancelled = false;
    void (async () => {
      try {
        const found = await fetchItems(ids);
        if (cancelled) return;
        setItems(ids.map((id) => found.get(id)).filter((item): item is SavedItem => Boolean(item)));
        setError(null);
      } catch {
        if (!cancelled) setError("We couldn't load your saved items. Check your connection and try again.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ids]);

  const saved = ids.length === 0 ? ([] as SavedItem[]) : items ?? [];
  const loading = ids.length > 0 && items === null;

  if (loading) return <p className="sold">Loading your saved items…</p>;

  if (error) {
    return (
      <div className="box" role="alert">
        <h2>Your wishlist didn&apos;t load</h2>
        <p className="sold">{error}</p>
        <p>
          <Link className="btn" href="/shop">
            Browse products
          </Link>
        </p>
      </div>
    );
  }

  if (saved.length === 0) {
    return (
      <div className="box">
        <h2>Your wishlist is empty</h2>
        <p className="sold">
          Tap Save on any product and it will be kept here on this device — no account needed.
        </p>
        <p>
          <Link className="btn" href="/shop">
            Browse products
          </Link>
        </p>
      </div>
    );
  }

  return (
    <>
      <p className="sold">
        {saved.length} saved item{saved.length === 1 ? "" : "s"} · kept on this device only.
      </p>
      <div className="grid">
        {saved.map((item) => {
          const img = item.image ? cardImage(item.image) : null;
          const onSale = item.compareAt !== null && item.compareAt > item.basePrice;
          const off = item.status === "out_of_stock" ? "Out of stock" : onSale && item.compareAt ? `−${Math.round((1 - item.basePrice / item.compareAt) * 100)}%` : null;
          return (
            <article className="card" key={item.id}>
              <Link href={`/product/${item.slug}`} aria-label={item.name}>
                <div className="img">
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img.src} alt={item.image?.alt_text || item.name} loading="lazy" decoding="async" />
                  ) : (
                    <span className="mk" aria-hidden="true">
                      {monogram(item.name)}
                    </span>
                  )}
                  {off && <span className="off">{off}</span>}
                </div>
                <div className="info">
                  <span className="nm">{item.name}</span>
                  <span className="pr">
                    {formatLKR(item.basePrice)}
                    {onSale && <s>{formatLKR(item.compareAt)}</s>}
                  </span>
                  {item.brand && <span className="sold">{item.brand}</span>}
                </div>
              </Link>
              <AddToCartButton variantId={item.defaultVariantId} />
              <button
                type="button"
                className="sold mx-2.5 mb-2.5 border-0 bg-transparent p-0 text-left"
                aria-label={`Remove ${item.name} from wishlist`}
                onClick={() => removeFromWishlist(item.id)}
              >
                Remove
              </button>
            </article>
          );
        })}
      </div>
    </>
  );
}
