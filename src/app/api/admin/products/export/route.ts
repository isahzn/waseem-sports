import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/requireAdmin";
import { adminDb } from "@/lib/auth/requireAdmin";
import { formatLKR } from "@/lib/storefront/money";

/**
 * GET /api/admin/products/export — products as a spreadsheet file (Fixes
 * §3.12 backup/export). Name, slug, price, status, sport, brand, variant and
 * stock counts. Admin-only. Values are CSV-escaped so a crafted product name
 * can never become a spreadsheet formula.
 */
function cell(value: string | number): string {
  const s = String(value);
  if (/[",\n=+\-@]/.test(s.slice(0, 1)) || /[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET() {
  try {
    await requireAdmin();
  } catch (err) {
    const status = err instanceof AuthError ? err.status : 403;
    return NextResponse.json({ error: "Forbidden." }, { status });
  }

  const db = adminDb();
  const { data: products } = await db
    .from("products")
    .select("id,name,slug,base_price,status,is_featured,sports(name),brands(name)")
    .is("deleted_at", null)
    .order("name")
    .limit(2000);
  const rows = products ?? [];
  const ids = rows.map((r: { id: string }) => r.id);
  const { data: variantRows } = ids.length
    ? await db.from("product_variants").select("id,product_id,name,sku").in("product_id", ids).is("deleted_at", null).limit(5000)
    : { data: [] as { id: string; product_id: string; name: string; sku: string | null }[] };
  const stockByVariant = new Map<string, number>();
  if ((variantRows ?? []).length > 0) {
    const { data: inv } = await db
      .from("inventory")
      .select("variant_id,on_hand,reserved")
      .in("variant_id", (variantRows ?? []).map((v) => v.id));
    for (const s of inv ?? []) stockByVariant.set(s.variant_id, Number(s.on_hand) - Number(s.reserved));
  }

  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
  const header = ["Product", "Slug", "Price", "Status", "Featured", "Sport", "Brand", "Variant", "SKU", "Available"];
  const lines = [header.map(cell).join(",")];
  for (const p of rows as {
    id: string;
    name: string;
    slug: string;
    base_price: number;
    status: string;
    is_featured: boolean;
    sports: { name: string } | { name: string }[] | null;
    brands: { name: string } | { name: string }[] | null;
  }[]) {
    const variants = (variantRows ?? []).filter((v) => v.product_id === p.id);
    if (variants.length === 0) {
      lines.push(
        [p.name, p.slug, formatLKR(p.base_price), p.status, p.is_featured ? "yes" : "no", one(p.sports)?.name ?? "", one(p.brands)?.name ?? "", "", "", ""]
          .map(cell)
          .join(","),
      );
    }
    for (const v of variants) {
      lines.push(
        [
          p.name,
          p.slug,
          formatLKR(p.base_price),
          p.status,
          p.is_featured ? "yes" : "no",
          one(p.sports)?.name ?? "",
          one(p.brands)?.name ?? "",
          v.name,
          v.sku ?? "",
          stockByVariant.get(v.id) ?? "",
        ]
          .map(cell)
          .join(","),
      );
    }
  }

  return new NextResponse(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="waseem-products-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
