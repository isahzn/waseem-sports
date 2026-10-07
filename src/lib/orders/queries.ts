import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashTrackingToken, tokensMatch } from "./tracking";
import type { AdminOrderFilters } from "./schemas";
import { REVENUE_STATUSES, type OrderStatus } from "./status";

/**
 * Order reads.
 *  * Storefront checkout reads shipping rules with the anon client (RLS
 *    exposes active rules only).
 *  * Admin reads use the session client, so the RLS admin-read policies stay
 *    the second layer behind `requireAdmin()` in the layout.
 *  * Tracking reads are service-role because `orders` is deliberately not
 *    anon-readable; the token hash is the capability.
 */

export const ORDERS_PER_PAGE = 20;

export type ShippingOption = {
  id: string;
  name: string;
  method: string;
  fee: number;
  freeOver: number | null;
  estDaysMin: number | null;
  estDaysMax: number | null;
};

export type OrderSummary = {
  id: string;
  order_number: string;
  status: OrderStatus;
  payment_status: string;
  payment_method: string;
  currency: string;
  subtotal: number;
  shipping_fee: number;
  total: number;
  customer_name: string;
  customer_phone: string;
  placed_at: string;
  shipping_method: string | null;
  stock_reserved: boolean;
  stock_committed: boolean;
  item_count: number;
};

export type OrderItemRow = {
  id: string;
  product_id: string | null;
  variant_id: string | null;
  product_name: string;
  variant_name: string | null;
  sku: string | null;
  unit_price: number;
  quantity: number;
  line_total: number;
};

export type OrderHistoryRow = {
  id: number;
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  note: string | null;
  created_at: string;
  actor: string | null;
};

export type OrderDetail = OrderSummary & {
  customer_email: string | null;
  notes: string | null;
  shipping_address: Record<string, unknown>;
  items: OrderItemRow[];
  history: OrderHistoryRow[];
};

/** Active delivery options for checkout (RLS: only `is_active` rules). */
export async function getShippingOptions(): Promise<ShippingOption[]> {
  const db = await createClient();
  const { data, error } = await db
    .from("shipping_rules")
    .select("id,name,method,fee,free_over,est_days_min,est_days_max")
    .eq("is_active", true)
    .order("sort_order")
    .order("fee");
  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id,
    name: r.name,
    method: r.method,
    fee: Number(r.fee),
    freeOver: r.free_over === null ? null : Number(r.free_over),
    estDaysMin: r.est_days_min,
    estDaysMax: r.est_days_max,
  }));
}

const ORDER_COLUMNS =
  "id,order_number,status,payment_status,payment_method,currency,subtotal,shipping_fee,total,customer_name,customer_phone,placed_at,shipping_method,stock_reserved,stock_committed";

/** Item counts for a set of orders (one extra query, no N+1 per row). */
async function itemCounts(db: Awaited<ReturnType<typeof createClient>>, orderIds: string[]) {
  const counts = new Map<string, number>();
  if (orderIds.length === 0) return counts;
  const { data } = await db.from("order_items").select("order_id,quantity").in("order_id", orderIds);
  for (const row of data ?? []) counts.set(row.order_id, (counts.get(row.order_id) ?? 0) + row.quantity);
  return counts;
}

/** Admin order list with status/date/search filters + pagination. */
export async function listOrders(
  filters: AdminOrderFilters,
): Promise<{ orders: OrderSummary[]; total: number; page: number; perPage: number }> {
  const db = await createClient();
  const page = Math.min(500, Math.max(1, filters.page ?? 1));
  const from = (page - 1) * ORDERS_PER_PAGE;

  let query = db.from("orders").select(ORDER_COLUMNS, { count: "exact" });
  if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
  if (filters.from) query = query.gte("placed_at", `${filters.from}T00:00:00.000Z`);
  if (filters.to) query = query.lte("placed_at", `${filters.to}T23:59:59.999Z`);
  if (filters.q) {
    // PostgREST `or()` metacharacters stripped: the search is data, not syntax.
    const needle = filters.q.replace(/[,()]/g, " ").trim().slice(0, 100);
    if (needle) {
      query = query.or(
        `order_number.ilike.%${needle}%,customer_name.ilike.%${needle}%,customer_phone.ilike.%${needle}%`,
      );
    }
  }

  const { data, count, error } = await query.order("placed_at", { ascending: false }).range(from, from + ORDERS_PER_PAGE - 1);
  if (error) throw new Error(`Order query failed: ${error.message}`);

  const rows = (data ?? []) as unknown as OrderSummary[];
  const counts = await itemCounts(db, rows.map((r) => r.id));
  return {
    orders: rows.map((r) => ({ ...r, item_count: counts.get(r.id) ?? 0 })),
    total: count ?? 0,
    page,
    perPage: ORDERS_PER_PAGE,
  };
}

