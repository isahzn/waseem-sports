import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TaxonomyForm } from "../../_components/TaxonomyForm";
import { updateSport } from "../actions";

export const metadata = { title: "Edit sport — Waseem Sports Admin" };

export default async function EditSportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await createClient();
  const { data: sport } = await db.from("sports").select("*").eq("id", id).single();
  if (!sport) notFound();

  const update = updateSport.bind(null, id);

  return (
    <main>
      <Link href="/admin/sports" className="text-sm text-muted hover:text-ink">
        ← Back to sports
      </Link>
      <h1 className="mt-2 font-display text-3xl font-bold">Edit sport</h1>
      <div className="mt-6">
        <TaxonomyForm
          action={update}
          imageAltLabel="Image alt text"
          submitLabel="Save changes"
          initial={{
            name: sport.name,
            slug: sport.slug,
            description: sport.description ?? "",
            is_visible: sport.is_visible,
            is_featured: sport.is_featured,
            sort_order: sport.sort_order,
            seo_title: sport.seo_title ?? "",
            seo_description: sport.seo_description ?? "",
            imageAlt: sport.image_alt ?? "",
          }}
        />
      </div>
    </main>
  );
}
