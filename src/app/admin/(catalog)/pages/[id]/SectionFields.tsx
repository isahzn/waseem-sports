import { toLocalInput, type SectionType } from "@/lib/cms/sections";

export type ProductOption = { id: string; name: string };

const inputClass =
  "w-full rounded-sm border border-line bg-surface px-3 py-2 text-sm";

/**
 * Field sets for one section type. Plain inputs (no client JS) named exactly
 * as `contentFromForm` reads them, so the whole builder works as
 * server-rendered forms — the same pattern as the rest of the admin.
 */
export function SectionFields({
  type,
  content,
  products,
}: {
  type: SectionType;
  content: Record<string, unknown>;
  products: ProductOption[];
}) {
  switch (type) {
    case "hero": {
      const slides = Array.isArray(content.slides) ? (content.slides as Record<string, string>[]) : [];
      // Always leave one blank slide slot so the owner can add a slide.
      const slots = Math.min(6, Math.max(1, slides.length + 1));
      return (
        <>
          <input type="hidden" name="slide_count" value={slots} />
          <p className="text-xs text-muted">
            A slide needs a title. Clear a title to remove that slide. Background is a plain CSS gradient.
          </p>
          {Array.from({ length: slots }).map((_, i) => {
            const slide = slides[i] ?? {};
            return (
              <fieldset key={i} className="mt-3 rounded-sm border border-line p-3">
                <legend className="px-1 text-xs font-semibold text-muted">Slide {i + 1}</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-semibold">Title</span>
                    <input name={`slide_${i}_title`} defaultValue={slide.title ?? ""} maxLength={80} className={inputClass} />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-semibold">Button link</span>
                    <input name={`slide_${i}_href`} defaultValue={slide.href ?? "/shop"} maxLength={300} className={inputClass} />
                  </label>
                </div>
                <label className="mt-2 flex flex-col gap-1 text-sm">
                  <span className="font-semibold">Text</span>
                  <input name={`slide_${i}_text`} defaultValue={slide.text ?? ""} maxLength={240} className={inputClass} />
                </label>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-semibold">Background</span>
                    <input
                      name={`slide_${i}_background`}
                      defaultValue={slide.background ?? "linear-gradient(120deg,#062418,#0f4a33)"}
                      maxLength={200}
                      className={inputClass}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-semibold">Photo path</span>
                    <input
                      name={`slide_${i}_image_path`}
                      defaultValue={slide.image_path ?? ""}
                      maxLength={500}
                      placeholder="products/demo-01.jpg"
                      className={inputClass}
                    />
                  </label>
                </div>
              </fieldset>
            );
          })}
        </>
      );
    }

    case "sport_tiles": {
      const c = content as { title?: string; limit?: number };
      return (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold">Heading</span>
              <input name="title" defaultValue={c.title ?? "Shop by sport"} maxLength={80} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold">How many sports</span>
              <input type="number" name="limit" min={1} max={12} defaultValue={c.limit ?? 12} className={inputClass} />
            </label>
          </div>
          <p className="mt-2 text-xs text-muted">
            The tiles themselves come from the Sports list — add a sport, upload its photo, set its
            order, or untick &ldquo;Show in Shop by sport&rdquo; there. Hiding this section removes the
            block from the homepage without touching any sport.
          </p>
        </>
      );
    }

    case "category_tiles": {
      const c = content as { title?: string; limit?: number };
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">Heading (optional)</span>
            <input name="title" defaultValue={c.title ?? ""} maxLength={80} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">How many categories</span>
            <input type="number" name="limit" min={1} max={24} defaultValue={c.limit ?? 12} className={inputClass} />
          </label>
        </div>
      );
    }

    case "product_grid": {
      const c = content as {
        title?: string;
        source?: string;
        limit?: number;
        link_label?: string;
        link_href?: string;
        product_ids?: string[];
      };
      const picked = new Set(c.product_ids ?? []);
      return (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold">Heading</span>
              <input name="title" defaultValue={c.title ?? ""} maxLength={80} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold">How many products</span>
              <input type="number" name="limit" min={1} max={24} defaultValue={c.limit ?? 5} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold">Product rule</span>
              <select name="source" defaultValue={c.source ?? "newest"} className={inputClass}>
                <option value="featured">Featured products</option>
                <option value="newest">Newest first</option>
                <option value="price_asc">Price: low to high</option>
                <option value="price_desc">Price: high to low</option>
                <option value="name">Name A–Z</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold">Link label (optional)</span>
              <input name="link_label" defaultValue={c.link_label ?? ""} maxLength={40} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold">Link address</span>
              <input name="link_href" defaultValue={c.link_href ?? ""} maxLength={300} placeholder="/shop" className={inputClass} />
            </label>
          </div>
          <fieldset className="mt-3 rounded-sm border border-line p-3">
            <legend className="px-1 text-xs font-semibold text-muted">Hand-pick products (overrides the rule)</legend>
            {products.length === 0 ? (
              <p className="text-sm text-muted">No products yet — add some under Products first.</p>
            ) : (
              <div className="max-h-56 overflow-y-auto">
                {products.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 py-1 text-sm">
                    <input type="checkbox" name="product_ids" value={p.id} defaultChecked={picked.has(p.id)} />
                    <span>{p.name}</span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>
        </>
      );
    }

    case "promo_strip": {
      const items = Array.isArray(content.items) ? (content.items as string[]) : [];
      return (
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">Promises — one per line</span>
          <textarea name="items" rows={4} defaultValue={items.join("\n")} className={inputClass} />
          <span className="text-xs text-muted">
            Only promise what the shop actually does — delivery fees shown here should match your shipping rules.
          </span>
        </label>
      );
    }

    case "promo_countdown": {
      const c = content as Record<string, string>;
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">Heading</span>
            <input name="title" defaultValue={c.title ?? ""} maxLength={80} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">Ends at</span>
            <input type="datetime-local" name="ends_at" defaultValue={toLocalInput(c.ends_at ?? "")} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="font-semibold">Text</span>
            <input name="text" defaultValue={c.text ?? ""} maxLength={240} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">Button label</span>
            <input name="label" defaultValue={c.label ?? "Shop the deal"} maxLength={40} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">Button link</span>
            <input name="href" defaultValue={c.href ?? "/shop"} maxLength={300} className={inputClass} />
          </label>
        </div>
      );
    }

    case "rich_text": {
      const c = content as Record<string, string>;
      return (
        <>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">Heading (optional)</span>
            <input name="title" defaultValue={c.title ?? ""} maxLength={120} className={inputClass} />
          </label>
          <label className="mt-2 flex flex-col gap-1 text-sm">
            <span className="font-semibold">Text</span>
            <textarea name="body" rows={6} defaultValue={c.body ?? ""} className={inputClass} />
          </label>
        </>
      );
    }

    default:
      return null;
  }
}
