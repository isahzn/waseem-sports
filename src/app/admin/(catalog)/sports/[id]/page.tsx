import Link from "next/link";
import { notFound } from "next/navigation";
import { adminDb, requireAdminOrRedirect } from "@/lib/auth/requireAdmin";
import { TaxonomyForm } from "../../_components/TaxonomyForm";
import { SportImageField } from "../SportImageField";
import { removeSportImage, uploadSportImage } from "../imageAction";
import { updateSport } from "../actions";

export const metadata = { title: "Edit sport — Waseem Sports Admin" };
export default async function EditSportPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminOrRedirect();
  const { id } = await params;
  const db = adminDb();
  const { data: sport } = await db.from("sports").select("*").eq("id", id).single();
  if (!sport) notFound();

  const update = updateSport.bind(null, id);

  return (
    <main>
      <Link href="/admin/sports" className="text-sm text-muted hover:text-ink">
        ← Back to sports
      </Link>
      <h1 className="mt-2 font-display text-3xl font-bold">Edit sport</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Storefront page:{" "}
        <Link href={`/sport/${sport.slug}`} className="underline hover:text-ink">
          /sport/{sport.slug}
        </Link>
        . The homepage section these tiles feed is a page block — control its heading and how many
        sports it shows in{" "}
        <Link href="/admin/pages" className="underline hover:text-ink">
          Pages → Home
        </Link>
        .
      </p>
      <div className="mt-6">
        <TaxonomyForm
          action={update}
          imageAltLabel="Image alt text"
          featuredLabel="Show in “Shop by sport” on the homepage"
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

      <SportImageField
        sportId={sport.id}
        imagePath={sport.image_path}
        altText={sport.image_alt ?? ""}
        uploadAction={uploadSportImage}
        removeAction={removeSportImage}
      />
    </main>
  );
}
