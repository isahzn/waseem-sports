"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useCart } from "./CartProvider";

/**
 * Storefront header, matching the canonical design: gold announcement bar,
 * sticky pine bar with the wordmark, live search, the customer nav links and
 * the cart with its gold count badge. The nav wraps on narrow screens (design
 * behaviour) instead of collapsing into a drawer.
 *
 * The announcement bar renders only what the shop has actually configured
 * (`public.announcement`). It used to fall back to the mockup's own promotion —
 * "Free delivery over LKR 10,000 … islandwide" — which is not a real shop
 * policy (the owner's delivery rules are still to be entered, D5), so nothing
 * is substituted for it: no announcement configured, no bar.
 */
export function Header({ announcement }: { announcement: string | null }) {
  const { preview, setOpen } = useCart();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [q, setQ] = useState(searchParams.get("q") ?? "");

  const count = preview?.count ?? 0;
  const isOn = (href: string) => (pathname === href ? "on" : "");
  const notice = announcement?.trim() ?? "";

  // Customer-facing navigation only. The admin area has its own URL and shell
  // and is never advertised to shoppers (a customer must not see management
  // controls); it stays reachable at /admin for the owner.
  const links = [
    { href: "/", label: "Home" },
    { href: "/shop", label: "Shop" },
    { href: "/track", label: "Account" },
  ];

  return (
    <>
      {notice ? <div className="top">{notice}</div> : null}
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
