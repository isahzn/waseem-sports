import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CategoryForm } from "../CategoryForm";
import { createCategory } from "../actions";

export const metadata = { title: "New category — Waseem Sports Admin" };

export default async function NewCategoryPage() {
  const db = await createClient();
  const [sportsRes, parentsRes] = await Promise.all([
    db.from("sports").select("id,name").is("deleted_at", null).order("sort_order").order("name"),
    db.from("categories").select("id,name").is("deleted_at", null).order("name"),
  ]);

  return (
    <main>
      <Link href="/admin/categories" className="text-sm text-muted hover:text-ink">
        ← Back to categories
      </Link>
      <h1 className="mt-2 font-display text-3xl font-bold">New category</h1>
      <div className="mt-6">
        <CategoryForm
          action={createCategory}
          sports={sportsRes.data ?? []}
          parents={parentsRes.data ?? []}
          submitLabel="Create category"
        />
      </div>
    </main>
  );
}
