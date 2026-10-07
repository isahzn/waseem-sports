import { getFacets, type ListFilters } from "@/lib/storefront/catalog";

/**
 * Filter + sort panel. Plain GET form — no client JS, shareable URLs,
 * crawler-friendly. Chrome follows the design (`box`, `two`, `f`, `btn`);
 * attribute selects only render for choice-type filterable attributes that
 * actually declare values.
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
    <form method="get" className="box">
      <div className="two">
        <label>
          Sort
          <select name="sort" defaultValue={current.sort ?? "newest"} className="f">
            <option value="newest">Newest</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
            <option value="name">Name A–Z</option>
          </select>
        </label>
        <label>
          Brand
          <select name="brand" defaultValue={current.brand ?? ""} className="f">
            <option value="">All brands</option>
            {facets.brands.map((b) => (
              <option key={b.id} value={b.slug ?? b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Min price (LKR)
          <input
            type="number"
            name="min"
            min={0}
            defaultValue={current.min ?? ""}
            placeholder={String(facets.priceBounds.min)}
            className="f"
          />
        </label>
        <label>
          Max price (LKR)
          <input
            type="number"
            name="max"
            min={0}
            defaultValue={current.max ?? ""}
            placeholder={String(facets.priceBounds.max)}
            className="f"
          />
        </label>
        {attrs.map((a) => (
          <label key={a.slug}>
            {a.name}
            <select name={`attr_${a.slug}`} defaultValue={current[`attr_${a.slug}`] ?? ""} className="f">
              <option value="">Any</option>
              {a.values.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      {current.q && <input type="hidden" name="q" value={current.q} />}
      <button type="submit" className="btn">
        Apply
      </button>{" "}
      <a href="?" className="sold">
        Clear
      </a>
    </form>
  );
}
