import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ListingPage, type ListingSearch } from "../../_components/ListingPage";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = await createClient();
  const { data } = await db.from("categories").select("name,seo_title,seo_description").eq("slug", slug).single();
  if (!data) return { title: "Category — Waseem Sports" };
  return {
    title: data.seo_title || `${data.name} — Waseem Sports`,
    description: data.seo_description || `Shop ${data.name} at Waseem Sports.`,
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<ListingSearch>;
}) {
  const { slug } = await params;
  const db = await createClient();
  const { data: cat } = await db
    .from("categories")
    .select("id,name,description")
    .eq("slug", slug)
    .eq("is_visible", true)
    .is("deleted_at", null)
    .single();
  if (!cat) notFound();

  return (
    <ListingPage
      title={cat.name}
      subtitle={cat.description ?? undefined}
      basePath={`/category/${slug}`}
      scope={{ category_id: cat.id }}
      searchParams={await searchParams}
      activeCategorySlug={slug}
    />
  );
}
