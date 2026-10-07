import { WishlistView } from "./WishlistView";

export const metadata = {
  title: "Wishlist — Waseem Sports",
  description: "Products you saved for later, kept on this device.",
  robots: { index: false, follow: true },
};

/** Wishlist: the saved ids live in the browser, so the list renders client-side. */
export default function WishlistPage() {
  return (
    <main>
      <h1 style={{ fontSize: "40px" }}>Wishlist</h1>
      <WishlistView />
    </main>
  );
}
