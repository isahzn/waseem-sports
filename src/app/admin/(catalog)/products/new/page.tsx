import Link from "next/link";
import { adminDb, requireAdminOrRedirect } from "@/lib/auth/requireAdmin";
import { ProductForm } from "../ProductForm";
import { createProduct } from "../actions";

export const metadata = { title: "New product — Waseem Sports Admin" };

export default async function NewProductPage() {
  // Authorize before reading (see ProductsPage).
  await requireAdminOrRedirect();
  const db = adminDb();
  const [sportsRes, catsRes, brandsRes] = await Promise.all([
    db.from("sports").select("id,name").is("deleted_at", null).order("name"),
    db.from("categories").select("id,name").is("deleted_at", null).order("name"),
    db.from("brands").select("id,name").is("deleted_at", null).order("name"),
  ]);

  return (
    <main>
      <Link href="/admin/products" className="text-sm text-muted hover:text-ink">
        ← Back to products
      </Link>
      <h1 className="mt-2 font-display text-3xl font-bold">New product</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        A hidden default variant and an empty stock record are created automatically.
        Add options, specs, images and stock on the next screen.
      </p>
      <div className="mt-6">
        <ProductForm
          action={createProduct}
          sports={sportsRes.data ?? []}
          categories={catsRes.data ?? []}
          brands={brandsRes.data ?? []}
          submitLabel="Create product"
        />
      </div>
    </main>
  );
}
