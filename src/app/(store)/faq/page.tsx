import Link from "next/link";
import type { Metadata } from "next";
import { getPage, getShopInfo } from "@/lib/storefront/catalog";
import { getShippingOptions } from "@/lib/orders/queries";
import { formatLKR } from "@/lib/storefront/money";

export const metadata: Metadata = {
  title: "FAQ — Waseem Sports",
  description: "Delivery charges, cash on delivery, order tracking and how to reach the shop.",
  alternates: { canonical: "/faq" },
};

type Item = { q: string; a: string };

/**
 * Answers are assembled from things that actually exist — the live delivery
 * rules, the shop's own contact facts, the checkout/order copy we already
 * ship, and any published `faq` CMS page. Nothing about returns, warranty or
 * delivery promises is invented here.
 */

/** Copy already shipped on the home page's trust strip (reused, not invented). */
const SHIPPED = {
  freeOver: "Free delivery over LKR 10,000",
  cod: "Cash on delivery",
  returns: "7-day easy returns",
  updates: "SMS and email order updates",
};

function etaText(min: number | null, max: number | null): string {
  if (min === null && max === null) return "";
  if (min !== null && max !== null) {
    return min === max ? ` — about ${min} day${min === 1 ? "" : "s"}` : ` — about ${min}–${max} days`;
  }
  return ` — about ${min ?? max} days`;
}

/**
 * Turn a published FAQ page into items. Accepts the two shapes an owner is
 * likely to type: `Question — Answer` on one line, or `Q:` / `A:` lines.
 */
function parseFaqItems(body: string): Item[] {
  const items: Item[] = [];
  const lines = body
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const dash = line.match(/^(?:Q:\s*)?(.{3,200}?)\s+[—–]\s+(?:A:\s*)?(.+)$/);
    if (dash) {
      items.push({ q: dash[1]!.trim(), a: dash[2]!.trim() });
      continue;
    }
    const inline = line.match(/^Q:\s*(.{3,200}?)\s+A:\s*(.+)$/i);
    if (inline) {
      items.push({ q: inline[1]!.trim(), a: inline[2]!.trim() });
      continue;
    }
    const q = line.match(/^Q:\s*(.+)$/i);
    if (q) {
      const next = lines[i + 1];
      const a = next?.match(/^A:\s*(.+)$/i);
      if (a) {
        items.push({ q: q[1]!.trim(), a: a[1]!.trim() });
        i++;
      }
    }
  }
  return items;
}

function FaqList({ items }: { items: Item[] }) {
  return (
    <div className="box">
      {items.map((item) => (
        <details key={item.q}>
          <summary className="row cursor-pointer">
            <span className="nm">{item.q}</span>
          </summary>
          <p className="sold">{item.a}</p>
        </details>
      ))}
    </div>
  );
}

export default async function FaqPage() {
  const [rules, info, page] = await Promise.all([
    getShippingOptions(),
    getShopInfo(),
    getPage("faq"),
  ]);

  const published = page ? parseFaqItems(page.body) : [];

  const delivery: Item[] = rules.map((rule) => ({
    q: `${rule.name} — what does it cost?`,
    a: [
      rule.fee === 0 ? "Free" : formatLKR(rule.fee),
      rule.freeOver !== null ? `Free on orders over ${formatLKR(rule.freeOver)}.` : null,
      etaText(rule.estDaysMin, rule.estDaysMax).replace(/^ — /, "Arrives in about "),
    ]
      .filter(Boolean)
      .join(" · "),
  }));
  if (delivery.length === 0) {
    delivery.push({
      q: "How much is delivery?",
      a: `${SHIPPED.freeOver}. Delivery is confirmed with you before the order is packed.`,
    });
  }
  delivery.push({
    q: "When will my order arrive?",
    a: "We confirm the delivery date with you when we call to confirm your order.",
  });

  const payment: Item[] = [
    { q: "How can I pay?", a: `${SHIPPED.cod} — pay the rider when your order arrives. No card details are taken online.` },
  ];

  const ordering: Item[] = [
    {
      q: "Do I need an account to order?",
      a: "No. Checkout is a guest checkout — name, phone and address is all we need.",
    },
    {
      q: "How do I track my order?",
      a: "Your confirmation carries an order number and a tracking code. Enter both on the Track order page and you'll see the status and progress.",
    },
    { q: "Will I hear from you?", a: SHIPPED.updates },
  ];

  const returns: Item[] = [
    {
      q: "Can I return something?",
      a: `${SHIPPED.returns}. Message the shop with your order number and we'll take it from there.`,
    },
  ];

  const contactFacts = [
    info["public.store_address"],
    [info["public.store_phone_1"], info["public.store_phone_2"]].filter(Boolean).join(" · ") || null,
  ].filter(Boolean) as string[];
  const whatsapp = info["public.store_whatsapp"];

  return (
    <main>
      <h1 style={{ fontSize: "40px" }}>Frequently asked questions</h1>
      <p className="sold mt-1">
        Delivery, payment, tracking and getting in touch — the short version.
      </p>

      <div className="sec">
        <h2>Delivery</h2>
      </div>
      <FaqList items={delivery} />

      <div className="sec">
        <h2>Payment</h2>
      </div>
      <FaqList items={payment} />

      <div className="sec">
        <h2>Ordering and tracking</h2>
      </div>
      <FaqList items={ordering} />

      <div className="sec">
        <h2>Returns</h2>
      </div>
      <FaqList items={returns} />

      {contactFacts.length > 0 || whatsapp ? (
        <>
          <div className="sec">
            <h2>Reaching the shop</h2>
          </div>
          <div className="box">
            {contactFacts.map((fact) => (
              <p className="sold" key={fact}>
                {fact}
              </p>
            ))}
            {whatsapp && (
              <p className="sold">
                WhatsApp{" "}
                <a href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`} className="underline">
                  {whatsapp}
                </a>
              </p>
            )}
            <p>
              <Link className="btn" href="/contact">
                Contact us
              </Link>
            </p>
          </div>
        </>
      ) : null}

      {published.length > 0 && (
        <>
          <div className="sec">
            <h2>More questions</h2>
          </div>
          <FaqList items={published} />
        </>
      )}

      {published.length === 0 && (
        <div className="box mt-3">
          <h2>The long-form FAQ is on the way</h2>
          <p className="sold">
            We are still writing up the details. In the meantime, message us — or look up an order
            you have already placed.
          </p>
          <p>
            <Link className="btn" href="/contact">
              Contact the shop
            </Link>{" "}
            <Link className="btn out" href="/track">
              Track an order
            </Link>
          </p>
        </div>
      )}
    </main>
  );
}