/** One order with items snapshot and status timeline. */
export async function getOrderDetail(id: string): Promise<OrderDetail | null> {
  const db = await createClient();
  const { data, error } = await db
    .from("orders")
    .select(`${ORDER_COLUMNS},customer_email,notes,shipping_address`)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  const order = data as unknown as Omit<OrderDetail, "items" | "history" | "item_count">;

  const [itemsRes, historyRes] = await Promise.all([
    db
      .from("order_items")
      .select("id,product_id,variant_id,product_name,variant_name,sku,unit_price,quantity,line_total")
      .eq("order_id", id)
      .order("product_name"),
    db
      .from("order_status_history")
      .select("id,from_status,to_status,note,created_at,actor")
      .eq("order_id", id)
      .order("created_at"),
  ]);

  const items = (itemsRes.data ?? []) as unknown as OrderItemRow[];
  return {
    ...order,
    shipping_address: (order.shipping_address ?? {}) as Record<string, unknown>,
    items,
    history: (historyRes.data ?? []) as unknown as OrderHistoryRow[],
    item_count: items.reduce((sum, i) => sum + i.quantity, 0),
  };
}

/** Count of orders waiting to be confirmed (admin nav badge). */
export async function getNewOrderCount(): Promise<number> {
  try {
    const db = await createClient();
    const { count } = await db.from("orders").select("id", { count: "exact", head: true }).eq("status", "new");
    return count ?? 0;
  } catch {
    return 0;
  }
}

export type DashboardData = {
  newOrders: number;
  ordersToday: number;
  revenue30d: number;
  orders30d: number;
  topProducts: { name: string; quantity: number; revenue: number }[];
  lowStock: { variantId: string; productName: string; variantName: string; available: number; threshold: number }[];
};

/**
 * Dashboard numbers (D15 — deliberately simple). Aggregation happens in
 * server code over a capped window (newest 1000 orders / 90 days), which is
 * far beyond the realistic volume of a single shop; a SQL aggregate view is
 * the upgrade path if that ever stops being true.
 */
