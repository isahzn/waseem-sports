import Link from "next/link";
import { adminDb, requireAdminOrRedirect } from "@/lib/auth/requireAdmin";
import { listTable } from "@/lib/catalog/query";
import { listParamsSchema } from "@/lib/catalog/schemas";
import type { Database } from "@/types/database";
import {
  EmptyState,
  FilterSelect,
  Pagination,
  SearchBar,
  StatusBadge,
  visibilityTone,
} from "../_components/ui";
import { ConfirmSubmit } from "../_components/ConfirmSubmit";
import { archiveCategory, restoreCategory } from "./actions";

export const metadata = { title: "Categories — Waseem Sports Admin" };

type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminOrRedirect();
  const sp = await searchParams;
  const params = listParamsSchema.parse({
    q: first(sp.q),
    page: first(sp.page),
    visibility: first(sp.visibility),
    archived: first(sp.archived),
  });

  const db = adminDb();
  const [{ rows, total, page, perPage }, sportsRes, parentsRes] = await Promise.all([
    listTable<CategoryRow>(db, "categories", {
      q: params.q,
      page: params.page,
      visibility: params.visibility,
      archivedOnly: params.archived === "only",
      includeDeleted: params.archived === "include",
    }),
    db.from("sports").select("id,name").is("deleted_at", null).order("name"),
    db.from("categories").select("id,name").is("deleted_at", null).order("name"),
  ]);

  const names = new Map<string, string>();
  for (const s of sportsRes.data ?? []) names.set(`sport:${s.id}`, s.name);
  for (const c of parentsRes.data ?? []) names.set(`cat:${c.id}`, c.name);

  const archivedView = params.archived === "only";

  return (
    <main>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Categories</h1>
          <p className="mt-1 text-sm text-muted">
            Group products within or across sports. Categories may nest one level deep via a parent.
          </p>
        </div>
        <Link
          href="/admin/categories/new"
          className="rounded-sm bg-gold-600 px-4 py-2 text-sm font-semibold text-bronze-ink"
        >
          New category
        </Link>
      </div>

      <div className="mt-6">
        <SearchBar
          q={params.q}
          extra={
            <>
              <FilterSelect
                name="visibility"
                label="Visibility"
                value={params.visibility}
                options={[
                  { value: "all", label: "All" },
                  { value: "visible", label: "Visible" },
                  { value: "hidden", label: "Hidden" },
                ]}
              />
              <FilterSelect
                name="archived"
                label="Archived"
                value={params.archived ?? ""}
                options={[
                  { value: "", label: "Active only" },
                  { value: "include", label: "Include archived" },
                  { value: "only", label: "Archived only" },
                ]}
              />
            </>
          }
        />
      </div>

      {rows.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title={archivedView ? "No archived categories" : "No categories yet"}
            hint={
              archivedView
                ? "Archived categories will appear here and can be restored."
                : "Create the first category — e.g. Cricket Bats under Cricket — then attach products to it."
            }
            actionHref={archivedView ? undefined : "/admin/categories/new"}
            actionLabel={archivedView ? undefined : "New category"}
          />
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-md border border-line">
          <table className="w-full min-w-170 text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-card text-muted">
                <th className="px-4 py-2 font-semibold">Name</th>
                <th className="px-4 py-2 font-semibold">Sport / Parent</th>
                <th className="px-4 py-2 font-semibold">Status</th>
                <th className="px-4 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((cat) => (
                <tr key={cat.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-2">
                    <span className="font-semibold">{cat.name}</span>
                    <span className="ml-2 text-xs text-muted">{cat.slug}</span>
                  </td>
                  <td className="px-4 py-2 text-muted">
                    {[
                      cat.sport_id ? names.get(`sport:${cat.sport_id}`) ?? "Unknown sport" : "Global",
                      cat.parent_id ? `↳ ${names.get(`cat:${cat.parent_id}`) ?? "Unknown parent"}` : "",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </td>
                  <td className="px-4 py-2">
                    {cat.deleted_at ? (
                      <StatusBadge tone="red">Archived</StatusBadge>
                    ) : (
                      <StatusBadge tone={visibilityTone(cat.is_visible)}>
                        {cat.is_visible ? "Visible" : "Hidden"}
                      </StatusBadge>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <span className="flex justify-end gap-2">
                      <Link
                        href={`/admin/categories/${cat.id}`}
                        className="rounded-sm border border-line px-3 py-1.5 text-sm"
                      >
                        Edit
                      </Link>
                      {cat.deleted_at ? (
                        <ConfirmSubmit action={restoreCategory} id={cat.id} label="Restore" confirmLabel="Confirm restore?" tone="neutral" />
                      ) : (
                        <ConfirmSubmit action={archiveCategory} id={cat.id} label="Archive" confirmLabel="Confirm archive?" />
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
        basePath="/admin/categories"
        params={{ q: params.q, visibility: params.visibility, archived: params.archived }}
      />
    </main>
  );
}
