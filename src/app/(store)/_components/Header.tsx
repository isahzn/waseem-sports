"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useCart } from "./CartProvider";

export type HeaderNav = {
  sports: { id: string; name: string; slug: string }[];
};

/**
 * Storefront header per the canonical design: gold announcement bar, pine
 * sticky bar with logo + search + nav + cart. Mobile menu is a disclosure
 * (no JS framework needed beyond useState), keyboard-operable by default.
 */
export function Header({ sports, announcement }: { sports: HeaderNav["sports"]; announcement: string | null }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { preview, setOpen } = useCart();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [q, setQ] = useState(searchParams.get("q") ?? "");

  const count = preview?.count ?? 0;
  const active = (href: string) => (pathname === href ? "on" : "");

  return (
    <>
      {announcement && (
        <div className="bg-gold-600 px-3 py-1.5 text-center text-sm font-semibold text-bronze-ink">
          {announcement}
        </div>
      )}
      <header className="sticky top-0 z-40 border-b border-gold-600 bg-pine-900 text-white">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-3 px-4 py-2.5">
          <Link href="/" className="font-display text-2xl font-bold tracking-wide" aria-label="Waseem Sports home">
            Waseem <span className="text-gold-400">Sports</span>
          </Link>
          <form
            role="search"
            className="flex min-w-44 flex-1"
            onSubmit={(e) => {
              e.preventDefault();
              router.push(`/search${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`);
              setMenuOpen(false);
            }}
          >
            <label htmlFor="site-search" className="sr-only">Search products</label>
            <input
              id="site-search"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search bats, balls, shoes…"
              maxLength={100}
              className="min-w-0 flex-1 rounded-sm rounded-r-none border-0 bg-white px-4 py-2 text-ink"
            />
            <button type="submit" className="rounded-sm rounded-l-none bg-gold-600 px-5 font-bold text-bronze-ink">
              Search
            </button>
          </form>
          <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
            <Link href="/" className={`rounded-sm px-2.5 py-2 font-semibold ${active("/")}`}>Home</Link>
            <Link href="/shop" className={`rounded-sm px-2.5 py-2 font-semibold ${active("/shop")}`}>Shop</Link>
            {sports.slice(0, 4).map((s) => (
              <Link key={s.id} href={`/sport/${s.slug}`} className={`rounded-sm px-2.5 py-2 font-semibold ${active(`/sport/${s.slug}`)}`}>
                {s.name}
              </Link>
            ))}
          </nav>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={count > 0 ? `Open cart, ${count} items` : "Open cart, empty"}
            className="rounded-sm border border-gold-600 px-3 py-2 font-semibold"
          >
            Cart{count > 0 && <span aria-hidden="true"> ({count})</span>}
          </button>
          <button
            type="button"
            className="rounded-sm border border-line px-3 py-2 font-semibold lg:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? "Close" : "Menu"}
          </button>
        </div>
        {menuOpen && (
          <nav id="mobile-menu" aria-label="Mobile" className="border-t border-line px-4 py-3 lg:hidden">
            <ul className="flex flex-col gap-1">
              <li><Link href="/" className="block rounded-sm px-2 py-2 font-semibold" onClick={() => setMenuOpen(false)}>Home</Link></li>
              <li><Link href="/shop" className="block rounded-sm px-2 py-2 font-semibold" onClick={() => setMenuOpen(false)}>Shop all</Link></li>
              {sports.map((s) => (
                <li key={s.id}>
                  <Link href={`/sport/${s.slug}`} className="block rounded-sm px-2 py-2" onClick={() => setMenuOpen(false)}>
                    {s.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </header>
    </>
  );
}
