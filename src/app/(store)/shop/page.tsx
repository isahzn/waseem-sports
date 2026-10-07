import { ListingPage, type ListingSearch } from "../_components/ListingPage";

export const metadata = {
  title: "Shop all — Waseem Sports",
  description: "Browse the full Waseem Sports catalog. Filter by brand, price and specs.",
};

export default async function ShopPage({ searchParams }: { searchParams: Promise<ListingSearch> }) {
  return (
    <ListingPage
      title="Shop all"
      subtitle="Every published product, newest first."
      basePath="/shop"
      scope={{}}
      searchParams={await searchParams}
    />
  );
}
