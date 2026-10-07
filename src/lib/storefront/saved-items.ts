"use client";

import { useSyncExternalStore } from "react";

/**
 * Saved items (wishlist + compare) live on the device only — there is no
 * customer account, so nothing is sent to the server. Values are validated as
 * UUID-shaped ids on read, deduped, and capped, so a hand-edited or corrupt
 * entry can never break a page. Every consumer re-renders through
 * `useSyncExternalStore`, and a `storage` listener keeps multiple tabs in step.
 */

export const WISHLIST_KEY = "ws_wishlist";
export const COMPARE_KEY = "ws_compare";

const MAX_ITEMS = 40;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EMPTY: string[] = [];

let wishlistSnapshot: string[] = EMPTY;
let compareSnapshot: string[] = EMPTY;
let loaded = false;
let storageListenerAttached = false;

const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

/** Parse one stored list defensively. Anything unexpected yields []. */
function readList(key: string): string[] {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;
    const seen = new Set<string>();
    const out: string[] = [];
    for (const value of parsed) {
      if (typeof value !== "string" || !UUID.test(value) || seen.has(value)) continue;
      seen.add(value);
      out.push(value);
      if (out.length >= MAX_ITEMS) break;
    }
    return out.length > 0 ? out : EMPTY;
  } catch {
    return EMPTY;
  }
}

function writeList(key: string, ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    if (ids.length === 0) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    /* private mode / quota — the in-memory list still works this session */
  }
}

function syncFromStorage() {
  const nextWishlist = readList(WISHLIST_KEY);
  const nextCompare = readList(COMPARE_KEY);
  const changed = nextWishlist !== wishlistSnapshot || nextCompare !== compareSnapshot;
  wishlistSnapshot = nextWishlist;
  compareSnapshot = nextCompare;
  if (changed) notify();
}

function loadOnce() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  syncFromStorage();
  if (!storageListenerAttached) {
    storageListenerAttached = true;
    window.addEventListener("storage", (event) => {
      if (event.key === null || event.key === WISHLIST_KEY || event.key === COMPARE_KEY) syncFromStorage();
    });
  }
}

function subscribe(listener: () => void): () => void {
  loadOnce();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function commit(kind: "wishlist" | "compare", ids: string[]) {
  writeList(kind === "wishlist" ? WISHLIST_KEY : COMPARE_KEY, ids);
  if (kind === "wishlist") wishlistSnapshot = ids.length > 0 ? ids : EMPTY;
  else compareSnapshot = ids.length > 0 ? ids : EMPTY;
  notify();
}

function toggle(kind: "wishlist" | "compare", id: string): string[] {
  if (!UUID.test(id)) return kind === "wishlist" ? wishlistSnapshot : compareSnapshot;
  const current = kind === "wishlist" ? readList(WISHLIST_KEY) : readList(COMPARE_KEY);
  const next = current.includes(id)
    ? current.filter((value) => value !== id)
    : [...current, id].slice(0, MAX_ITEMS);
  commit(kind, next);
  return next;
}

// ---------- plain (non-React) API ----------

export function getWishlist(): string[] {
  return readList(WISHLIST_KEY);
}

export function getCompare(): string[] {
  return readList(COMPARE_KEY);
}

export function toggleWishlist(id: string): string[] {
  return toggle("wishlist", id);
}

export function toggleCompare(id: string): string[] {
  return toggle("compare", id);
}

export function removeFromWishlist(id: string): string[] {
  const next = readList(WISHLIST_KEY).filter((value) => value !== id);
  commit("wishlist", next);
  return next;
}

export function clearCompare(): void {
  commit("compare", []);
}

// ---------- React API ----------

export function useWishlistIds(): string[] {
  return useSyncExternalStore(
    subscribe,
    () => {
      loadOnce();
      return wishlistSnapshot;
    },
    () => EMPTY,
  );
}

export function useCompareIds(): string[] {
  return useSyncExternalStore(
    subscribe,
    () => {
      loadOnce();
      return compareSnapshot;
    },
    () => EMPTY,
  );
}
