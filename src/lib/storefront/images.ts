/**
 * Storefront image URLs — IM-V6 interim decision: serve the pre-made
 * derivatives directly with plain <img> (width/height + lazy), NOT the Next
 * optimiser. Rationale: GoDaddy's Cloudflare CDN caching of /_next/image is
 * unverified; direct files are deterministic and cache-safe. Revisit with
 * measurements once the preview deploy exists.
 *
 * Phase 03 route layout: `products/<uuid>.webp` (1600px) + `products/<uuid>-thumb.webp` (400px).
 */

const BUCKET = "product-media";

function base(): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}/storage/v1/object/public/${BUCKET}`;
}

function thumbPath(path: string): string {
  const dot = path.lastIndexOf(".");
  if (dot < 0) return `${path}-thumb`;
  return `${path.slice(0, dot)}-thumb${path.slice(dot)}`;
}

export type StoreImage = {
  storage_path: string;
  alt_text: string | null;
  is_primary: boolean;
  sort_order: number;
};

/** Public URL for a stored path (used by CMS sections that reference a photo). */
export function publicImageUrl(path: string): string {
  return `${base()}/${path.replace(/^\/+/, "")}`;
}

/** Card grid image: 400px thumb, explicit dimensions (no CLS). */
export function cardImage(img: StoreImage): { src: string; width: number; height: number; alt: string } {
  return {
    src: `${base()}/${thumbPath(img.storage_path)}`,
    width: 400,
    height: 400,
    alt: img.alt_text ?? "",
  };
}

/** PDP hero image: 1600px derivative. */
export function heroImage(img: StoreImage): { src: string; width: number; height: number; alt: string } {
  return {
    src: `${base()}/${img.storage_path}`,
    width: 1600,
    height: 1600,
    alt: img.alt_text ?? "",
  };
}

/** Primary image first, then sort order. */
export function sortImages<T extends StoreImage>(images: T[]): T[] {
  return [...images].sort((a, b) => {
    if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
    return a.sort_order - b.sort_order;
  });
}
