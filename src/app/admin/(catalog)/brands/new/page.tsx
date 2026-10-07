import Link from "next/link";
import { TaxonomyForm } from "../../_components/TaxonomyForm";
import { createBrand } from "../actions";

export const metadata = { title: "New brand — Waseem Sports Admin" };

export default function NewBrandPage() {
  return (
    <main>
      <Link href="/admin/brands" className="text-sm text-muted hover:text-ink">
        ← Back to brands
      </Link>
      <h1 className="mt-2 font-display text-3xl font-bold">New brand</h1>
      <div className="mt-6">
        <TaxonomyForm action={createBrand} imageAltLabel="Logo alt text" submitLabel="Create brand" />
      </div>
    </main>
  );
}
