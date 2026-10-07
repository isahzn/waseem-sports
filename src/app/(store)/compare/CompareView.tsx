"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { cardImage } from "@/lib/storefront/images";
import { formatLKR } from "@/lib/storefront/money";
import { clearCompare, toggleCompare, useCompareIds } from "@/lib/storefront/saved-items";

const MAX_COMPARE = 4;

type ImageRow = { storage_path: string; alt_text: string | null; is_primary: boolean; sort_order: number };

type Compared = {
  id: string;
  slug: string;
  name: string;
  basePrice: number;
  compareAt: number | null;
  brand: string | null;
  category: string | null;
  sport: string | null;
  image: ImageRow | null;
  status: "in_stock" | "low_stock" | "out_of_stock";
  options: string[];
};

const STATUS_LABEL: Record<Compared["status"], string> = {
  in_stock: "In stock",
  low_stock: "Low stock",
  out_of_stock: "Out of stock",
};

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

async function fetchCompared(ids: string[]): Promise<Map<string, Compared>> {
  const db = createClient();
  const [products, images, variants, availability] = await Promise.all([
    db
      .from("products")
      .select("id,slug,name,base_price,compare_at_price,brands(name),categories: category_id(name),sports: sport_id(name)")
      .in("id", ids)
      .eq("status", "published")
      .is("deleted_at", null),
    db.from("product_images").select("product_id,storage_path,alt_text,is_primary,sort_order").in("product_id", ids).order("sort_order"),
    db.from("product_variants").select("id,product_id,name,is_default,sort_order,options").in("product_id", ids).eq("is_active", true).is("deleted_at", null),
    db.from("variant_availability").select("variant_id,product_id,status").in("product_id", ids),
  ]);
  if (products.error) throw new Error(products.error.message);

  const imageByProduct = new Map<string, ImageRow>();
  for (const row of (images.data ?? []) as (ImageRow & { product_id: string })[]) {
    const current = imageByProduct.get(row.product_id);
    if (!current || (row.is_primary && !current.is_primary) || (row.is_primary === current.is_primary && row.sort_order < current.sort_order)) {
      imageByProduct.set(row.product_id, {
        storage_path: row.storage_path,
        alt_text: row.alt_text,
        is_primary: row.is_primary,
        sort_order: row.sort_order,
      });
    }
  }

  const optionByProduct = new Map<string, string[]>();
  for (const row of (variants.data ?? []) as { product_id: string; name: string; options: Record<string, string> | null }[]) {
    const values = Object.values(row.options ?? {}).filter((value) => typeof value === "string" && value !== "");
    const list = optionByProduct.get(row.product_id) ?? [];
    for (const value of values.length > 0 ? values : [row.name]) {
      if (!list.includes(value)) list.push(value);
    }
    optionByProduct.set(row.product_id, list.slice(0, 8));
  }

  const statusByProduct = new Map<string, "in_stock" | "low_stock" | "out_of_stock">();
  const rank = { out_of_stock: 0, low_stock: 1, in_stock: 2 } as const;
  for (const row of (availability.data ?? []) as { variant_id: string; product_id: string; status: string }[]) {
    const status = row.status as "in_stock" | "low_stock" | "out_of_stock";
    const current = statusByProduct.get(row.product_id);
    if (!current || rank[status] < rank[current]) statusByProduct.set(row.product_id, status);
  }

  const out = new Map<string, Compared>();
  for (const row of (products.data ?? []) as {
    id: string;
    slug: string;
    name: string;
    base_price: number;
    compare_at_price: number | null;
    brands: { name: string } | { name: string }[] | null;
    categories: { name: string } | { name: string }[] | null;
    sports: { name: string } | { name: string }[] | null;
  }[]) {
    out.set(row.id, {
      id: row.id,
      slug: row.slug,
      name: row.name,
      basePrice: Number(row.base_price),
      compareAt: row.compare_at_price === null ? null : Number(row.compare_at_price),
      brand: one(row.brands)?.name ?? null,
      category: one(row.categories)?.name ?? null,
      sport: one(row.sports)?.name ?? null,
      image: imageByProduct.get(row.id) ?? null,
      status: statusByProduct.get(row.id) ?? "out_of_stock",
      options: optionByProduct.get(row.id) ?? [],
    });
  }
  return out;
}

