"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useHydrated } from "@/lib/storefront/use-hydrated";

/**
 * Recently viewed products (Fixes §2.5), stored locally on the device only —
 * there are no customer accounts, so nothing leaves the browser. Records
 * `{slug,name,price}` on each product page view, capped at 12, and renders
 * the last 8 excluding the current product.
 */

const KEY = "ws_recent";
const MAX = 12;

export type RecentItem = { slug: string; name: string; price: string };

function read(): RecentItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: RecentItem[] = [];
    for (const v of parsed) {
      if (
        typeof v === "object" &&
        v !== null &&
        typeof (v as RecentItem).slug === "string" &&
        typeof (v as RecentItem).name === "string"
      ) {
        out.push({
          slug: (v as RecentItem).slug.slice(0, 160),
          name: (v as RecentItem).name.slice(0, 160),
          price: typeof (v as RecentItem).price === "string" ? (v as RecentItem).price.slice(0, 40) : "",
        });
      }
      if (out.length >= MAX) break;
    }
    return out;
  } catch {
    return [];
  }
}

/** Records this product view. Rendered (and only run) on product pages. */
export function RecordView({ slug, name, price }: { slug: string; name: string; price: string }) {
  useEffect(() => {
    try {
      const next = [{ slug, name, price }, ...read().filter((r) => r.slug !== slug)].slice(0, MAX);
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* private mode — viewing still works, memory just doesn't persist */
    }
  }, [slug, name, price]);
  return null;
}

/** Row of recently viewed products, excluding the page being viewed. */
export function RecentlyViewedRow({ currentSlug }: { currentSlug: string }) {
  const hydrated = useHydrated();
  // Derived during render (not in an effect): device-local memory is external
  // state read synchronously, gated on hydration so the server snapshot stays [].
  const items = useMemo<RecentItem[]>(
    () => (hydrated ? read().filter((r) => r.slug !== currentSlug).slice(0, 8) : []),
    [hydrated, currentSlug],
  );
  const [, force] = useState(0);
  useEffect(() => {
    const onStorage = () => force((n) => n + 1);
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  if (!hydrated || items.length === 0) return null;
  return (
    <section aria-labelledby="recent">
      <div className="sec">
        <h2 id="recent">Recently viewed</h2>
        <Link className="btn out" href="/shop">
          Shop
        </Link>
      </div>
      <div className="cats" role="list">
        {items.map((r) => (
          <Link key={r.slug} className="chip" role="listitem" href={`/product/${r.slug}`}>
            {r.name}
            {r.price ? ` · ${r.price}` : ""}
          </Link>
        ))}
      </div>
    </section>
  );
}
