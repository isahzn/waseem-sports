import { ListingPage, type ListingSearch } from "../_components/ListingPage";

export const metadata = {
  title: "Search — Waseem Sports",
  description: "Search the Waseem Sports catalog.",
};

export default async function SearchPage({ searchParams }: { searchParams: Promise<ListingSearch> }) {
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.trim().slice(0, 100) ?? "";

  return (
    <ListingPage
      title={q ? `Results for “${q}”` : "Search"}
      subtitle={q ? undefined : "Type a word above — bats, balls, shoes, brands."}
      basePath="/search"
      scope={q ? { q } : {}}
      searchParams={sp}
    />
  );
}
