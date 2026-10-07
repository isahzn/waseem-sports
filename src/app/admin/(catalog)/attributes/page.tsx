import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listTable } from "@/lib/catalog/query";
import { listParamsSchema } from "@/lib/catalog/schemas";
import type { Database } from "@/types/database";
import { EmptyState, Pagination, SearchBar, StatusBadge } from "../_components/ui";
import { ConfirmSubmit } from "../_components/ConfirmSubmit";
import { deleteAttribute } from "./actions";

export const metadata = { title: "Attributes — Waseem Sports Admin" };

type AttrRow = Database["public"]["Tables"]["attribute_definitions"]["Row"];

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const TYPE_LABELS: Record<string, string> = {
  text: "Text",
  number: "Number",
  select: "Choices",
  boolean: "Yes/No",
};

export default async function AttributesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const params = listParamsSchema.parse({ q: first(sp.q), page: first(sp.page) });

  const db = await createClient();
  const { rows, total, page, perPage } = await listTable<AttrRow>(db, "attribute_definitions", {
    q: params.q,
    page: params.page,
    orderBy: "sort_order",
    orderAscending: true,
  });

  return (
    <main>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Attributes</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Define specs once, reuse on every product. Tick “product option” for Size / Colour
            (things the buyer picks); leave it unticked for specs like Weight / Material.
          </p>
        </div>
        <Link
          href="/admin/attributes/new"
          className="rounded-sm bg-gold-600 px-4 py-2 text-sm font-semibold text-bronze-ink"
        >
          New attribute
        </Link>
      </div>

      <div className="mt-6">
        <SearchBar q={params.q} />
      </div>

      {rows.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No attributes yet"
            hint="Create Size and Colour first (fixed choices, usable as product options), then descriptive specs like Weight and Material."
            actionHref="/admin/attributes/new"
            actionLabel="New attribute"
          />
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-md border border-line">
          <table className="w-full min-w-170 text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-card text-muted">
                <th className="px-4 py-2 font-semibold">Name</th>
                <th className="px-4 py-2 font-semibold">Type</th>
                <th className="px-4 py-2 font-semibold">Use</th>
                <th className="px-4 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((attr) => (
                <tr key={attr.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-2">
                    <span className="font-semibold">{attr.name}</span>
                    <span className="ml-2 text-xs text-muted">{attr.slug}</span>
                  </td>
                  <td className="px-4 py-2 text-muted">{TYPE_LABELS[attr.input_type] ?? attr.input_type}</td>
                  <td className="px-4 py-2">
                    <span className="flex flex-wrap gap-1">
                      {attr.is_variant_option && <StatusBadge tone="gold">Option</StatusBadge>}
                      {attr.is_filterable && <StatusBadge tone="green">Filter</StatusBadge>}
                      {!attr.is_variant_option && !attr.is_filterable && (
                        <StatusBadge tone="muted">Spec</StatusBadge>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span className="flex justify-end gap-2">
                      <Link
                        href={`/admin/attributes/${attr.id}`}
                        className="rounded-sm border border-line px-3 py-1.5 text-sm"
                      >
                        Edit
                      </Link>
                      <ConfirmSubmit action={deleteAttribute} id={attr.id} label="Delete" confirmLabel="Delete forever?" />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} perPage={perPage} total={total} basePath="/admin/attributes" params={{ q: params.q }} />
    </main>
  );
}
