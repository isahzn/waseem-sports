"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

/**
 * Admin sidebar nav (Fixes §3.1 + §3.8).
 *
 * - Active page highlighted via the route pathname (aria-current="page").
 * - Mobile: collapsible "Menu" button (<768px shows the button, nav hidden
 *   until opened). Desktop sidebar always visible.
 * - Grouped for the owner: Today / Catalog / Content / Setup, with plain
 *   Setup names + one-line help (§3.8).
 */

type NavLink = { href: string; label: string; help?: string; badge?: "new-orders" };
type NavGroup = { label: string; links: NavLink[] };

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Today",
    links: [
      { href: "/admin/orders", label: "Orders", badge: "new-orders" },
      { href: "/admin/notifications", label: "Notifications" },
      { href: "/admin/activity", label: "Activity log", help: "Who changed what, when." },
    ],
  },
  {
    label: "Catalog",
    links: [
      { href: "/admin/products", label: "Products" },
      { href: "/admin/inventory", label: "Inventory" },
      { href: "/admin/sports", label: "Sports" },
      { href: "/admin/brands", label: "Brands" },
      { href: "/admin/attributes", label: "Attributes" },
    ],
  },
  {
    label: "Content",
    links: [{ href: "/admin/pages", label: "Pages" }],
  },
  {
    label: "Setup",
    links: [
      { href: "/admin/shipping", label: "Shipping", help: "Delivery areas, fees and times." },
      { href: "/admin/transfers", label: "Bank transfers", help: "Confirm payments sent to the shop account." },
      {
        href: "/admin/settings/whatsapp",
        label: "WhatsApp messages",
        help: "Shop number, alerts and message templates.",
      },
      {
        href: "/admin/settings/image-search",
        label: "Product photos",
        help: "Find supplier photos for new products.",
      },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav({ newOrderCount }: { newOrderCount: number }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="rounded-sm border border-line px-3 py-2 text-sm font-semibold lg:hidden"
        aria-expanded={open}
        aria-controls="admin-nav"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? "Close menu ✕" : "Menu ☰"}
      </button>
      <nav
        id="admin-nav"
        aria-label="Admin sections"
        className={`${open ? "flex" : "hidden"} flex-wrap gap-4 px-4 pb-4 lg:flex lg:flex-col lg:gap-5 lg:px-3`}
      >
        <div className="flex flex-wrap gap-1 lg:flex-col">
          <p className="w-full px-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Overview</p>
          <Link
            href="/admin"
            aria-current={pathname === "/admin" ? "page" : undefined}
            onClick={() => setOpen(false)}
            className={`rounded-sm px-2 py-1.5 text-sm hover:bg-card ${pathname === "/admin" ? "bg-card font-semibold text-gold-400" : "text-ink"}`}
          >
            Dashboard
          </Link>
        </div>
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="flex flex-wrap gap-1 lg:flex-col">
            <p className="w-full px-2 text-[11px] font-semibold uppercase tracking-wide text-muted">{group.label}</p>
            {group.links.map((link) => {
              const on = isActive(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={on ? "page" : undefined}
                  title={link.help}
                  onClick={() => setOpen(false)}
                  className={`rounded-sm px-2 py-1.5 text-sm hover:bg-card ${on ? "bg-card font-semibold text-gold-400" : "text-ink"}`}
                >
                  {link.label}
                  {link.badge === "new-orders" && newOrderCount > 0 && (
                    <span
                      aria-label={`${newOrderCount} new order${newOrderCount === 1 ? "" : "s"}`}
                      className="ml-2 rounded-sm bg-gold-600 px-1.5 py-0.5 text-xs font-semibold text-bronze-ink"
                    >
                      {newOrderCount}
                    </span>
                  )}
                  {link.help && <span className="block px-0 text-xs font-normal text-muted">{link.help}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </>
  );
}
