"use client";

import { toggleWishlist, useWishlistIds } from "@/lib/storefront/saved-items";

/**
 * Wishlist toggle for a product card. Deliberately quiet: the design's own
 * `.sold` sizing/colour, no new colours and no icons. State is announced via
 * `aria-pressed` plus a label that says which way the click goes.
 */
export function SaveButton({ productId, productName }: { productId: string; productName: string }) {
  const savedIds = useWishlistIds();
  const saved = savedIds.includes(productId);

  return (
    <button
      type="button"
      className="sold mx-2.5 mb-2.5 border-0 bg-transparent p-0 text-left"
      aria-pressed={saved}
      aria-label={saved ? `Remove ${productName} from wishlist` : `Save ${productName} to wishlist`}
      onClick={() => toggleWishlist(productId)}
    >
      {saved ? "Saved" : "Save"}
    </button>
  );
}
