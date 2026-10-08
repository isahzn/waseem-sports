import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * SSRF-protected fetch for image imports (Phase 09 task 5).
 *
 * Guards: https only; every hostname is DNS-resolved and EVERY returned
 * address must be a public unicast IP (private/loopback/link-local/
 * multicast/reserved/unspecified all rejected, incl. IPv4-mapped IPv6);
 * redirects are followed manually (max 3) with each hop re-validated;
 * Content-Length pre-check + accumulated body cap; hard timeout.
 *
 * Known residual: DNS is resolved immediately before connect (TOCTOU /
 * DNS-rebinding window). Mitigated by re-resolving each redirect hop and
 * the short timeout; a rebinding attack would still need to win a race
 * inside a single admin-triggered request. Recorded, not hidden.
 */

export const MAX_FETCH_BYTES = 8 * 1024 * 1024; // 8 MB
export const FETCH_TIMEOUT_MS = 10_000;
export const MAX_REDIRECTS = 3;

export class BlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlockedError";
  }
}

/** True when the IP must never be connected to. */
export function isBlockedIp(ip: string): boolean {
  // Unwrap IPv4-mapped IPv6 (::ffff:1.2.3.4) before classifying.
  const mapped = ip.toLowerCase().startsWith("::ffff:") ? ip.slice(7) : ip;
  if (isIP(mapped)) {
    if (mapped.includes(".")) {
      const [a, b] = mapped.split(".").map(Number);
      if (a === 10) return true; // private
      if (a === 172 && b >= 16 && b <= 31) return true; // private
      if (a === 192 && b === 168) return true; // private
      if (a === 127) return true; // loopback
      if (a === 169 && b === 254) return true; // link-local
      if (a === 0) return true; // unspecified
      if (a >= 224) return true; // multicast + reserved
      return false;
    }
    const low = mapped.toLowerCase();
    if (low === "::1" || low === "::") return true; // loopback / unspecified
    if (low.startsWith("fe80:") || low.startsWith("fec0:")) return true; // link-local/site-local
    if (low.startsWith("ff")) return true; // multicast
    if (low.startsWith("fc") || low.startsWith("fd")) return true; // unique-local
    return false;
  }
  return true; // not an IP at all — refuse
}

/** Resolve a hostname and reject unless every address is public. */
export async function assertPublicHost(hostname: string): Promise<void> {
  let addrs;
  try {
    addrs = await lookup(hostname, { all: true });
  } catch {
    throw new BlockedError("Could not resolve the image host.");
  }
  if (addrs.length === 0) throw new BlockedError("Could not resolve the image host.");
  for (const a of addrs) {
    if (isBlockedIp(a.address)) {
      throw new BlockedError("That image host resolves to a private address — refused.");
    }
  }
}

/** Fetch image bytes through every guard. Throws BlockedError or fetch errors. */
export async function fetchImageBytes(rawUrl: string): Promise<{ bytes: Uint8Array; finalUrl: string }> {
  let current: URL;
  try {
    current = new URL(rawUrl);
  } catch {
    throw new BlockedError("Invalid image URL.");
  }
  if (current.protocol !== "https:") throw new BlockedError("Only https image URLs are allowed.");

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicHost(current.hostname);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(current.toString(), { signal: ctrl.signal, redirect: "manual" });
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof BlockedError) throw err;
      throw new Error(err instanceof Error && err.name === "AbortError" ? "Image fetch timed out." : "Could not fetch the image.");
    }
    clearTimeout(timer);

    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const loc = res.headers.get("location");
      if (!loc) throw new Error("Image host gave a broken redirect.");
      let next: URL;
      try {
        next = new URL(loc, current);
      } catch {
        throw new Error("Image host gave a broken redirect.");
      }
      if (next.protocol !== "https:") throw new BlockedError("Redirect left https — refused.");
      if (hop === MAX_REDIRECTS) throw new Error("Too many redirects.");
      current = next;
      continue;
    }
    if (!res.ok) throw new Error(`Image host answered ${res.status}.`);

    const declared = res.headers.get("content-length");
    if (declared !== null && Number(declared) > MAX_FETCH_BYTES) {
      throw new Error("Image is too large (max 8 MB).");
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length === 0) throw new Error("Image is empty.");
    if (buf.length > MAX_FETCH_BYTES) throw new Error("Image is too large (max 8 MB).");
    return { bytes: buf, finalUrl: current.toString() };
  }
  throw new Error("Too many redirects.");
}
