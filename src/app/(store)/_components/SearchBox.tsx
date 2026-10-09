"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Fuse from "fuse.js";
import type { SearchIndexItem } from "@/app/api/search/index/route";
import { formatLKR } from "@/lib/storefront/money";

/**
 * Autocomplete search (Fixes §2.3): debounced (~200ms) Fuse.js fuzzy search
 * over the catalog index (`/api/search/index`), with thumbnails + price,
 * arrow/Enter/Esc keyboard support, and a no-results state with suggestions.
 *
 * Handles typos ("footbal"), partials ("basket"), brands ("yonex") and codes
 * (variant SKU/name) via weighted Fuse keys. Submitting the form (Enter with
 * no highlight, or the Search button) falls through to `/search?q=` so the
 * server's taxonomy-aware full results remain the source of truth.
 */
export function SearchBox({ initialQ }: { initialQ: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initialQ);
  const [items, setItems] = useState<SearchIndexItem[] | null>(null);
  const [debounced, setDebounced] = useState(initialQ.trim());
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    let cancelled = false;
    fetch("/api/search/index", { headers: { accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!cancelled && j && Array.isArray(j.items)) setItems(j.items);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounce the input: only the timeout callback writes state, so no
  // synchronous setState-in-effect (react-hooks/set-state-in-effect).
  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebounced(q.trim());
    }, 200);
    return () => window.clearTimeout(t);
  }, [q]);

  const fuse = useMemo(
    () =>
      items
        ? new Fuse(items, {
            threshold: 0.38,
            ignoreLocation: true,
            minMatchCharLength: 2,
            keys: [
              { name: "name", weight: 0.45 },
              { name: "brand", weight: 0.2 },
              { name: "sport", weight: 0.15 },
              { name: "codes", weight: 0.2 },
            ],
          })
        : null,
    [items],
  );

  // Derived results (no effect): empty/short input yields no dropdown.
  const results = useMemo<SearchIndexItem[]>(() => {
    if (debounced.length < 2 || !fuse) return [];
    return fuse.search(debounced, { limit: 8 }).map((h) => h.item);
  }, [debounced, fuse]);

  const listOpen = open && debounced.length >= 2;
  const active = results.length > 0 ? Math.min(Math.max(highlight, 0), results.length - 1) : -1;

  // Close on outside click.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  const go = (term: string) => {
    const t = term.trim();
    setOpen(false);
    router.push(t ? `/search?q=${encodeURIComponent(t)}` : "/shop");
  };

  return (
    <div ref={boxRef} style={{ position: "relative", flex: 1, minWidth: 0, display: "flex" }}>
      <form
        className="search"
        role="search"
        style={{ flex: 1 }}
        onSubmit={(e) => {
          e.preventDefault();
          if (listOpen && active >= 0 && results[active]) {
            router.push(`/product/${results[active].slug}`);
          } else {
            go(q);
          }
        }}
      >
        <label htmlFor="site-search" className="sr-only">
          Search products
        </label>
        <input
          id="site-search"
          type="search"
          name="q"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setHighlight(0);
          }}
          onFocus={() => {
            if (debounced.length >= 2) setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && results.length > 0) {
              e.preventDefault();
              setOpen(true);
              setHighlight((h) => (h + 1) % results.length);
            } else if (e.key === "ArrowUp" && results.length > 0) {
              e.preventDefault();
              setOpen(true);
              setHighlight((h) => (h - 1 + results.length) % results.length);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder="Search bats, boots, jerseys…"
          maxLength={100}
          role="combobox"
          aria-expanded={listOpen}
          aria-controls={listId}
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          autoComplete="off"
        />
        <button type="submit">Search</button>
      </form>

      {listOpen && (
        <div
          id={listId}
          role="listbox"
          aria-label="Search suggestions"
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            zIndex: 30,
            background: "var(--card, #fff)",
            color: "var(--tx, #101a15)",
            border: "1px solid var(--ln, #dcdfd8)",
            borderRadius: 4,
            marginTop: 4,
            overflow: "hidden",
            boxShadow: "0 12px 32px rgba(0,0,0,.25)",
          }}
        >
          {results.length === 0 ? (
            <div style={{ padding: "12px 14px" }}>
              <p style={{ margin: "0 0 6px", fontWeight: 700 }}>No matches for “{debounced}”</p>
              <p className="sold" style={{ margin: "0 0 8px" }}>
                Try a sport, a brand, or fewer letters — or browse everything.
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {["Football", "Badminton", "Basketball"].map((s) => (
                  <Link key={s} className="chip" href={`/sport/${s.toLowerCase()}`}>
                    {s}
                  </Link>
                ))}
                <button
                  type="button"
                  className="chip"
                  onClick={() => go(q)}
                  style={{ background: "none", border: "1px solid var(--ln, #dcdfd8)", cursor: "pointer" }}
                >
                  Browse all →
                </button>
              </div>
            </div>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {results.map((r, i) => (
                <li key={r.id} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
                  <Link
                    href={`/product/${r.slug}`}
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => setOpen(false)}
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "center",
                      padding: "8px 10px",
                      background: i === active ? "rgba(169,135,51,.15)" : "transparent",
                    }}
                  >
                    {r.thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.thumb} alt="" width={44} height={44} loading="lazy" style={{ borderRadius: 4, objectFit: "cover" }} />
                    ) : (
                      <span
                        aria-hidden="true"
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 4,
                          display: "grid",
                          placeItems: "center",
                          background: "var(--g, #0b3d2a)",
                          color: "#fff",
                          fontWeight: 700,
                        }}
                      >
                        WS
                      </span>
                    )}
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: "block", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {r.name}
                      </span>
                      <span className="sold" style={{ display: "block", fontSize: 13 }}>
                        {[r.brand, r.sport].filter(Boolean).join(" · ")} · {formatLKR(r.price)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={() => go(q)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 10px",
                    background: "none",
                    border: 0,
                    borderTop: "1px solid var(--ln, #dcdfd8)",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  See all results for “{debounced}” →
                </button>
              </li>
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
