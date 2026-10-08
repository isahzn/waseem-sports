/**
 * Phase 09 — image-search provider seam (NO PROVIDER CONFIGURED — D6 open).
 *
 * ┌──────────────────────────────────────────────────────────────┐
 * │ WHERE A REAL PROVIDER CONNECTS (when the owner chooses one): │
 * │ 1. Implement `ImageSearchProvider` below in a new file, e.g. │
 * │    `src/lib/imagesearch/bing.ts`, using the vendor's         │
 * │    official docs (cite doc URLs in the header). VERIFY       │
 * │    API terms/pricing/quota before writing any key.           │
 * │ 2. Register it in `providerFor()` inside                    │
 * │    `src/lib/imagesearch/service.ts` (env:                   │
 * │    IMAGE_SEARCH_PROVIDER).                                   │
 * │ 3. Nothing else changes: query builder, rank/filter, quota,  │
 * │    cache, SSRF-guarded import and audit all stay the same.   │
 * │ No LLM. Deterministic. Never scrape or automate websites.    │
 * └──────────────────────────────────────────────────────────────┘
 */

/** One raw result from a provider adapter (before rank/filter). */
export type RawCandidate = {
  imageUrl: string;
  pageUrl: string;
  title?: string;
  width?: number;
  height?: number;
};

/** A ranked candidate shown to the owner (pick -> preview -> import). */
export type RankedCandidate = {
  imageUrl: string;
  pageUrl: string;
  sourceDomain: string;
  title: string | null;
  width: number | null;
  height: number | null;
  /** True when the source is on the owner's allowlist. */
  preferred: boolean;
};

/**
 * Provider abstraction. The app depends on this interface only —
 * the registry returns "none" until D6 is decided.
 */
export interface ImageSearchProvider {
  readonly name: string;
  search(queries: string[], limit: number): Promise<RawCandidate[]>;
}

export type SearchOutcome =
  | { configured: false; reason: string; queries: string[] }
  | { configured: true; queries: string[]; candidates: RankedCandidate[]; cached: boolean };
