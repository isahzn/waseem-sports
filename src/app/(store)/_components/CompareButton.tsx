"use client";

import { toggleCompare, useCompareIds } from "@/lib/storefront/saved-items";

/**
 * Compare toggle for a product card (Fixes §2.5): makes the existing
 * wishlist/compare pages reachable from the card, same quiet `.sold`
 * treatment as SaveButton.
 */
export function CompareButton({ productId, productName }: { productId: string; productName: string }) {
  const ids = useCompareIds();
  const added = ids.includes(productId);

  return (
    <button
      type="button"
      className="sold mx-2.5 mb-2.5 border-0 bg-transparent p-0 text-left"
      aria-pressed={added}
      aria-label={added ? `Remove ${productName} from compare` : `Add ${productName} to compare`}
      onClick={() => toggleCompare(productId)}
    >
      {added ? "Compared ✓" : "Compare"}
    </button>
  );
}
