import Link from "next/link";
import { requireAdminOrRedirect } from "@/lib/auth/requireAdmin";
import { TaxonomyForm } from "../../_components/TaxonomyForm";
import { createSport } from "../actions";

export const metadata = { title: "New sport — Waseem Sports Admin" };
export default async function NewSportPage() {
  await requireAdminOrRedirect();

  return (
    <main>
      <Link href="/admin/sports" className="text-sm text-muted hover:text-ink">
        ← Back to sports
      </Link>
      <h1 className="mt-2 font-display text-3xl font-bold">New sport</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        A sport groups the categories and products a player browses by game. Save it first, then add
        a tile photo and its categories.
      </p>
      <div className="mt-6">
        <TaxonomyForm
          action={createSport}
          imageAltLabel="Image alt text"
          featuredLabel="Show in “Shop by sport” on the homepage"
          submitLabel="Create sport"
        />
      </div>
    </main>
  );
}
