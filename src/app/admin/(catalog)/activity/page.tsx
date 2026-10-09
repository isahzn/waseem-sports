import { adminDb, requireAdminOrRedirect } from "@/lib/auth/requireAdmin";
import { Pagination } from "../_components/ui";

export const metadata = { title: "Activity log — Waseem Sports Admin" };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function actionLabel(action: string): string {
  return action
    .split(".")
    .map((part) => part.replace(/_/g, " "))
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" · ");
}

/**
 * Activity log (Fixes §3.12): who changed what, when — the `audit_logs` rows
 * the actions already write. Shared-password sessions show as "Owner
 * (password)" since they record `actor: null` by design (D42).
 */
export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminOrRedirect();
  const sp = await searchParams;
  const page = Math.min(100, Math.max(1, Math.floor(Number(first(sp.page)) || 1)));
  const perPage = 30;

  const db = adminDb();
  const { data, count } = await db
    .from("audit_logs")
    .select("id,actor,action,entity,entity_id,created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1);

  const rows = data ?? [];
  const total = count ?? 0;

  return (
    <main>
      <h1 className="font-display text-3xl font-bold">Activity log</h1>
      <p className="mt-1 text-sm text-muted">
        Who changed what, when — newest first. Actions signed in with the shared
        password show as “Owner (password)” because that login has no account.
      </p>

      {rows.length === 0 ? (
        <p className="mt-6 rounded-md border border-dashed border-line bg-card px-6 py-12 text-center text-sm text-muted">
          No activity recorded yet. Changes made in the admin appear here.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-md border border-line">
          <table className="w-full min-w-160 text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-card text-muted">
                <th className="px-4 py-2 font-semibold">When</th>
                <th className="px-4 py-2 font-semibold">What</th>
                <th className="px-4 py-2 font-semibold">Who</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-2 text-muted">
                    {new Date(row.created_at).toLocaleString("en-LK", { dateStyle: "medium", timeStyle: "short" })}
                  </td>
                  <td className="px-4 py-2">
                    <span className="font-semibold">{actionLabel(row.action)}</span>
                    {row.entity_id && (
                      <span className="block text-xs text-muted">
                        {row.entity ?? "item"} · {String(row.entity_id).slice(0, 8)}…
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-muted">
                    {row.actor ? `Staff ${String(row.actor).slice(0, 8)}…` : "Owner (password)"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} perPage={perPage} total={total} basePath="/admin/activity" params={{}} />
    </main>
  );
}
