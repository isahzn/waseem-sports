import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ListingPage, type ListingSearch } from "../../_components/ListingPage";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = await createClient();
  const { data } = await db.from("brands").select("name").eq("slug", slug).single();
  if (!data) return { title: "Brand — Waseem Sports" };
  return {
    title: `${data.name} — Waseem Sports`,
    description: `Shop ${data.name} gear at Waseem Sports.`,
  };
}

export default async function BrandPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<ListingSearch>;
}) {
  const { slug } = await params;
  const db = await createClient();
  const { data: brand } = await db
    .from("brands")
    .select("id,name,description")
    .eq("slug", slug)
    .eq("is_visible", true)
    .is("deleted_at", null)
    .single();
  if (!brand) notFound();

  return (
    <ListingPage
      title={brand.name}
      subtitle={brand.description ?? undefined}
      basePath={`/brand/${slug}`}
      scope={{ brand_id: brand.id }}
      searchParams={await searchParams}
    />
  );
}
