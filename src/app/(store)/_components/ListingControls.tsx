import { getFacets, type ListFilters } from "@/lib/storefront/catalog";

/**
 * Filter + sort panel. Plain GET form — no client JS, shareable URLs,
 * crawler-friendly. Attribute selects only render for choice-type filterable
 * attributes that actually declare values.
 */
export async function ListingControls({
  base,
  current,
}: {
  base: Partial<ListFilters>;
  current: Record<string, string>;
}) {
  const facets = await getFacets(base);
  const attrs = facets.attributes.filter((a) => a.values.length > 0).slice(0, 6);

  return (
    <form method="get" className="flex flex-wrap items-end gap-3 rounded-md border border-line bg-card p-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">Sort</span>
        <select name="sort" defaultValue={current.sort ?? "newest"} className="rounded-sm border border-line bg-surface px-3 py-2">
          <option value="newest">Newest</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
          <option value="name">Name A–Z</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">Brand</span>
        <select name="brand" defaultValue={current.brand ?? ""} className="rounded-sm border border-line bg-surface px-3 py-2">
          <option value="">All brands</option>
          {facets.brands.map((b) => (
            <option key={b.id} value={b.slug ?? b.id}>{b.name}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">Min price (Rs)</span>
        <input
          type="number"
          name="min"
          min={0}
          defaultValue={current.min ?? ""}
          placeholder={String(facets.priceBounds.min)}
          className="w-28 rounded-sm border border-line bg-surface px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">Max price (Rs)</span>
        <input
          type="number"
          name="max"
          min={0}
          defaultValue={current.max ?? ""}
          placeholder={String(facets.priceBounds.max)}
          className="w-28 rounded-sm border border-line bg-surface px-3 py-2"
        />
      </label>
      {attrs.map((a) => (
        <label key={a.slug} className="flex flex-col gap-1 text-sm">
          <span className="text-muted">{a.name}</span>
          <select name={`attr_${a.slug}`} defaultValue={current[`attr_${a.slug}`] ?? ""} className="rounded-sm border border-line bg-surface px-3 py-2">
            <option value="">Any</option>
            {a.values.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </label>
      ))}
      {current.q && <input type="hidden" name="q" value={current.q} />}
      <button type="submit" className="rounded-sm border border-line px-4 py-2 text-sm font-semibold">
        Apply
      </button>
      <a href="?" className="px-2 py-2 text-sm text-muted underline">
        Clear
      </a>
    </form>
  );
}
