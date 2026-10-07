import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getVariantStock, UNTRACKED_AVAILABLE } from "./availability";
import { MAX_LINES, MAX_QTY, type CartLine } from "./cart-cookie";

export type PricedLine = {
  variantId: string;
  productId: string;
  productSlug: string;
  productName: string;
  variantName: string;
  options: Record<string, string>;
  unitPrice: number;
  qty: number;
  available: number;
  tracked: boolean;
  status: "ok" | "capped" | "out_of_stock" | "removed";
  image: { storage_path: string; alt_text: string | null } | null;
};

export type CartPreview = {
  lines: PricedLine[];
  subtotal: number;
  count: number;
  issues: { variantId: string; code: "removed" | "out_of_stock" | "capped"; message: string }[];
};

/**
 * Authoritative cart pricing. The cookie carries ids + qty ONLY — prices,
 * availability and existence are recomputed from the DB on every call, so
 * tampering with cookie contents cannot change what the customer pays
 * (Phase 05 checkout calls this same function server-side).
 */
export async function priceCart(lines: CartLine[]): Promise<CartPreview> {
  const preview: CartPreview = { lines: [], subtotal: 0, count: 0, issues: [] };
  const clean = lines.filter((l) => z.string().uuid().safeParse(l.variantId).success);
  if (clean.length === 0) return preview;

  const db = await createClient();
  const ids = [...new Set(clean.map((l) => l.variantId))].slice(0, MAX_LINES);
  const { data: variants } = await db
    .from("product_variants")
    .select("id,name,options,price,product_id,products!inner(id,slug,name,base_price,status,deleted_at)")
    .in("id", ids)
    .eq("is_active", true)
    .is("deleted_at", null);

  const byId = new Map((variants ?? []).map((v) => [v.id, v]));
  // Stock comes from the server-only helper: `inventory` is not anon-readable
  // (RLS), and a missing entry means "unknown", never "zero".
  const stock = await getVariantStock(ids);
  const imgRes = await db
    .from("product_images")
    .select("variant_id,product_id,storage_path,alt_text,is_primary,sort_order")
    .in("variant_id", ids)
    .order("sort_order");
  const imgByVariant = new Map<string, { storage_path: string; alt_text: string | null }>();
  const imgByProduct = new Map<string, { storage_path: string; alt_text: string | null }>();
  for (const img of imgRes.data ?? []) {
    const slim = { storage_path: img.storage_path, alt_text: img.alt_text };
    if (img.variant_id && (!imgByVariant.has(img.variant_id) || img.is_primary)) {
      imgByVariant.set(img.variant_id, slim);
    }
    if (!imgByProduct.has(img.product_id) || img.is_primary) imgByProduct.set(img.product_id, slim);
  }

  const one = <T>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

  for (const line of clean) {
    const v = byId.get(line.variantId);
    if (!v) {
      preview.issues.push({ variantId: line.variantId, code: "removed", message: "An item is no longer available and was removed." });
      continue;
    }
    const product = one(v.products as unknown as {
      id: string; slug: string; name: string; base_price: number; status: string; deleted_at: string | null;
    } | null);
    if (!product || product.status !== "published" || product.deleted_at) {
      preview.issues.push({ variantId: line.variantId, code: "removed", message: `“${product?.name ?? "An item"}” is no longer available and was removed.` });
      continue;
    }
    const unitPrice = v.price ?? product.base_price;
    const s = stock.get(v.id);
    const tracked = s?.tracked ?? false;
    const available = s?.available ?? UNTRACKED_AVAILABLE;

    if (tracked && available <= 0) {
      preview.lines.push({
        variantId: v.id, productId: product.id, productSlug: product.slug, productName: product.name,
        variantName: v.name, options: (v.options ?? {}) as Record<string, string>,
        unitPrice, qty: 0, available: 0, tracked, status: "out_of_stock",
        image: imgByVariant.get(v.id) ?? imgByProduct.get(product.id) ?? null,
      });
      preview.issues.push({ variantId: v.id, code: "out_of_stock", message: `“${product.name} — ${v.name}” is out of stock.` });
      continue;
    }
    const qty = Math.min(line.qty, MAX_QTY, tracked ? available : line.qty);
    const status = qty < line.qty ? "capped" : "ok";
    if (status === "capped") {
      preview.issues.push({ variantId: v.id, code: "capped", message: `Only ${qty} × “${product.name} — ${v.name}” available; quantity reduced.` });
    }
    preview.lines.push({
      variantId: v.id, productId: product.id, productSlug: product.slug, productName: product.name,
      variantName: v.name, options: (v.options ?? {}) as Record<string, string>,
      unitPrice, qty, available: tracked ? available : qty, tracked, status,
      image: imgByVariant.get(v.id) ?? imgByProduct.get(product.id) ?? null,
    });
    preview.subtotal += unitPrice * qty;
    preview.count += qty;
  }
  preview.subtotal = Math.round(preview.subtotal * 100) / 100;
  return preview;
}
