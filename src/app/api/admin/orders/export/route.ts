import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/requireAdmin";
import { adminOrderFilters } from "@/lib/orders/schemas";
import { listOrders } from "@/lib/orders/queries";
import { STATUS_LABELS } from "@/lib/orders/status";

/**
 * GET /api/admin/orders/export — CSV of the current order filter (Fixes §3.6).
 * Same filters as the list page (q/status/from/to/need), capped at 1000 rows.
 * Admin-only (401/403 JSON, never a redirect — this is a download). Values are
 * CSV-escaped; the phone column is prefixed with a tab guard so spreadsheets
 * keep leading zeros and never evaluate cell content as a formula.
 */
function cell(value: string | number): string {
  const s = String(value);
  if (/[",\n=+\-@]/.test(s.slice(0, 1)) || /[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
  } catch (err) {
    const status = err instanceof AuthError ? err.status : 403;
    return NextResponse.json({ error: "Forbidden." }, { status });
  }

  const sp = request.nextUrl.searchParams;
  const first = (k: string) => sp.get(k) ?? undefined;
  const filters = adminOrderFilters.parse({
    q: first("q"),
    status: first("status"),
    from: first("from"),
    to: first("to"),
    page: "1",
    need: first("need"),
  });

  // listOrders pages at 20 rows; walk pages up to the 1000-row cap so the
  // export matches the filter instead of just the first screen.
  const capped: Awaited<ReturnType<typeof listOrders>>["orders"] = [];
  for (let page = 1; page <= 50 && capped.length < 1000; page++) {
    const { orders, total } = await listOrders({ ...filters, page });
    if (orders.length === 0) break;
    capped.push(...orders);
    if (capped.length >= total) break;
  }

  const header = ["Order", "Placed", "Status", "Customer", "Phone", "Items", "Subtotal", "Shipping", "Total", "Payment", "Payment status", "Stock"];
  const lines = [header.map(cell).join(",")];
  for (const o of capped) {
    lines.push(
      [
        o.order_number,
        o.placed_at,
        STATUS_LABELS[o.status],
        o.customer_name,
        `\t${o.customer_phone}`,
        o.item_count,
        o.subtotal,
        o.shipping_fee,
        o.total,
        o.payment_method,
        o.payment_status,
        o.stock_committed ? "committed" : o.stock_reserved ? "reserved" : "—",
      ]
        .map(cell)
        .join(","),
    );
  }

  return new NextResponse(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="waseem-orders-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
