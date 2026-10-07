import Link from "next/link";
import { adminDb, requireAdminOrRedirect } from "@/lib/auth/requireAdmin";
import { listTable } from "@/lib/catalog/query";
import { listParamsSchema } from "@/lib/catalog/schemas";
import { formatLKR } from "@/lib/storefront/money";
import type { Database } from "@/types/database";
import {
  EmptyState,
  FilterSelect,
  Pagination,
  SearchBar,
  StatusBadge,
  productStatusTone,
} from "../_components/ui";
import { ConfirmSubmit } from "../_components/ConfirmSubmit";
import { archiveProduct, restoreProduct } from "./actions";

export const metadata = { title: "Products — Waseem Sports Admin" };

type ProductRow = Database["public"]["Tables"]["products"]["Row"];

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Authorize before reading: the layout's redirect does not stop this page
  // from running (Next renders them in parallel) and its payload would stream
  // into the redirect response.
  await requireAdminOrRedirect();
  const sp = await searchParams;
  const params = listParamsSchema.parse({
    q: first(sp.q),
    page: first(sp.page),
    status: first(sp.status),
    archived: first(sp.archived),
  });

  const db = adminDb();
  const { rows, total, page, perPage } = await listTable<ProductRow>(db, "products", {
    q: params.q,
    page: params.page,
    status: params.status,
    archivedOnly: params.archived === "only",
    includeDeleted: params.archived === "include",
  });
  const ids = rows.map((p) => p.id);
  const { data: variants } = ids.length
    ? await db.from("product_variants").select("product_id").in("product_id", ids).is("deleted_at", null)
    : { data: [] };
  const counts = new Map<string, number>();
  for (const v of variants ?? []) counts.set(v.product_id, (counts.get(v.product_id) ?? 0) + 1);

  const archivedView = params.archived === "only";

  return (
    <main>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Products</h1>
          <p className="mt-1 text-sm text-muted">
            Every product has at least one variant. Publishing makes it visible on the storefront.
          </p>
        </div>
        <Link
          href="/admin/products/new"
          className="rounded-sm bg-gold-600 px-4 py-2 text-sm font-semibold text-bronze-ink"
        >
          New product
        </Link>
      </div>

      <div className="mt-6">
        <SearchBar
          q={params.q}
          extra={
            <>
              <FilterSelect
                name="status"
                label="Status"
                value={params.status ?? ""}
                options={[
                  { value: "", label: "All statuses" },
                  { value: "draft", label: "Draft" },
                  { value: "published", label: "Published" },
                  { value: "archived", label: "Archived" },
                ]}
              />
              <FilterSelect
                name="archived"
                label="Deleted"
                value={params.archived ?? ""}
                options={[
                  { value: "", label: "Active only" },
                  { value: "include", label: "Include deleted" },
                  { value: "only", label: "Deleted only" },
                ]}
              />
            </>
          }
        />
      </div>

      {rows.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title={archivedView ? "No deleted products" : "No products yet"}
            hint="Create the first product — name, category, price, stock — then publish it to the storefront."
            actionHref={archivedView ? undefined : "/admin/products/new"}
            actionLabel={archivedView ? undefined : "New product"}
          />
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-md border border-line">
          <table className="w-full min-w-180 text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-card text-muted">
                <th className="px-4 py-2 font-semibold">Product</th>
                <th className="px-4 py-2 font-semibold">Price</th>
                <th className="px-4 py-2 font-semibold">Status</th>
                <th className="px-4 py-2 font-semibold">Variants</th>
                <th className="px-4 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-2">
                    <Link href={`/admin/products/${p.id}`} className="font-semibold hover:underline">
                      {p.name}
                    </Link>
                    <span className="ml-2 text-xs text-muted">{p.slug}</span>
                    {p.is_featured && (
                      <span className="ml-2"><StatusBadge tone="gold">Featured</StatusBadge></span>
                    )}
                  </td>
                  <td className="px-4 py-2">{formatLKR(p.base_price)}</td>
                  <td className="px-4 py-2">
                    {p.deleted_at ? (
                      <StatusBadge tone="red">Deleted</StatusBadge>
                    ) : (
                      <StatusBadge tone={productStatusTone(p.status)}>{p.status}</StatusBadge>
                    )}
                  </td>
                  <td className="px-4 py-2 text-muted">{counts.get(p.id) ?? 0}</td>
                  <td className="px-4 py-2">
                    <span className="flex justify-end gap-2">
                      <Link href={`/admin/products/${p.id}`} className="rounded-sm border border-line px-3 py-1.5 text-sm">
                        Manage
                      </Link>
                      {p.deleted_at ? (
                        <ConfirmSubmit action={restoreProduct} id={p.id} label="Restore" confirmLabel="Confirm restore?" tone="neutral" />
                      ) : (
                        <ConfirmSubmit action={archiveProduct} id={p.id} label="Archive" confirmLabel="Confirm archive?" />
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={page}
        perPage={perPage}
        total={total}
        basePath="/admin/products"
        params={{ q: params.q, status: params.status, archived: params.archived }}
      />
    </main>
  );
}
