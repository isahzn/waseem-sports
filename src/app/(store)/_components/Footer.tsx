import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { telHref, whatsappHref } from "@/lib/storefront/contact-links";

export type FooterData = {
  sports: { id: string; name: string; slug: string }[];
  categories: { id: string; name: string; slug: string }[];
  brands: { id: string; name: string; slug: string }[];
  info: Record<string, string>;
};

/**
 * Storefront footer. The design's footer is a single centred muted line, so the
 * real contact facts and the sport/brand links sit inline in the same voice —
 * nothing is invented, and blank facts stay hidden (D23).
 */
export function Footer({ sports, categories, brands, info }: FooterData) {
  const address = info["public.store_address"];
  const phones = [info["public.store_phone_1"], info["public.store_phone_2"]].filter(
    (value): value is string => Boolean(value),
  );
  const whatsapp = info["public.store_whatsapp"];
  const email = info["public.store_email"];
  const hours = info["public.store_hours"];

  // Contact facts stay in the design's single centred line. A phone number is a
  // real `tel:` link and WhatsApp opens a chat, so a shopper on a phone can tap
  // through; a value that cannot make a working link stays plain text rather
  // than becoming a dead link (D23: blank stays hidden).
  const facts: ReactNode[] = [];
  if (address) facts.push(address);
  for (const phone of phones) {
    const href = telHref(phone);
    facts.push(href ? <a href={href}>{phone}</a> : phone);
  }
  if (whatsapp) {
    const href = whatsappHref(whatsapp);
    facts.push(
      href ? (
        <a href={href} target="_blank" rel="noopener noreferrer">
          WhatsApp {whatsapp}
        </a>
      ) : (
        `WhatsApp ${whatsapp}`
      ),
    );
  }
  if (hours) facts.push(hours);

  return (
    <footer>
      <p>
        Waseem Sports
        {facts.length > 0
          ? facts.map((fact, index) => (
              <Fragment key={index}>{" · "}{fact}</Fragment>
            ))
          : " · Colombo, Sri Lanka"}
      </p>

      {sports.length > 0 && (
        <p className="sold mt-1.5">
          Shop by sport:{" "}
          {sports.slice(0, 8).map((s, i) => (
            <span key={s.id}>
              {i > 0 && " · "}
              <Link href={`/sport/${s.slug}`}>{s.name}</Link>
            </span>
          ))}
        </p>
      )}

      {brands.length > 0 && (
        <p className="sold mt-1">
          Brands:{" "}
          {brands.slice(0, 8).map((b, i) => (
            <span key={b.id}>
              {i > 0 && " · "}
              <Link href={`/brand/${b.slug}`}>{b.name}</Link>
            </span>
          ))}
        </p>
      )}

      {categories.length > 0 && (
        <p className="sold mt-1">
          {categories.slice(0, 8).map((c, i) => (
            <span key={c.id}>
              {i > 0 && " · "}
              <Link href={`/category/${c.slug}`}>{c.name}</Link>
            </span>
          ))}
        </p>
      )}

      {email && (
        <p className="sold mt-1">
          <a href={`mailto:${email}`}>{email}</a>
        </p>
      )}

      <p className="sold mt-2">
        <Link href="/about">About</Link> · <Link href="/contact">Contact</Link> · <Link href="/faq">FAQ</Link> ·{" "}
        <Link href="/blog">Journal</Link> · <Link href="/store-locator">Find us</Link> · <Link href="/track">Track order</Link>{" "}
        · <Link href="/account">Account</Link> · <Link href="/wishlist">Wishlist</Link> · <Link href="/compare">Compare</Link>
      </p>
    </footer>
  );
}
