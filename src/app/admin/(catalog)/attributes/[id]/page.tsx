import Link from "next/link";
import { notFound } from "next/navigation";
import { adminDb, requireAdminOrRedirect } from "@/lib/auth/requireAdmin";
import { AttributeForm } from "../AttributeForm";
import { updateAttribute } from "../actions";

export const metadata = { title: "Edit attribute — Waseem Sports Admin" };

export default async function EditAttributePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminOrRedirect();
  const { id } = await params;
  const db = adminDb();
  const { data: attr } = await db.from("attribute_definitions").select("*").eq("id", id).single();
  if (!attr) notFound();

  const update = updateAttribute.bind(null, id);
  const options = Array.isArray(attr.options) ? (attr.options as string[]).join("\n") : "";

  return (
    <main>
      <Link href="/admin/attributes" className="text-sm text-muted hover:text-ink">
        ← Back to attributes
      </Link>
      <h1 className="mt-2 font-display text-3xl font-bold">Edit attribute</h1>
      <div className="mt-6">
        <AttributeForm
          action={update}
          submitLabel="Save changes"
          initial={{
            name: attr.name,
            slug: attr.slug,
            input_type: attr.input_type,
            options,
            is_filterable: attr.is_filterable,
            is_variant_option: attr.is_variant_option,
            sort_order: attr.sort_order,
          }}
        />
      </div>
    </main>
  );
}
