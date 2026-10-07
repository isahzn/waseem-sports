import Link from "next/link";
import { getPage, getShopInfo } from "@/lib/storefront/catalog";

export const metadata = {
  title: "About Waseem Sports",
  description:
    "Waseem Sports is a sports shop in Sri Lanka selling bats, balls, racquets, gym gear and footwear — cash on delivery, delivery island-wide.",
};

/** Same four cells as the home page (design copy) — no new claims here. */
const TRUST = [
  "Free delivery over LKR 10,000",
  "Cash on delivery",
  "7-day easy returns",
  "SMS and email order updates",
];

export default async function AboutPage() {
  const [page, info] = await Promise.all([getPage("about"), getShopInfo()]);
  const address = info["public.store_address"];
  const phone = info["public.store_phone_1"];
  const phone2 = info["public.store_phone_2"];
  const whatsapp = info["public.store_whatsapp"];
  const hasContact = Boolean(address || phone || whatsapp);

  return (
    <main>
      <h1 style={{ fontSize: "40px" }}>About Waseem Sports</h1>
      <p className="sold">
        Sports gear, delivered anywhere in Sri Lanka — cash on delivery.
      </p>

      {page && page.body.trim() ? (
        <div className="box">
          <p className="whitespace-pre-line">{page.body}</p>
        </div>
      ) : (
        <div className="box">
          <h2>The full story is being written</h2>
          <p>
            We are putting the shop&apos;s story on this page — where the gear comes from, how we pick it and
            who you are buying from. It isn&apos;t ready yet.
          </p>
          <p>
            In the meantime the shop is open: every product page shows real stock, the price you see is the
            price you pay, and delivery is paid in cash when your order arrives.
          </p>
          <p>
            <Link className="btn" href="/shop">
              Browse the shop
            </Link>{" "}
            <Link className="btn out" href="/contact">
              Contact us
            </Link>
          </p>
        </div>
      )}

      <div className="sec">
        <h2>Ordering and delivery</h2>
      </div>

      <div className="two">
        <div className="box">
          <h2>How an order works</h2>
          <p>Pick your item and size, then check out as a guest — no account needed.</p>
          <p>
            We call the number you give us to confirm the order and the delivery charge before anything is
            sent.
          </p>
          <p>
            Your order is paid in cash to the rider when it arrives. Nothing is charged online.{" "}
            <Link href="/track">Track an order</Link> any time with the order number and code we send you.
          </p>
        </div>

        <div className="box">
          <h2>Where we are</h2>
          {hasContact ? (
            <>
              {address && <p>{address}</p>}
              {(phone || phone2) && (
                <p>
                  {[phone, phone2]
                    .filter(Boolean)
                    .map((p, i) => (
                      <span key={String(p)}>
                        {i > 0 && " · "}
                        <a href={`tel:${String(p).replace(/\s/g, "")}`}>{p}</a>
                      </span>
                    ))}
                </p>
              )}
              {whatsapp && (
                <p>
                  WhatsApp{" "}
                  <a
                    href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    {whatsapp}
                  </a>
                </p>
              )}
              <p>
                <Link className="btn out" href="/contact">
                  Contact details
                </Link>
              </p>
            </>
          ) : (
            <p className="sold">
              Our address and phone numbers are being added. Until then,{" "}
              <Link href="/contact">the contact page</Link> shows what we have and how to reach us.
            </p>
          )}
        </div>
      </div>

      <div className="trust">
        {TRUST.map((t) => (
          <div key={t}>{t}</div>
        ))}
      </div>
    </main>
  );
}
