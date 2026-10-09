import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ListingSearch } from "../../_components/ListingPage";

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
  await searchParams;
  const db = await createClient();
  const { data: cat } = await db
    .from("categories")
    .select("id,name,sport_id")
    .eq("slug", slug)
    .eq("is_visible", true)
    .is("deleted_at", null)
    .single();
  if (!cat) notFound();
  // Fixes §2.2: sports and categories are one concept ("Sport") with one URL
  // scheme (/sport/[slug]). Old /category/ URLs redirect to the linked sport,
  // falling back to the slug match and then to /shop. Permanent (308) so
  // crawlers and bookmarks consolidate on the canonical sport URL.
  if (cat.sport_id) {
    const { data: sport } = await db
      .from("sports")
      .select("slug")
      .eq("id", cat.sport_id)
      .eq("is_visible", true)
      .is("deleted_at", null)
      .single();
    if (sport) redirect(`/sport/${sport.slug}`);
  }
  const { data: bySlug } = await db
    .from("sports")
    .select("slug")
    .eq("slug", slug)
    .eq("is_visible", true)
    .is("deleted_at", null)
    .single();
  if (bySlug) redirect(`/sport/${bySlug.slug}`);
  redirect("/shop");
}
