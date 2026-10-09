import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ListingPage, type ListingSearch } from "../../_components/ListingPage";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = await createClient();
  const { data } = await db.from("sports").select("name,seo_title,seo_description").eq("slug", slug).single();
  if (!data) return { title: "Sport — Waseem Sports" };
  return {
    title: data.seo_title || `${data.name} — Waseem Sports`,
    description: data.seo_description || `Shop ${data.name} gear at Waseem Sports.`,
  };
}

export default async function SportPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<ListingSearch>;
}) {
  const { slug } = await params;
  const db = await createClient();
  const { data: sport } = await db
    .from("sports")
    .select("id,name,description")
    .eq("slug", slug)
    .eq("is_visible", true)
    .is("deleted_at", null)
    .single();
  if (!sport) notFound();

  // Fixes §2.2: a sport with no published products has no page — redirect to
  // /shop with a note instead of showing an empty aisle. The shop page renders
  // the note from the `empty` param (see shop/page.tsx).
  const { count } = await db
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("sport_id", sport.id)
    .eq("status", "published")
    .is("deleted_at", null);
  if ((count ?? 0) === 0) redirect(`/shop?empty=${encodeURIComponent(slug)}`);

  return (
    <ListingPage
      title={sport.name}
      subtitle={sport.description ?? undefined}
      basePath={`/sport/${slug}`}
      scope={{ sport_id: sport.id }}
      searchParams={await searchParams}
      activeSportSlug={slug}
    />
  );
}
