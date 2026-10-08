import Link from "next/link";
import { getShopInfo } from "@/lib/storefront/catalog";
import { telHref, whatsappHref } from "@/lib/storefront/contact-links";

export const metadata = {
  title: "Contact Waseem Sports",
  description:
    "Call, WhatsApp or visit Waseem Sports in Colombo 11. Cash on delivery — no card details are taken online.",
};

/** Maps search URL built from the shop's own address — nothing hardcoded. */
function mapsHref(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export default async function ContactPage() {
  const info = await getShopInfo();
  const address = info["public.store_address"];
  const phone = info["public.store_phone_1"];
  const phone2 = info["public.store_phone_2"];
  const whatsapp = info["public.store_whatsapp"];
  const email = info["public.store_email"];
  const hours = info["public.store_hours"];

  // Linked through the shared helpers: a number that cannot make a working link
  // returns null and is shown as plain text instead of a dead link. (wa.me needs
  // a full international number, so the local `077 …` form this shop stores has
  // to be converted — the old inline link pointed at the unconverted digits and
  // did not open a chat.)
  const phoneLink = phone ? telHref(phone) : null;
  const phone2Link = phone2 ? telHref(phone2) : null;
  const whatsappLink = whatsapp ? whatsappHref(whatsapp) : null;

  // Only facts the shop has actually filled in (D23: blank stays hidden).
  const rows: { label: string; value: string; href?: string; external?: boolean }[] = [];
  if (address) rows.push({ label: "Address", value: address });
  if (phone) rows.push({ label: "Phone", value: phone, ...(phoneLink ? { href: phoneLink } : {}) });
  if (phone2) rows.push({ label: "Phone 2", value: phone2, ...(phone2Link ? { href: phone2Link } : {}) });
  if (whatsapp) {
    rows.push({
      label: "WhatsApp",
      value: whatsapp,
      ...(whatsappLink ? { href: whatsappLink, external: true } : {}),
    });
  }
  if (email) rows.push({ label: "Email", value: email, href: `mailto:${email}` });
  if (hours) rows.push({ label: "Opening hours", value: hours });

  return (
    <main>
      <h1 style={{ fontSize: "40px" }}>Contact us</h1>
      <p className="sold">
        Questions about an item, a size or a delivery? Call or message us — a person answers.
      </p>

      <div className="two">
        <div className="box">
          <h2>Reach the shop</h2>

          {rows.length === 0 ? (
            <p className="sold">
              Our contact details are being added. Please check back shortly — the shop&apos;s address and
              numbers will appear here as soon as they are set.
            </p>
          ) : (
            <>
              {rows.map((row) => (
                <div className="row" key={row.label}>
                  <span>{row.label}</span>
                  <b>
                    {row.href ? (
                      <a
                        href={row.href}
                        {...(row.external ? { target: "_blank", rel: "noreferrer noopener" } : {})}
                      >
                        {row.value}
                      </a>
                    ) : (
                      row.value
                    )}
                  </b>
                </div>
              ))}
              {address && (
                <p>
                  <a
                    className="btn out"
                    href={mapsHref(address)}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    Open in Google Maps
                  </a>
                </p>
              )}
            </>
          )}
        </div>

        <div className="box">
          <h2>Ordering by cash on delivery</h2>
          <p>
            Orders are placed on the website and paid in cash when they arrive. You do not need an account,
            and no card details are taken online.
          </p>
          <p>
            After you check out we call the number you gave us to confirm the order and the delivery charge.
            The order number and code we send let you{" "}
            <Link href="/track">follow the order</Link> at any time.
          </p>
          <p>
            <Link className="btn" href="/shop">
              Browse the shop
            </Link>
          </p>
          {whatsappLink && (
            <p className="sold">
              Prefer to order directly?{" "}
              <a href={whatsappLink} target="_blank" rel="noreferrer noopener">
                Message us on WhatsApp
              </a>
              .
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