export async function getDashboardData(): Promise<DashboardData> {
  const db = await createClient();
  const now = Date.now();
  const since30 = new Date(now - 30 * 24 * 3600 * 1000).toISOString();
  const startOfToday = new Date(new Date(now).setHours(0, 0, 0, 0)).toISOString();

  const [newRes, recentRes, lowRes] = await Promise.all([
    db.from("orders").select("id", { count: "exact", head: true }).eq("status", "new"),
    db
      .from("orders")
      .select("id,total,status,placed_at")
      .gte("placed_at", new Date(now - 90 * 24 * 3600 * 1000).toISOString())
      .order("placed_at", { ascending: false })
      .limit(1000),
    db
      .from("inventory")
      .select("variant_id,on_hand,reserved,low_stock_threshold,track_inventory,product_variants(name,products(name))")
      .eq("track_inventory", true)
      .limit(500),
  ]);

  const recent = recentRes.data ?? [];
  const revenue = recent.filter(
    (o) => o.placed_at >= since30 && (REVENUE_STATUSES as string[]).includes(o.status),
  );
  const itemIds = revenue.map((o) => o.id);
  const itemsByOrder =
    itemIds.length > 0
      ? await db.from("order_items").select("order_id,product_name,quantity,line_total").in("order_id", itemIds.slice(0, 1000))
      : { data: [] as { order_id: string; product_name: string; quantity: number; line_total: number }[] };

  const top = new Map<string, { name: string; quantity: number; revenue: number }>();
  for (const item of itemsByOrder.data ?? []) {
    const cur = top.get(item.product_name) ?? { name: item.product_name, quantity: 0, revenue: 0 };
    cur.quantity += item.quantity;
    cur.revenue += Number(item.line_total);
    top.set(item.product_name, cur);
  }

  type InvRow = {
    variant_id: string;
    on_hand: number;
    reserved: number;
    low_stock_threshold: number;
    product_variants: { name: string; products: { name: string } | { name: string }[] | null } | { name: string; products: { name: string } | { name: string }[] | null }[] | null;
  };
  const one = <T>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
  const lowStock = ((lowRes.data ?? []) as unknown as InvRow[])
    .map((row) => {
      const variant = one(row.product_variants);
      const product = variant ? one(variant.products) : null;
      return {
        variantId: row.variant_id,
        productName: product?.name ?? "—",
        variantName: variant?.name ?? "—",
        available: row.on_hand - row.reserved,
        threshold: row.low_stock_threshold,
      };
    })
    .filter((row) => row.available <= row.threshold)
    .sort((a, b) => a.available - b.available)
    .slice(0, 12);

  return {
    newOrders: newRes.count ?? 0,
    ordersToday: recent.filter((o) => o.placed_at >= startOfToday).length,
    revenue30d: revenue.reduce((sum, o) => sum + Number(o.total), 0),
    orders30d: revenue.length,
    topProducts: [...top.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5),
    lowStock,
  };
}

export type TrackedOrder = {
  order_number: string;
  status: OrderStatus;
  placed_at: string;
  currency: string;
  subtotal: number;
  shipping_fee: number;
  total: number;
  payment_method: string;
  payment_status: string;
  customer_name: string;
  shipping_method: string | null;
  shipping_address: Record<string, unknown>;
  items: { product_name: string; variant_name: string | null; quantity: number; unit_price: number; line_total: number }[];
  history: { to_status: OrderStatus; created_at: string }[];
};

/**
 * Look an order up by number + tracking token. The raw token is hashed and
 * compared against `tracking_token_hash` in constant time; a wrong or missing
 * token returns null (no order metadata leaks, not even existence).
 */
export async function getTrackedOrder(orderNumber: string, token: string): Promise<TrackedOrder | null> {
  const number = orderNumber.trim().slice(0, 40);
  if (!number) return null;
  const hash = hashTrackingToken(token);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("orders")
    .select(
      "id,order_number,status,placed_at,currency,subtotal,shipping_fee,total,payment_method,payment_status,customer_name,shipping_method,shipping_address,tracking_token_hash",
    )
    .eq("order_number", number)
    .maybeSingle();
  if (error || !data) return null;
  if (!tokensMatch(hash, data.tracking_token_hash)) return null;

  const [itemsRes, historyRes] = await Promise.all([
    admin
      .from("order_items")
      .select("product_name,variant_name,quantity,unit_price,line_total")
      .eq("order_id", data.id)
      .order("product_name"),
    admin.from("order_status_history").select("to_status,created_at").eq("order_id", data.id).order("created_at"),
  ]);

  return {
    order_number: data.order_number,
    status: data.status as OrderStatus,
    placed_at: data.placed_at,
    currency: data.currency,
    subtotal: Number(data.subtotal),
    shipping_fee: Number(data.shipping_fee),
    total: Number(data.total),
    payment_method: data.payment_method,
    payment_status: data.payment_status,
    customer_name: data.customer_name,
    shipping_method: data.shipping_method,
    shipping_address: (data.shipping_address ?? {}) as Record<string, unknown>,
    items: (itemsRes.data ?? []).map((i) => ({ ...i, unit_price: Number(i.unit_price), line_total: Number(i.line_total) })),
    history: (historyRes.data ?? []) as { to_status: OrderStatus; created_at: string }[],
  };
}
