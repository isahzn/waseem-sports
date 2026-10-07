import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Admin, auth, cart, checkout and filtered listings stay out of the
        // index. /order/ and /track are tokenized and must never be crawled.
        disallow: ["/admin/", "/api/", "/cart", "/checkout", "/track", "/order/", "/search"],
      },
    ],
    sitemap: `${site}/sitemap.xml`,
  };
}
