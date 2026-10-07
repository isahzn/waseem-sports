import { Suspense } from "react";
import { getNav, getShopInfo } from "@/lib/storefront/catalog";
import { CartProvider } from "./_components/CartProvider";
import { Header } from "./_components/Header";
import { Footer } from "./_components/Footer";
import { CartDrawer } from "./_components/CartDrawer";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [nav, info] = await Promise.all([getNav(), getShopInfo()]);

  return (
    <CartProvider>
      <Suspense>
        <Header sports={nav.sports} announcement={info["public.announcement"] ?? null} />
      </Suspense>
      <div className="flex min-h-[60vh] flex-col">
        <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</div>
      </div>
      <Footer sports={nav.sports} brands={nav.brands} info={info} />
      <CartDrawer />
    </CartProvider>
  );
}
