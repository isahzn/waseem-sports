import Link from "next/link";

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
  const phone = info["public.store_phone_1"];
  const phone2 = info["public.store_phone_2"];
  const whatsapp = info["public.store_whatsapp"];
  const email = info["public.store_email"];
  const hours = info["public.store_hours"];

  const facts = [
    address,
    [phone, phone2].filter(Boolean).join(" · "),
    whatsapp ? `WhatsApp ${whatsapp}` : null,
    hours,
  ].filter(Boolean) as string[];

  return (
    <footer>
      <p>
        Waseem Sports{ facts.length > 0 ? ` · ${facts.join(" · ")}` : " · Colombo, Sri Lanka"}
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
