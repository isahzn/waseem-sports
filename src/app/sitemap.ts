import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

/** Sitemap: static routes + every visible taxonomy + published product. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const db = await createClient();
  const [sports, cats, brands, products] = await Promise.all([
    db.from("sports").select("slug,updated_at").eq("is_visible", true).is("deleted_at", null).limit(500),
    db.from("categories").select("slug,updated_at").eq("is_visible", true).is("deleted_at", null).limit(500),
    db.from("brands").select("slug,updated_at").eq("is_visible", true).is("deleted_at", null).limit(500),
    db.from("products").select("slug,updated_at").eq("status", "published").is("deleted_at", null).order("updated_at", { ascending: false }).limit(2000),
  ]);

  const entries: MetadataRoute.Sitemap = [
    { url: `${site}/`, changeFrequency: "daily", priority: 1 },
    { url: `${site}/shop`, changeFrequency: "daily", priority: 0.9 },
  ];
  for (const s of sports.data ?? []) {
    entries.push({ url: `${site}/sport/${s.slug}`, lastModified: s.updated_at ? new Date(s.updated_at) : undefined, changeFrequency: "weekly", priority: 0.8 });
  }
  for (const c of cats.data ?? []) {
    entries.push({ url: `${site}/category/${c.slug}`, lastModified: c.updated_at ? new Date(c.updated_at) : undefined, changeFrequency: "weekly", priority: 0.7 });
  }
  for (const b of brands.data ?? []) {
    entries.push({ url: `${site}/brand/${b.slug}`, lastModified: b.updated_at ? new Date(b.updated_at) : undefined, changeFrequency: "weekly", priority: 0.7 });
  }
  for (const p of products.data ?? []) {
    entries.push({ url: `${site}/product/${p.slug}`, lastModified: p.updated_at ? new Date(p.updated_at) : undefined, changeFrequency: "weekly", priority: 0.9 });
  }
  return entries;
}
