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
          mistyped. Try searching, or start over from the shop.
        </p>
        <p className="mt-3">
          <Link href="/shop" className="btn">
            Browse the shop
          </Link>{" "}
          <Link href="/" className="btn out">
            Back home
          </Link>
        </p>
        <p className="sold">
          Looking for an order? <Link href="/track">Track it here</Link> with your order number and code.
        </p>
      </div>
    </main>
  );
}
