import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type VariantStock = {
  variantId: string;
  onHand: number;
  reserved: number;
  /** Sellable units. Untracked variants report a huge number (always sellable). */
  available: number;
  tracked: boolean;
};

type InvRow = {
  variant_id: string;
  on_hand: number;
  reserved: number;
  track_inventory: boolean;
  product_variants:
    | { is_active: boolean; deleted_at: string | null; products: { status: string; deleted_at: string | null } | { status: string; deleted_at: string | null }[] | null }
    | { is_active: boolean; deleted_at: string | null; products: { status: string; deleted_at: string | null } | { status: string; deleted_at: string | null }[] | null }[]
    | null;
};

const one = <T>(value: T | T[] | null): T | null => (Array.isArray(value) ? (value[0] ?? null) : value);

export const UNTRACKED_AVAILABLE = Number.MAX_SAFE_INTEGER;

/**
 * Authoritative per-variant stock for server-rendered storefront surfaces
 * (cart pricing, the product page).
 *
 * Why the service-role client: `inventory` deliberately has no anon RLS policy
 * — the public projection is `variant_availability`, which exposes status only
 * and no quantities (specs/phase-00-fix-spec.md §5.10). The storefront still
 * needs the real count to cap a quantity and to say "only N left", so it is
 * read here, on the server, and only for variants whose product is published,
 * active and not deleted. Nothing about the unpublished catalogue can leak
 * through this helper, and the counts never reach the browser except as the
 * cap/status the customer is already entitled to see.
 *
 * A missing entry means "unknown" (unreadable/unconfigured), not "zero": the
 * callers must not turn an infrastructure failure into a phantom
 * out-of-stock, because `place_order` is the authoritative gate anyway.
 */
export async function getVariantStock(variantIds: string[]): Promise<Map<string, VariantStock>> {
  const out = new Map<string, VariantStock>();
  const ids = [...new Set(variantIds.filter((id) => typeof id === "string" && id.length > 0))].slice(0, 200);
  if (ids.length === 0) return out;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("inventory")
      .select("variant_id,on_hand,reserved,track_inventory,product_variants!inner(is_active,deleted_at,products!inner(status,deleted_at))")
      .in("variant_id", ids);
    if (error || !data) return out;

    for (const row of data as unknown as InvRow[]) {
      const variant = one(row.product_variants);
      if (!variant || variant.deleted_at || !variant.is_active) continue;
      const product = one(variant.products);
      if (!product || product.deleted_at || product.status !== "published") continue;
      out.set(row.variant_id, {
        variantId: row.variant_id,
        onHand: row.on_hand,
        reserved: row.reserved,
        available: row.track_inventory ? Math.max(0, row.on_hand - row.reserved) : UNTRACKED_AVAILABLE,
        tracked: row.track_inventory,
      });
    }
  } catch {
    // Supabase not configured / network failure: callers fall back to "unknown".
  }
  return out;
}