export function CompareView() {
  const ids = useCompareIds().slice(0, MAX_COMPARE);
  const [items, setItems] = useState<Compared[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Nothing selected: no fetch and no state writes — the empty state below
    // is derived, so this effect never sets state synchronously.
    if (ids.length === 0) return;
    let cancelled = false;
    void (async () => {
      try {
        const found = await fetchCompared(ids);
        if (cancelled) return;
        setItems(ids.map((id) => found.get(id)).filter((item): item is Compared => Boolean(item)));
        setError(null);
      } catch {
        if (!cancelled) setError("We couldn't load the products you're comparing. Check your connection and try again.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ids]);

  const selected = ids.length === 0 ? ([] as Compared[]) : items ?? [];
  const loading = ids.length > 0 && items === null;

  if (loading) return <p className="sold">Loading your comparison…</p>;

  if (error) {
    return (
      <div className="box" role="alert">
        <h2>The comparison didn&apos;t load</h2>
        <p className="sold">{error}</p>
        <p>
          <Link className="btn" href="/shop">
            Browse products
          </Link>
        </p>
      </div>
    );
  }

  if (selected.length === 0) {
    return (
      <div className="box">
        <h2>Nothing to compare yet</h2>
        <p className="sold">
          Save up to {MAX_COMPARE} products with Compare on a product to see them side by side.
        </p>
        <p>
          <Link className="btn" href="/shop">
            Browse products
          </Link>
        </p>
      </div>
    );
  }

  const cheapest = Math.min(...selected.map((item) => item.basePrice));

  return (
    <>
      <p className="sold">
        Comparing {selected.length} product{selected.length === 1 ? "" : "s"} · saved on this device only.
      </p>
      <div className="box tw">
        <table>
          <tbody>
            <tr>
              <th scope="row" />
              {selected.map((item) => {
                const img = item.image ? cardImage(item.image) : null;
                return (
                  <td key={item.id}>
                    {img && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={img.src}
                        alt={item.image?.alt_text || item.name}
                        width={80}
                        height={80}
                        loading="lazy"
                        decoding="async"
                        style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 2 }}
                      />
                    )}
                    <br />
                    <Link href={`/product/${item.slug}`}>
                      <b>{item.name}</b>
                    </Link>
                  </td>
                );
              })}
            </tr>
            <tr>
              <th scope="row">Price</th>
              {selected.map((item) => (
                <td key={item.id}>
                  <span className="pr">{formatLKR(item.basePrice)}</span>
                  {item.compareAt !== null && item.compareAt > item.basePrice && <s> {formatLKR(item.compareAt)}</s>}
                  {item.basePrice === cheapest && selected.length > 1 && <span className="sold"> · lowest</span>}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">Availability</th>
              {selected.map((item) => (
                <td key={item.id}>
                  {item.status === "out_of_stock" ? (
                    <span className="sold">{STATUS_LABEL[item.status]}</span>
                  ) : (
                    <span className="pill">{STATUS_LABEL[item.status]}</span>
                  )}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">Brand</th>
              {selected.map((item) => (
                <td key={item.id}>{item.brand ?? "—"}</td>
              ))}
            </tr>
            <tr>
              <th scope="row">Category</th>
              {selected.map((item) => (
                <td key={item.id}>{[item.category, item.sport].filter(Boolean).join(" · ") || "—"}</td>
              ))}
            </tr>
            <tr>
              <th scope="row">Options</th>
              {selected.map((item) => (
                <td key={item.id}>{item.options.length > 0 ? item.options.join(", ") : "—"}</td>
              ))}
            </tr>
            <tr>
              <th scope="row" />
              {selected.map((item) => (
                <td key={item.id}>
                  <button
                    type="button"
                    className="sold border-0 bg-transparent p-0 text-left"
                    aria-label={`Remove ${item.name} from the comparison`}
                    onClick={() => toggleCompare(item.id)}
                  >
                    Remove
                  </button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        <button
          type="button"
          className="sold border-0 bg-transparent p-0 text-left"
          onClick={() => clearCompare()}
        >
          Clear all
        </button>
      </p>
    </>
  );
}
