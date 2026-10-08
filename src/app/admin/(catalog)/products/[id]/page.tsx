import Link from "next/link";
import { notFound } from "next/navigation";
import { adminDb, requireAdminOrRedirect } from "@/lib/auth/requireAdmin";
import { StatusBadge, productStatusTone } from "../../_components/ui";
import { ConfirmSubmit } from "../../_components/ConfirmSubmit";
import { ProductForm } from "../ProductForm";
import { VariantForm } from "../VariantForm";
import { SpecsForm } from "./SpecsForm";
import { ImagesManager } from "./ImagesManager";
import {
  createVariant,
  deleteVariant,
  saveAttributeValues,
  toggleVariantActive,
  updateProduct,
} from "../actions";
import { deleteImage, setPrimaryImage } from "./imageActions";
import { uploadProductImage } from "./uploadAction";

export const metadata = { title: "Manage product — Waseem Sports Admin" };

function formatLKR(n: number | null): string {
  if (n === null || n === undefined) return "—";
  return `Rs ${Number(n).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  // Authorize before reading (see ProductsPage).
  await requireAdminOrRedirect();
  const { id } = await params;
  const db = adminDb();

  const [prodRes, sportsRes, catsRes, brandsRes, variantsRes, imagesRes, attrDefsRes, attrValsRes, invRes] =
    await Promise.all([
      db.from("products").select("*").eq("id", id).single(),
      db.from("sports").select("id,name").is("deleted_at", null).order("name"),
      db.from("categories").select("id,name").is("deleted_at", null).order("name"),
      db.from("brands").select("id,name").is("deleted_at", null).order("name"),
      db.from("product_variants").select("*").eq("product_id", id).is("deleted_at", null).order("sort_order"),
      db.from("product_images").select("*").eq("product_id", id).order("sort_order"),
      db.from("attribute_definitions").select("id,name,slug,input_type,options,is_variant_option").order("sort_order"),
      db.from("product_attribute_values").select("attribute_id,value_text").eq("product_id", id),
      db.from("inventory").select("variant_id,on_hand,reserved,low_stock_threshold,track_inventory"),
    ]);
  if (!prodRes.data) notFound();
  const product = prodRes.data;

  const defs = attrDefsRes.data ?? [];
  const optionDefs = defs
    .filter((d) => d.is_variant_option)
    .map((d) => ({
      slug: d.slug,
      name: d.name,
      options: Array.isArray(d.options) ? (d.options as string[]) : [],
    }));
  const specDefs = defs
    .filter((d) => !d.is_variant_option)
    .map((d) => ({
      id: d.id,
      name: d.name,
      slug: d.slug,
      input_type: d.input_type,
      options: Array.isArray(d.options) ? (d.options as string[]) : [],
    }));

  const stock = new Map((invRes.data ?? []).map((i) => [i.variant_id, i]));
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const publicUrl = (path: string) =>
    `${supabaseUrl}/storage/v1/object/public/product-media/${path}`;

  const update = updateProduct.bind(null, id);
  const addVariant = createVariant.bind(null, id, optionDefs.map((d) => d.slug));
  const saveSpecs = saveAttributeValues.bind(null, id);

  return (
    <main className="flex flex-col gap-10">
      <div>
        <Link href="/admin/products" className="text-sm text-muted hover:text-ink">
          ← Back to products
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl font-bold">{product.name}</h1>
          <StatusBadge tone={productStatusTone(product.status)}>{product.status}</StatusBadge>
        </div>
      </div>

      <section>
        <h2 className="text-lg font-bold">Details</h2>
        <div className="mt-4">
          <ProductForm
            action={update}
            sports={sportsRes.data ?? []}
            categories={catsRes.data ?? []}
            brands={brandsRes.data ?? []}
            submitLabel="Save changes"
            statusHint="Publishing makes it visible on the storefront (anon sees published rows via RLS)."
            initial={{
              name: product.name,
              slug: product.slug,
              description: product.description ?? "",
              sport_id: product.sport_id ?? "",
              category_id: product.category_id ?? "",
              brand_id: product.brand_id ?? "",
              base_price: String(product.base_price),
              compare_at_price: product.compare_at_price !== null ? String(product.compare_at_price) : "",
              status: product.status,
              is_featured: product.is_featured,
              seo_title: product.seo_title ?? "",
              seo_description: product.seo_description ?? "",
            }}
          />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold">Variants + stock</h2>
        <p className="mt-1 text-sm text-muted">
          “Simple” products keep the single Default variant. Set stock in the Inventory page;
          each variant gets its stock record automatically.
        </p>
        <div className="mt-4 overflow-x-auto rounded-md border border-line">
          <table className="w-full min-w-180 text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-card text-muted">
                <th className="px-4 py-2 font-semibold">Variant</th>
                <th className="px-4 py-2 font-semibold">Options</th>
                <th className="px-4 py-2 font-semibold">Price</th>
                <th className="px-4 py-2 font-semibold">Stock</th>
                <th className="px-4 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(variantsRes.data ?? []).map((v) => {
                const s = stock.get(v.id);
                const opts = v.options as Record<string, string>;
                return (
                  <tr key={v.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-2">
                      <span className="font-semibold">{v.name}</span>
                      {v.is_default && <span className="ml-2 text-xs text-muted">(default)</span>}
                      {v.sku && <span className="ml-2 text-xs text-muted">{v.sku}</span>}
                      {!v.is_active && (
                        <span className="ml-2"><StatusBadge tone="muted">Inactive</StatusBadge></span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-muted">
                      {Object.entries(opts ?? {}).map(([k, val]) => `${k}: ${val}`).join(" · ") || "—"}
                    </td>
                    <td className="px-4 py-2">{v.price !== null ? formatLKR(v.price) : <span className="text-muted">{formatLKR(product.base_price)} (base)</span>}</td>
                    <td className="px-4 py-2 text-muted">
                      {s ? `${s.on_hand - s.reserved} avail (${s.on_hand} on hand)` : "—"}
                    </td>
                    <td className="px-4 py-2">
                      <span className="flex justify-end gap-2">
                        <form action={toggleVariantActive}>
                          <input type="hidden" name="id" value={v.id} />
                          <input type="hidden" name="product_id" value={id} />
                          <input type="hidden" name="to" value={String(!v.is_active)} />
                          <button type="submit" className="rounded-sm border border-line px-3 py-1.5 text-sm">
                            {v.is_active ? "Deactivate" : "Activate"}
                          </button>
                        </form>
                        {!v.is_default && (
                          <ConfirmSubmit
                            action={deleteVariant}
                            id={v.id}
                            label="Delete"
                            confirmLabel="Delete forever?"
                          />
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-4">
          <VariantForm action={addVariant} optionDefs={optionDefs} />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold">Specs</h2>
        <p className="mt-1 text-sm text-muted">Descriptive attributes shown on the product page (Weight, Material…).</p>
        <div className="mt-4">
          <SpecsForm action={saveSpecs} defs={specDefs} values={attrValsRes.data ?? []} />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold">Photos</h2>
        <p className="mt-1 text-sm text-muted">
          <Link href={`/admin/products/${id}/imagesearch`} className="underline">Find recommended images</Link>
          {" — deterministic suggestions, or upload manually below."}
        </p>
        <div className="mt-4">
          <ImagesManager
            productId={id}
            images={imagesRes.data ?? []}
            uploadAction={uploadProductImage}
            setPrimaryAction={setPrimaryImage}
            deleteAction={deleteImage}
            publicUrl={publicUrl}
          />
        </div>
      </section>
    </main>
  );
}
