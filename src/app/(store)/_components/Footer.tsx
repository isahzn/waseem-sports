import Link from "next/link";

export type FooterData = {
  sports: { id: string; name: string; slug: string }[];
  brands: { id: string; name: string; slug: string }[];
  info: Record<string, string>;
};

/** Storefront footer. Blank contact facts stay hidden (D23) — never rendered. */
export function Footer({ sports, brands, info }: FooterData) {
  const address = info["public.address"];
  const phone = info["public.phone"];
  const phone2 = info["public.phone_2"];
  const whatsapp = info["public.whatsapp"];
  const email = info["public.email"];
  const hours = info["public.hours"];

  return (
    <footer className="mt-16 border-t border-line bg-pine-950">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div>
          <p className="font-display text-xl font-bold">
            Waseem <span className="text-gold-400">Sports</span>
          </p>
          <address className="mt-3 text-sm not-italic text-muted">
            {address && <p>{address}</p>}
            {(phone || phone2) && <p>{[phone, phone2].filter(Boolean).join(" · ")}</p>}
            {whatsapp && <p>WhatsApp: {whatsapp}</p>}
            {email && (
              <p>
                <a href={`mailto:${email}`} className="underline">{email}</a>
              </p>
            )}
            {hours && <p>{hours}</p>}
          </address>
        </div>
        <nav aria-label="Shop by sport">
          <p className="font-semibold">Shop by sport</p>
          <ul className="mt-3 flex flex-col gap-1.5 text-sm text-muted">
            {sports.slice(0, 8).map((s) => (
              <li key={s.id}>
                <Link href={`/sport/${s.slug}`} className="hover:text-ink">{s.name}</Link>
              </li>
            ))}
            {sports.length === 0 && <li>Catalog coming soon.</li>}
          </ul>
        </nav>
        <nav aria-label="Shop by brand">
          <p className="font-semibold">Shop by brand</p>
          <ul className="mt-3 flex flex-col gap-1.5 text-sm text-muted">
            {brands.slice(0, 8).map((b) => (
              <li key={b.id}>
                <Link href={`/brand/${b.slug}`} className="hover:text-ink">{b.name}</Link>
              </li>
            ))}
            {brands.length === 0 && <li>Catalog coming soon.</li>}
          </ul>
        </nav>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto w-full max-w-6xl px-4 py-4 text-xs text-muted">
          Waseem Sports · Colombo, Sri Lanka · Prices in LKR, cash on delivery available.
        </p>
      </div>
    </footer>
  );
}
