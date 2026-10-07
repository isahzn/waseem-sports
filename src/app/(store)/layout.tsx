import { Suspense } from "react";
import { getNav, getShopInfo } from "@/lib/storefront/catalog";
import { CartProvider } from "./_components/CartProvider";
import { Header } from "./_components/Header";
import { Footer } from "./_components/Footer";
import { CartDrawer } from "./_components/CartDrawer";

/**
 * Storefront shell, exactly as the canonical design: a fixed video backdrop
 * behind everything, then announcement bar → sticky header → main → footer.
 * `#bg-video` is decorative (aria-hidden, pointer-events:none) and is hidden
 * entirely under prefers-reduced-motion by design.css.
 */
export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [nav, info] = await Promise.all([getNav(), getShopInfo()]);

  return (
    <div className="ws">
      <div id="bg-video" aria-hidden="true">
        <video autoPlay muted loop playsInline preload="metadata">
          <source src="/assets/bg.mp4" type="video/mp4" />
        </video>
        <div className="scrim" />
      </div>

      <CartProvider>
        <Suspense>
          <Header announcement={info["public.announcement"] ?? null} />
        </Suspense>
        {children}
        <Footer sports={nav.sports} categories={nav.categories} brands={nav.brands} info={info} />
        <CartDrawer />
      </CartProvider>
    </div>
  );
}
