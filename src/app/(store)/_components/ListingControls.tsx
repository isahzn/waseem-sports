import { getFacets, type ListFilters } from "@/lib/storefront/catalog";

/**
 * Filter + sort panel (Fixes §2.2).
 *
 * Plain GET form — no client JS, shareable URLs, crawler-friendly.
 * - Desktop: slim left sidebar, collapsible via <details> (open by default).
 * - Mobile: the same <details> renders as a bottom sheet (see design.css
 *   `.filters` rules) with the active-filter count on the summary button.
 * - Active filters render as removable chips + a "Clear all" link.
 * - Sort stays a single dropdown (in the form, not duplicated).
 */

function removeHref(current: Record<string, string>, key: string): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(current)) {
    if (k === key || k === "page") continue;
    if (v !== "") sp.set(k, v);
  }
  const s = sp.toString();
  return s ? `?${s}` : "?";
}

export async function ListingControls({
  base,
  current,
}: {
  base: Partial<ListFilters>;
  current: Record<string, string>;
}) {
  const facets = await getFacets(base);
  const attrs = facets.attributes.filter((a) => a.values.length > 0).slice(0, 6);

  // Active filters (everything except sort/page/q-hidden): chips + count.
  const chips: { key: string; label: string }[] = [];
  if (current.brand) {
    const name = facets.brands.find((b) => (b.slug ?? b.id) === current.brand)?.name ?? current.brand;
    chips.push({ key: "brand", label: `Brand: ${name}` });
  }
  if (current.min) chips.push({ key: "min", label: `Min LKR ${current.min}` });
  if (current.max) chips.push({ key: "max", label: `Max LKR ${current.max}` });
  for (const a of attrs) {
    const v = current[`attr_${a.slug}`];
    if (v) chips.push({ key: `attr_${a.slug}`, label: `${a.name}: ${v}` });
  }
  if (current.q) chips.push({ key: "q", label: `“${current.q}”` });

  return (
    <div className="listing-wrap">
      {chips.length > 0 && (
        <div className="active-filters" aria-live="polite">
          {chips.map((chip) => (
            <a key={chip.key} className="chip on" href={removeHref(current, chip.key)} aria-label={`Remove filter ${chip.label}`}>
              {chip.label} ✕
            </a>
          ))}
          <a href="?" className="sold">
            Clear all
          </a>
        </div>
      )}

      <details className="filters box" open>
        <summary className="filters-toggle">
          {chips.length > 0 ? `Filters (${chips.length})` : "Filters"}
        </summary>
        <form method="get" className="filters-form">
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
          {current.q && <input type="hidden" name="q" value={current.q} />}
          <div className="filters-actions">
            <button type="submit" className="btn">
              Apply
            </button>{" "}
            <a href="?" className="sold">
              Clear
            </a>
          </div>
        </form>
      </details>
    </div>
  );
}
