import { ListingPage, type ListingSearch } from "../_components/ListingPage";

export const metadata = {
  title: "Shop all — Waseem Sports",
  description: "Browse the full Waseem Sports catalog. Filter by brand, price and specs.",
};

export default async function ShopPage({ searchParams }: { searchParams: Promise<ListingSearch> }) {
  const sp = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const empty = first(sp.empty)?.slice(0, 80);
  return (
    <ListingPage
      title="All products"
      subtitle="Every published product, newest first."
      basePath="/shop"
      scope={{}}
      searchParams={sp}
      activeCategorySlug={null}
      topContent={
        empty ? (
          <div className="box" role="status">
            <p className="sold" style={{ margin: 0 }}>
              {`“${empty}” has no products yet — showing everything instead.`}
            </p>
          </div>
        ) : undefined
      }
    />
  );
}
