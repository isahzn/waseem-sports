import { adminDb, requireAdminOrRedirect } from "@/lib/auth/requireAdmin";
import { StatusBadge } from "../_components/ui";
import { AdjustForm, type VariantOption } from "./AdjustForm";

export const metadata = { title: "Inventory — Waseem Sports Admin" };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Authorize before reading (see ProductsPage).
  await requireAdminOrRedirect();
  const sp = await searchParams;
  const q = (first(sp.q) ?? "").trim().slice(0, 100);
  const lowOnly = first(sp.low) === "1";

  const db = adminDb();
  const { data: variants } = await db
    .from("product_variants")
    .select("id,name,product_id,products!inner(name)")
    .is("deleted_at", null)
    .order("name")
    .limit(500);
  const { data: stock } = await db.from("inventory").select("*");

  const byVariant = new Map((stock ?? []).map((s) => [s.variant_id, s]));
  let rows = (variants ?? []).map((v) => {
    const product = v.products as unknown as { name: string } | { name: string }[] | null;
    const productName = Array.isArray(product) ? product[0]?.name ?? "?" : (product?.name ?? "?");
    const s = byVariant.get(v.id);
    return {
      variant_id: v.id,
      product_name: productName,
      variant_name: v.name,
      on_hand: s?.on_hand ?? 0,
      reserved: s?.reserved ?? 0,
      available: (s?.on_hand ?? 0) - (s?.reserved ?? 0),
      threshold: s?.low_stock_threshold ?? 5,
      tracked: s?.track_inventory ?? true,
    };
  });

  if (q) {
    const needle = q.toLowerCase();
    rows = rows.filter(
      (r) =>
        r.product_name.toLowerCase().includes(needle) ||
        r.variant_name.toLowerCase().includes(needle),
    );
  }
  const lowCount = rows.filter((r) => r.tracked && r.available <= r.threshold).length;
  if (lowOnly) rows = rows.filter((r) => r.tracked && r.available <= r.threshold);

  const options: VariantOption[] = rows.map((r) => ({
    variant_id: r.variant_id,
    product_name: r.product_name,
    variant_name: r.variant_name,
    on_hand: r.on_hand,
    reserved: r.reserved,
  }));

  return (
    <main className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-3xl font-bold">Inventory</h1>
        <p className="mt-1 text-sm text-muted">
          Live stock per variant. Available = on hand − reserved.{" "}
          {lowCount > 0 ? (
            <span className="font-semibold text-gold-400">{lowCount} variant{lowCount === 1 ? "" : "s"} at or below threshold.</span>
          ) : (
            "Nothing is low right now."
          )}
        </p>
      </div>

      <div>
        <form method="get" className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-52 flex-1 flex-col gap-1 text-sm">
            <span className="text-muted">Search</span>
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Product or variant…"
              maxLength={100}
              className="rounded-sm border border-line bg-surface px-3 py-2"
            />
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input type="checkbox" name="low" value="1" defaultChecked={lowOnly} />
            Low stock only
          </label>
          <button type="submit" className="rounded-sm border border-line px-4 py-2 text-sm font-semibold">
            Apply
          </button>
        </form>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted">No variants match. Create products first.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-line">
          <table className="w-full min-w-180 text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-card text-muted">
                <th className="px-4 py-2 font-semibold">Product</th>
                <th className="px-4 py-2 font-semibold">Variant</th>
                <th className="px-4 py-2 font-semibold">On hand</th>
                <th className="px-4 py-2 font-semibold">Reserved</th>
                <th className="px-4 py-2 font-semibold">Available</th>
                <th className="px-4 py-2 font-semibold">State</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.variant_id} className="border-b border-line last:border-0">
                  <td className="px-4 py-2 font-semibold">{r.product_name}</td>
                  <td className="px-4 py-2 text-muted">{r.variant_name}</td>
                  <td className="px-4 py-2">{r.on_hand}</td>
                  <td className="px-4 py-2">{r.reserved}</td>
                  <td className="px-4 py-2 font-semibold">{r.available}</td>
                  <td className="px-4 py-2">
                    {!r.tracked ? (
                      <StatusBadge tone="muted">Untracked</StatusBadge>
                    ) : r.available <= 0 ? (
                      <StatusBadge tone="red">Out of stock</StatusBadge>
                    ) : r.available <= r.threshold ? (
                      <StatusBadge tone="gold">Low</StatusBadge>
                    ) : (
                      <StatusBadge tone="green">OK</StatusBadge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div>
        <h2 className="text-lg font-bold">Adjust stock</h2>
        <div className="mt-4">
          <AdjustForm variants={options} />
        </div>
      </div>
    </main>
  );
}
