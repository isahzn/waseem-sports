import Link from "next/link";
import { TaxonomyForm } from "../../_components/TaxonomyForm";
import { createSport } from "../actions";

export const metadata = { title: "New sport — Waseem Sports Admin" };

export default function NewSportPage() {
  return (
    <main>
      <Link href="/admin/sports" className="text-sm text-muted hover:text-ink">
        ← Back to sports
      </Link>
      <h1 className="mt-2 font-display text-3xl font-bold">New sport</h1>
      <div className="mt-6">
        <TaxonomyForm action={createSport} imageAltLabel="Image alt text" submitLabel="Create sport" />
      </div>
    </main>
  );
}
