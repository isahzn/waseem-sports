import type { RankedCandidate, RawCandidate } from "./types";

/**
 * Rank/filter for provider results (Phase 09 task 3). Pure module.
 * Rules: https only; minimum dimensions when known (400px); allowlisted
 * manufacturer/distributor domains first (host match incl. subdomains);
 * return at most 3 with thumbnail (= image URL), dimensions, source domain
 * and page URL.
 */

export const MIN_DIMENSION = 400;
export const MAX_CANDIDATES = 3;

export function sourceDomainOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isHttps(url: string): boolean {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

function onAllowlist(host: string, allowlist: string[]): boolean {
  const h = host.toLowerCase();
  return allowlist.some((d) => {
    const dom = d.trim().toLowerCase().replace(/^\*\./, "");
    return dom !== "" && (h === dom || h.endsWith(`.${dom}`));
  });
}

/** Filter + prefer-allowlist + cap. Deterministic (stable order otherwise). */
export function rankCandidates(raw: RawCandidate[], allowlist: string[]): RankedCandidate[] {
  const seen = new Set<string>();
  const kept: (RankedCandidate & { preferred: boolean })[] = [];
  for (const r of raw) {
    if (!isHttps(r.imageUrl) || !isHttps(r.pageUrl)) continue;
    if (seen.has(r.imageUrl)) continue;
    seen.add(r.imageUrl);
    if (r.width !== undefined && r.width !== null && r.width < MIN_DIMENSION) continue;
    if (r.height !== undefined && r.height !== null && r.height < MIN_DIMENSION) continue;
    const host = sourceDomainOf(r.imageUrl);
    if (!host) continue;
    kept.push({
      imageUrl: r.imageUrl,
      pageUrl: r.pageUrl,
      sourceDomain: host,
      title: r.title?.trim().slice(0, 200) || null,
      width: r.width ?? null,
      height: r.height ?? null,
      preferred: onAllowlist(host, allowlist),
    });
  }
  kept.sort((a, b) => Number(b.preferred) - Number(a.preferred));
  return kept.slice(0, MAX_CANDIDATES);
}
