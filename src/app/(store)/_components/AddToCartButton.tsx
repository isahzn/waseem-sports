"use client";

import { useCart } from "./CartProvider";

/**
 * The design's `.add` button on a product card. Disabled (and relabelled) when
 * the variant it would add has no stock, so a customer never queues an
 * impossible line — the cart re-prices and re-checks server-side anyway.
 */
export function AddToCartButton({
  variantId,
  label = "Add to cart",
  disabledLabel = "Out of stock",
  className = "add",
}: {
  variantId: string | null;
  label?: string;
  disabledLabel?: string;
  className?: string;
}) {
  const { add } = useCart();
  const disabled = !variantId;

  return (
    <button
      type="button"
      className={className}
      disabled={disabled}
      aria-disabled={disabled}
      onClick={() => variantId && add(variantId, 1)}
    >
      {disabled ? disabledLabel : label}
    </button>
  );
}
