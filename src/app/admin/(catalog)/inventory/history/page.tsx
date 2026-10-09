import Link from "next/link";
import { notFound } from "next/navigation";
import { adminDb, requireAdminOrRedirect } from "@/lib/auth/requireAdmin";

export const metadata = { title: "Stock history — Waseem Sports Admin" };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function reasonLabel(reason: string): string {
  switch (reason) {
    case "manual_adjust":
      return "Manual adjust";
    case "recount":
      return "Recount";
    case "initial":
      return "Initial stock";
    case "reserve":
      return "Order reserved";
    case "release":
      return "Order released";
    case "commit":
      return "Order shipped";
    default:
      return reason;
  }
}

/**
 * Stock history per variant (Fixes §3.5): every row of the append-only
 * `inventory_movements` ledger for one variant, newest first — who moved what
 * (orders link by id), so the owner can answer "where did my stock go?".
 */
export default async function StockHistoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminOrRedirect();
  const variantId = (first((await searchParams).variant) ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(variantId)) notFound();

  const db = adminDb();
  const [{ data: variant }, { data: movements }] = await Promise.all([
    db
      .from("product_variants")
      .select("id,name,products!inner(name)")
      .eq("id", variantId)
      .is("deleted_at", null)
      .maybeSingle(),
    db
      .from("inventory_movements")
      .select("id,on_hand_delta,reserved_delta,reason,order_id,note,created_at")
      .eq("variant_id", variantId)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);
  if (!variant) notFound();
  const product = variant.products as unknown as { name: string } | { name: string }[] | null;
  const productName = Array.isArray(product) ? (product[0]?.name ?? "?") : (product?.name ?? "?");

  return (
    <main>
      <Link href="/admin/inventory" className="text-sm text-muted hover:text-ink">
        ← Back to inventory
      </Link>
      <h1 className="mt-2 font-display text-3xl font-bold">Stock history</h1>
      <p className="mt-1 text-sm text-muted">
        {productName} · {variant.name} — newest first, latest 200 moves.
      </p>

      {(movements ?? []).length === 0 ? (
        <p className="mt-6 rounded-md border border-dashed border-line bg-card px-6 py-12 text-center text-sm text-muted">
          No stock moves recorded for this variant yet.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-md border border-line">
          <table className="w-full min-w-160 text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-card text-muted">
                <th className="px-4 py-2 font-semibold">When</th>
                <th className="px-4 py-2 font-semibold">Change</th>
                <th className="px-4 py-2 font-semibold">Reason</th>
                <th className="px-4 py-2 font-semibold">Note</th>
              </tr>
            </thead>
            <tbody>
              {(movements ?? []).map((m) => (
                <tr key={m.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-2 text-muted">
                    {new Date(m.created_at).toLocaleString("en-LK", { dateStyle: "medium", timeStyle: "short" })}
                  </td>
                  <td className="px-4 py-2 font-semibold">
                    {m.on_hand_delta !== 0 && (
                      <span>
                        {m.on_hand_delta > 0 ? "+" : ""}
                        {m.on_hand_delta} on hand
                      </span>
                    )}
                    {m.on_hand_delta !== 0 && m.reserved_delta !== 0 && " · "}
                    {m.reserved_delta !== 0 && (
                      <span className="text-muted">
                        {m.reserved_delta > 0 ? "+" : ""}
                        {m.reserved_delta} reserved
                      </span>
                    )}
                    {m.on_hand_delta === 0 && m.reserved_delta === 0 && <span className="text-muted">—</span>}
                  </td>
                  <td className="px-4 py-2">
                    {reasonLabel(m.reason)}
                    {m.order_id && <span className="block text-xs text-muted">order {m.order_id.slice(0, 8)}…</span>}
                  </td>
                  <td className="px-4 py-2 text-muted">{m.note || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
