import Link from "next/link";
import { getShopInfo } from "@/lib/storefront/catalog";
import { whatsappHref } from "@/lib/storefront/contact-links";

export const metadata = {
  title: "Find us — Waseem Sports",
  description: "Where to find Waseem Sports in Sri Lanka, with phone, WhatsApp and opening hours.",
};

function mapsHref(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export default async function StoreLocatorPage() {
  const info = await getShopInfo();
  const address = info["public.store_address"];
  const phone = info["public.store_phone_1"];
  const phone2 = info["public.store_phone_2"];
  const whatsapp = info["public.store_whatsapp"];
  const hours = info["public.store_hours"];
  // wa.me needs a full international number; null means the row shows the number
  // without a link rather than a link that opens nothing.
  const waHref = whatsappHref(whatsapp ?? "");

  const hasStore = Boolean(address || phone || whatsapp);

  return (
    <main>
      <h1 style={{ fontSize: "40px" }}>Find us</h1>
      <p className="sold">Cash on delivery · orders can be collected in person too.</p>

      {hasStore ? (
        <div className="box">
          <h2>{address ? "Our shop" : "Reach us"}</h2>

          {address && <p>{address}</p>}

          {(phone || phone2) && (
            <div className="row">
              <span>Phone</span>
              <b>
                {[phone, phone2]
                  .filter(Boolean)
                  .map((p, i) => (
                    <span key={String(p)}>
                      {i > 0 && " · "}
                      <a href={`tel:${String(p).replace(/\s/g, "")}`}>{p}</a>
                    </span>
                  ))}
              </b>
            </div>
          )}

          {whatsapp && waHref && (
            <div className="row">
              <span>WhatsApp</span>
              <b>
                <a href={waHref} target="_blank" rel="noreferrer noopener">
                  {whatsapp}
                </a>
              </b>
            </div>
          )}

          <div className="row">
            <span>Opening hours</span>
            <b>{hours ?? <span className="sold">Being confirmed — call before you visit.</span>}</b>
          </div>

          {address && (
            <p>
              <a className="btn" href={mapsHref(address)} target="_blank" rel="noreferrer noopener">
                Get directions
              </a>{" "}
              <Link className="btn out" href="/contact">
                Contact the shop
              </Link>
            </p>
          )}
        </div>
      ) : (
        <div className="box">
          <h2>The shop location is being added</h2>
          <p className="sold">
            We do not have a confirmed address on the site yet, so we will not show a pin that might be
            wrong. Message us and we will tell you exactly where to find us.
          </p>
          <p>
            <Link className="btn" href="/contact">
              Contact us
            </Link>{" "}
            <Link className="btn out" href="/shop">
              Browse the shop
            </Link>
          </p>
        </div>
      )}
    </main>
  );
}
