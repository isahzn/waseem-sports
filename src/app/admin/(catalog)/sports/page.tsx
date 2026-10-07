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
import { archiveSport, restoreSport } from "./actions";

export const metadata = { title: "Sports — Waseem Sports Admin" };

type SportRow = Database["public"]["Tables"]["sports"]["Row"];

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SportsPage({
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
  const { rows, total, page, perPage } = await listTable<SportRow>(db, "sports", {
    q: params.q,
    page: params.page,
    visibility: params.visibility,
    archivedOnly: params.archived === "only",
    includeDeleted: params.archived === "include",
  });

  const archivedView = params.archived === "only";

  return (
    <main>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Sports</h1>
          <p className="mt-1 text-sm text-muted">
            Top-level taxonomy. Products link to a sport; archiving hides it from the storefront
            but keeps existing products intact.
          </p>
        </div>
        <Link
          href="/admin/sports/new"
          className="rounded-sm bg-gold-600 px-4 py-2 text-sm font-semibold text-bronze-ink"
        >
          New sport
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
            title={archivedView ? "No archived sports" : "No sports yet"}
            hint={
              archivedView
                ? "Archived sports will appear here and can be restored."
                : "Create the first sport — e.g. Cricket, Football, Fitness — then add categories and products under it."
            }
            actionHref={archivedView ? undefined : "/admin/sports/new"}
            actionLabel={archivedView ? undefined : "New sport"}
          />
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-md border border-line">
          <table className="w-full min-w-160 text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-card text-muted">
                <th className="px-4 py-2 font-semibold">Name</th>
                <th className="px-4 py-2 font-semibold">Slug</th>
                <th className="px-4 py-2 font-semibold">Status</th>
                <th className="px-4 py-2 font-semibold">Sort</th>
                <th className="px-4 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((sport) => (
                <tr key={sport.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-2 font-semibold">
                    {sport.name}
                    {sport.is_featured && (
                      <span className="ml-2">
                        <StatusBadge tone="gold">Featured</StatusBadge>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-muted">{sport.slug}</td>
                  <td className="px-4 py-2">
                    {sport.deleted_at ? (
                      <StatusBadge tone="red">Archived</StatusBadge>
                    ) : (
                      <StatusBadge tone={visibilityTone(sport.is_visible)}>
                        {sport.is_visible ? "Visible" : "Hidden"}
                      </StatusBadge>
                    )}
                  </td>
                  <td className="px-4 py-2 text-muted">{sport.sort_order}</td>
                  <td className="px-4 py-2">
                    <span className="flex justify-end gap-2">
                      <Link
                        href={`/admin/sports/${sport.id}`}
                        className="rounded-sm border border-line px-3 py-1.5 text-sm"
                      >
                        Edit
                      </Link>
                      {sport.deleted_at ? (
                        <ConfirmSubmit
                          action={restoreSport}
                          id={sport.id}
                          label="Restore"
                          confirmLabel="Confirm restore?"
                          tone="neutral"
                        />
                      ) : (
                        <ConfirmSubmit
                          action={archiveSport}
                          id={sport.id}
                          label="Archive"
                          confirmLabel="Confirm archive?"
                        />
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
        basePath="/admin/sports"
        params={{ q: params.q, visibility: params.visibility, archived: params.archived }}
      />
    </main>
  );
}
