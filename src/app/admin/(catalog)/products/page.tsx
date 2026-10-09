import Link from "next/link";
import { z } from "zod";
import { adminDb, requireAdminOrRedirect } from "@/lib/auth/requireAdmin";
import { listTable } from "@/lib/catalog/query";
import { listParamsSchema } from "@/lib/catalog/schemas";
import { formatLKR } from "@/lib/storefront/money";
import { publicImageUrl } from "@/lib/storefront/images";
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

const photoSchema = z.enum(["all", "missing"]).catch("all");

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

type StockInfo = { available: number; worst: "in_stock" | "low_stock" | "out_of_stock" };

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
  const photoFilter = photoSchema.parse(first(sp.photo) ?? "all");

  const db = adminDb();
  // Fixes §3.3: the "Missing photo" filter needs the whole matching set, not
  // one page of it (a photo-less product could sit on any page). The catalog
  // is a single shop (tens of rows), so pull up to 500 and paginate the
  // filtered result in memory instead of complicating the shared list query.
  const wide = photoFilter === "missing";
  const { rows: fetched, total: fetchedTotal } = await listTable<ProductRow>(db, "products", {
    q: params.q,
    page: wide ? 1 : params.page,
    perPage: wide ? 500 : 20,
    status: params.status,
    archivedOnly: params.archived === "only",
    includeDeleted: params.archived === "include",
  });
  const ids = fetched.map((p) => p.id);
  const [variantsRes, imagesRes, sportsRes, brandsRes, availRes] = await Promise.all([
    ids.length
      ? db.from("product_variants").select("id,product_id").in("product_id", ids).is("deleted_at", null)
      : { data: [] as { id: string; product_id: string }[] },
    ids.length
      ? db
          .from("product_images")
          .select("product_id,storage_path,is_primary,sort_order")
          .in("product_id", ids)
          .order("sort_order")
      : { data: [] as { product_id: string; storage_path: string; is_primary: boolean; sort_order: number }[] },
    db.from("sports").select("id,name").is("deleted_at", null).limit(500),
    db.from("brands").select("id,name").is("deleted_at", null).limit(500),
    ids.length
      ? db.from("variant_availability").select("variant_id,status").in("product_id", ids)
      : { data: [] as { variant_id: string; status: string }[] },
  ]);
  const variantIds = (variantsRes.data ?? []).map((v) => v.id);
  const { data: invRows } = variantIds.length
    ? await db.from("inventory").select("variant_id,on_hand,reserved").in("variant_id", variantIds)
    : { data: [] as { variant_id: string; on_hand: number; reserved: number }[] };

  const counts = new Map<string, number>();
  const variantToProduct = new Map<string, string>();
  for (const v of variantsRes.data ?? []) {
    counts.set(v.product_id, (counts.get(v.product_id) ?? 0) + 1);
    variantToProduct.set(v.id, v.product_id);
  }
  const primaryByProduct = new Map<string, string>();
  const firstByProduct = new Map<string, string>();
  for (const img of imagesRes.data ?? []) {
    if (!firstByProduct.has(img.product_id)) firstByProduct.set(img.product_id, img.storage_path);
    if (img.is_primary) primaryByProduct.set(img.product_id, img.storage_path);
  }
  for (const [pid, path] of firstByProduct) {
    if (!primaryByProduct.has(pid)) primaryByProduct.set(pid, path);
  }
  const sportById = new Map((sportsRes.data ?? []).map((s) => [s.id, s.name]));
  const brandById = new Map((brandsRes.data ?? []).map((b) => [b.id, b.name]));
  const statusByVariant = new Map((availRes.data ?? []).map((a) => [a.variant_id, a.status]));
  const stock = new Map<string, StockInfo>();
  const rank = { out_of_stock: 0, low_stock: 1, in_stock: 2 } as const;
  for (const inv of invRows ?? []) {
    const pid = variantToProduct.get(inv.variant_id);
    if (!pid) continue;
    const cur = stock.get(pid) ?? { available: 0, worst: "in_stock" as const };
    cur.available += Number(inv.on_hand) - Number(inv.reserved);
    const s = (statusByVariant.get(inv.variant_id) ?? "out_of_stock") as keyof typeof rank;
    if (rank[s] < rank[cur.worst]) cur.worst = s;
    stock.set(pid, cur);
  }

  let rows = fetched;
  let total = fetchedTotal;
  let page = params.page;
  const perPage = 20;
  if (wide) {
    rows = fetched.filter((p) => !primaryByProduct.has(p.id));
    total = rows.length;
    page = Math.min(Math.max(params.page, 1), Math.max(1, Math.ceil(total / perPage)));
    rows = rows.slice((page - 1) * perPage, page * perPage);
  }

  const archivedView = params.archived === "only";
  const pageParams = { q: params.q, status: params.status, archived: params.archived, photo: photoFilter === "all" ? undefined : photoFilter };

  return (
    <main>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Products</h1>
          <p className="mt-1 text-sm text-muted">
            Every product has at least one variant. Publishing makes it visible on the storefront.
          </p>
        </div>
        <span className="flex flex-wrap gap-2">
          <a
            href="/api/admin/products/export"
            download
            title="Download all products as a spreadsheet file."
            className="rounded-sm border border-line px-4 py-2 text-sm font-semibold"
          >
            Export CSV
          </a>
          <Link
            href="/admin/products/new"
            className="rounded-sm bg-gold-600 px-4 py-2 text-sm font-semibold text-bronze-ink"
          >
            New product
          </Link>
        </span>
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
                name="photo"
                label="Photo"
                value={photoFilter}
                options={[
                  { value: "all", label: "All photos" },
                  { value: "missing", label: "Missing photo" },
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
            title={photoFilter === "missing" ? "No products without photos" : archivedView ? "No deleted products" : "No products yet"}
            hint={
              photoFilter === "missing"
                ? "Every product in this view has a photo. Good — cards with photos sell."
                : "Create the first product — name, category, price, stock — then publish it to the storefront."
            }
            actionHref={photoFilter === "missing" || archivedView ? undefined : "/admin/products/new"}
            actionLabel={photoFilter === "missing" || archivedView ? undefined : "New product"}
          />
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-md border border-line">
          <table className="w-full min-w-180 text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-card text-muted">
                <th className="px-4 py-2 font-semibold">Photo</th>
                <th className="px-4 py-2 font-semibold">Product</th>
                <th className="px-4 py-2 font-semibold">Sport</th>
                <th className="px-4 py-2 font-semibold">Brand</th>
                <th className="px-4 py-2 font-semibold">Price</th>
                <th className="px-4 py-2 font-semibold">Stock</th>
                <th className="px-4 py-2 font-semibold">Status</th>
                <th className="px-4 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const thumb = primaryByProduct.get(p.id);
                const st = stock.get(p.id);
                return (
                  <tr key={p.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-2">
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={publicImageUrl(thumb)}
                          alt=""
                          width={44}
                          height={44}
                          loading="lazy"
                          className="rounded-sm object-cover"
                          style={{ width: 44, height: 44 }}
                        />
                      ) : (
                        <span className="inline-grid place-items-center rounded-sm border border-dashed border-line text-xs text-muted" style={{ width: 44, height: 44 }}>
                          No photo
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <Link href={`/admin/products/${p.id}`} className="font-semibold hover:underline">
                        {p.name}
                      </Link>
                      <span className="ml-2 text-xs text-muted">{p.slug}</span>
                      {p.is_featured && (
                        <span className="ml-2"><StatusBadge tone="gold">Featured</StatusBadge></span>
                      )}
                      <span className="block text-xs text-muted">{counts.get(p.id) ?? 0} variant(s)</span>
                    </td>
                    <td className="px-4 py-2 text-muted">{(p.sport_id && sportById.get(p.sport_id)) ?? "—"}</td>
                    <td className="px-4 py-2 text-muted">{(p.brand_id && brandById.get(p.brand_id)) ?? "—"}</td>
                    <td className="px-4 py-2">{formatLKR(p.base_price)}</td>
                    <td className="px-4 py-2">
                      {st ? (
                        st.worst === "out_of_stock" ? (
                          <StatusBadge tone="red">Out</StatusBadge>
                        ) : st.worst === "low_stock" ? (
                          <StatusBadge tone="gold">Low · {st.available}</StatusBadge>
                        ) : (
                          <span className="text-muted">{st.available}</span>
                        )
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {p.deleted_at ? (
                        <StatusBadge tone="red">Deleted</StatusBadge>
                      ) : (
                        <StatusBadge tone={productStatusTone(p.status)}>{p.status}</StatusBadge>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {/* Fixes §3.3: Archive lives inside a "…" menu so it cannot
                          be clicked by accident. Two-step confirm kept. */}
                      <details className="relative inline-block text-left">
                        <summary
                          aria-label={`Actions for ${p.name}`}
                          className="inline-block cursor-pointer rounded-sm border border-line px-3 py-1.5 text-sm font-semibold"
                        >
                          …
                        </summary>
                        <span className="absolute right-0 z-10 mt-1 flex min-w-36 flex-col gap-1 rounded-md border border-line bg-card p-2 shadow-lg">
                          <Link
                            href={`/admin/products/${p.id}`}
                            className="rounded-sm px-3 py-1.5 text-left text-sm hover:bg-surface"
                          >
                            Manage
                          </Link>
                          {p.deleted_at ? (
                            <ConfirmSubmit action={restoreProduct} id={p.id} label="Restore" confirmLabel="Confirm restore?" tone="neutral" />
                          ) : (
                            <ConfirmSubmit action={archiveProduct} id={p.id} label="Archive" confirmLabel="Confirm archive?" />
                          )}
                        </span>
                      </details>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={page}
        perPage={wide ? perPage : 20}
        total={total}
        basePath="/admin/products"
        params={pageParams}
      />
    </main>
  );
}
