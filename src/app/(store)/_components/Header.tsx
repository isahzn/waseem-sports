"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useCart } from "./CartProvider";

/** Fallback announcement when the shop hasn't written one (canonical copy). */
const DEFAULT_ANNOUNCEMENT = "Free delivery over LKR 10,000 · Cash on delivery islandwide";

/**
 * Storefront header, matching the canonical design: gold announcement bar,
 * sticky pine bar with the wordmark, live search, the four nav links and the
 * cart with its gold count badge. The nav wraps on narrow screens (design
 * behaviour) instead of collapsing into a drawer.
 */
export function Header({ announcement }: { announcement: string | null }) {
  const { preview, setOpen } = useCart();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [q, setQ] = useState(searchParams.get("q") ?? "");

  const count = preview?.count ?? 0;
  const isOn = (href: string) => (pathname === href ? "on" : "");

  const links = [
    { href: "/", label: "Home" },
    { href: "/shop", label: "Shop" },
    { href: "/track", label: "Account" },
    { href: "/admin", label: "Admin" },
  ];

  return (
    <>
      <div className="top">{announcement || DEFAULT_ANNOUNCEMENT}</div>
      <header>
        <div className="bar">
          <Link className="logo" href="/" aria-label="Waseem Sports — home">
            WASEEM <b>SPORTS</b>
          </Link>

          <form
            className="search"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              const term = q.trim();
              router.push(term ? `/search?q=${encodeURIComponent(term)}` : "/shop");
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
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search bats, boots, jerseys…"
              maxLength={100}
            />
            <button type="submit">Search</button>
          </form>

          <nav aria-label="Primary">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className={isOn(l.href)}>
                {l.label}
              </Link>
            ))}
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label={count > 0 ? `Open cart, ${count} items` : "Open cart, empty"}
              className={isOn("/cart")}
            >
              Cart
              <span className="cnt" aria-hidden="true">
                {count}
              </span>
            </button>
          </nav>
        </div>
      </header>
    </>
  );
}
