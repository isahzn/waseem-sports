import Link from "next/link";

/**
 * 404 boundary for the store group: `notFound()` thrown by a store page (a
 * missing product, an order without a valid token, an unpublished CMS page)
 * renders here, inside the storefront shell — so it keeps the video backdrop
 * and the design's own type.
 */
export default function StoreNotFound() {
  return (
    <main>
      <div className="box">
        <h1 style={{ fontSize: "40px" }}>Page not found</h1>
        <p className="sold mt-1">
          The page or product you asked for isn&apos;t here. It may have been unpublished or the link may be
          mistyped.
        </p>
        <p className="mt-3">
          <Link href="/shop" className="btn">
            Browse the shop
          </Link>
        </p>
      </div>
    </main>
  );
}
