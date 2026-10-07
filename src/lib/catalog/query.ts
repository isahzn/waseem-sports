import type { SupabaseClient } from "@supabase/supabase-js";

// Dynamic table names cannot satisfy the generated Database union, so this
// helper takes an untyped client and casts rows to T at the return boundary.
// Callers pass a concrete Row type; nothing leaves this module untyped.
type UntypedClient = SupabaseClient<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  "public",
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any
>;

export type ListOptions = {
  q?: string;
  page?: number;
  perPage?: number;
  /** Products only (and later pages). Tables without a status column ignore it. */
  status?: "draft" | "published" | "archived";
  /** Tables with is_visible; others ignore it. */
  visibility?: "all" | "visible" | "hidden";
  /** Tables with deleted_at; default hides soft-deleted rows. */
  includeDeleted?: boolean;
  archivedOnly?: boolean;
  orderBy?: string;
  orderAscending?: boolean;
};

/** Strip characters that would break the PostgREST `or()` separator syntax. */
function sanitizeSearch(q: string): string {
  return q.replace(/[,()]/g, " ").trim().slice(0, 100);
}

/**
 * Paginated admin list query over any catalog table.
 * Runs on whatever client the caller passes; every admin caller passes
 * `adminDb()` (service role), because a shared-password session has no Supabase
 * user for RLS to match. The `/admin/*` layout gate guards those reads.
 */
export async function listTable<T>(
  db: UntypedClient,
  table: string,
  opts: ListOptions = {},
): Promise<{ rows: T[]; total: number; page: number; perPage: number }> {
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const perPage = Math.min(100, Math.max(1, Math.floor(opts.perPage ?? 20)));
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  let query = db.from(table).select("*", { count: "exact" });

  const q = opts.q ? sanitizeSearch(opts.q) : "";
  if (q) query = query.or(`name.ilike.%${q}%,slug.ilike.%${q}%`);

  if (opts.archivedOnly) {
    query = query.not("deleted_at", "is", null);
  } else if (!opts.includeDeleted) {
    // Tables without deleted_at ignore an unknown filter — apply only where
    // the column exists. Attribute definitions have no deleted_at.
    if (table !== "attribute_definitions") query = query.is("deleted_at", null);
  }

  if (opts.visibility === "visible") query = query.eq("is_visible", true);
  else if (opts.visibility === "hidden") query = query.eq("is_visible", false);

  if (opts.status) query = query.eq("status", opts.status);

  query = query
    .order(opts.orderBy ?? (table === "products" ? "updated_at" : "sort_order"), {
      ascending: opts.orderAscending ?? (table === "products" ? false : true),
    })
    .range(from, to);

  const { data, count, error } = await query;
  if (error) throw new Error(`Catalog list failed: ${error.message}`);
  return { rows: (data ?? []) as T[], total: count ?? 0, page, perPage };
}
