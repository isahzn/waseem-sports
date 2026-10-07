import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TaxonomyForm } from "../../_components/TaxonomyForm";
import { updateBrand } from "../actions";

export const metadata = { title: "Edit brand — Waseem Sports Admin" };

export default async function EditBrandPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await createClient();
  const { data: brand } = await db.from("brands").select("*").eq("id", id).single();
  if (!brand) notFound();

  const update = updateBrand.bind(null, id);

  return (
    <main>
      <Link href="/admin/brands" className="text-sm text-muted hover:text-ink">
        ← Back to brands
      </Link>
      <h1 className="mt-2 font-display text-3xl font-bold">Edit brand</h1>
      <div className="mt-6">
        <TaxonomyForm
          action={update}
          imageAltLabel="Logo alt text"
          submitLabel="Save changes"
          initial={{
            name: brand.name,
            slug: brand.slug,
            description: brand.description ?? "",
            is_visible: brand.is_visible,
            is_featured: brand.is_featured,
            sort_order: brand.sort_order,
            seo_title: "",
            seo_description: "",
            imageAlt: brand.logo_alt ?? "",
          }}
        />
      </div>
    </main>
  );
}
