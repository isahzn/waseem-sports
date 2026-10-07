/**
 * Slug helper shared by server actions (validation side) and client forms
 * (auto-suggest side). No server imports — safe to use in "use client".
 */

/** Turn a product/sport/category/brand name into a URL-safe slug. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[''ʼ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 120);
}
