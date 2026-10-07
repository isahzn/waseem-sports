import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CategoryForm } from "../CategoryForm";
import { updateCategory } from "../actions";

export const metadata = { title: "Edit category — Waseem Sports Admin" };

export default async function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await createClient();
  const [catRes, sportsRes, parentsRes] = await Promise.all([
    db.from("categories").select("*").eq("id", id).single(),
    db.from("sports").select("id,name").is("deleted_at", null).order("sort_order").order("name"),
    db.from("categories").select("id,name").is("deleted_at", null).order("name"),
  ]);
  if (!catRes.data) notFound();
  const cat = catRes.data;

  const update = updateCategory.bind(null, id);

  return (
    <main>
      <Link href="/admin/categories" className="text-sm text-muted hover:text-ink">
        ← Back to categories
      </Link>
      <h1 className="mt-2 font-display text-3xl font-bold">Edit category</h1>
      <div className="mt-6">
        <CategoryForm
          action={update}
          sports={sportsRes.data ?? []}
          parents={parentsRes.data ?? []}
          selfId={id}
          submitLabel="Save changes"
          initial={{
            name: cat.name,
            slug: cat.slug,
            description: cat.description ?? "",
            sport_id: cat.sport_id ?? "",
            parent_id: cat.parent_id ?? "",
            is_visible: cat.is_visible,
            sort_order: cat.sort_order,
            seo_title: cat.seo_title ?? "",
            seo_description: cat.seo_description ?? "",
            imageAlt: cat.image_alt ?? "",
          }}
        />
      </div>
    </main>
  );
}
