"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useHydrated } from "@/lib/storefront/use-hydrated";
import { useCart } from "./CartProvider";
import { SearchBox } from "./SearchBox";

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
  const hydrated = useHydrated();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // The count comes from the `refreshCart` server action, which can resolve
  // while this header is still hydrating; rendering it before hydration would
  // put a number the server never sent into the badge (React #418). Until then
  // the badge shows the server's value, 0.
  const count = hydrated ? (preview?.count ?? 0) : 0;
  const isOn = (href: string) => (pathname === href ? "on" : "");
  const notice = announcement?.trim() ?? "";

  // Customer-facing navigation only. The admin area has its own URL and shell
  // and is never advertised to shoppers (a customer must not see management
  // controls); it stays reachable at /admin for the owner.
  const links = [
    { href: "/", label: "Home" },
    { href: "/shop", label: "Shop" },
    { href: "/account", label: "Account" },
  ];

  return (
    <>
      {notice ? <div className="top">{notice}</div> : null}
      <header>
        <div className="bar">
          <Link className="logo" href="/" aria-label="Waseem Sports — home">
            WASEEM <b>SPORTS</b>
          </Link>

          <SearchBox initialQ={searchParams.get("q") ?? ""} />

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
