import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { adminDb, requireAdminOrRedirect } from "@/lib/auth/requireAdmin";
import { searchImages } from "@/lib/imagesearch/service";
import { EmptyState, FormError, StatusBadge } from "../../../_components/ui";
import { importCandidateAction } from "./actions";

export const metadata = { title: "Recommended images — Waseem Sports Admin" };
export const dynamic = "force-dynamic";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const RIGHTS_WARNING =
  "Finding an image does not grant commercial usage rights. Import only images the shop is allowed to use — manufacturer or authorized-distributor photos, or images with a confirmed licence — and confirm the licence before publishing the product.";

/**
 * Recommended images (Phase 09). Opening this page IS the search intent, so
 * the provider is only ever called from here — viewing the product never
 * spends quota. With no provider (D6 open) the page shows the disabled
 * state plus the queries it would have sent, and manual upload keeps working.
 */
export default async function ImageSearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireAdminOrRedirect();
  const { id } = await params;
  const sp = await searchParams;
  const error = first(sp.error);

  const db = adminDb();
  const { data: product } = await db.from("products").select("id,name").eq("id", id).is("deleted_at", null).maybeSingle();
  if (!product) notFound();

  const h = await headers();
  const { outcome, error: searchError } = await searchImages({ product_id: id }, { headers: h, actor: admin.userId });
  const message = error ?? searchError?.message;

  return (
    <main className="flex max-w-3xl flex-col gap-6">
      <div>
        <Link href={`/admin/products/${id}`} className="text-sm text-muted hover:text-ink">
          ← Back to {product.name}
        </Link>
        <h1 className="mt-2 font-display text-3xl font-bold">Recommended images</h1>
        <p className="mt-1 text-sm text-muted">
          Deterministic suggestions for <strong>{product.name}</strong> — no AI, no cost until a provider
          is configured. Manual upload on the product page always works.
        </p>
      </div>
      <FormError message={message} />

      {!outcome || !outcome.configured ? (
        <div className="rounded-md border border-dashed border-line bg-card px-6 py-8">
          <p className="font-display text-xl font-bold">
            Image search is not configured <StatusBadge tone="muted">Not configured</StatusBadge>
          </p>
          <p className="mt-2 max-w-xl text-sm text-muted">
            {outcome?.reason ?? "No image-search provider is set up yet."} Nothing was spent and nothing
            broke — upload photos manually on the product page.
          </p>
          {outcome && outcome.queries.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-semibold">Queries it would send once a provider exists:</p>
              <ul className="mt-2 flex flex-col gap-1 text-sm text-muted">
                {outcome.queries.map((q) => (
                  <li key={q} className="rounded-sm border border-line bg-surface px-3 py-1.5">“{q}”</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : outcome.candidates.length === 0 ? (
        <EmptyState
          title="No recommendations"
          hint="The provider returned nothing usable for these queries. Try manual upload, or refine the product name and brand."
        />
      ) : (
        <div className="flex flex-col gap-4">
          <p role="status" className="text-sm text-muted">
            {outcome.cached ? "From cache — no quota spent." : "Fresh results — one quota unit spent."} Pick one to
            preview, then import it.
          </p>
          {outcome.candidates.map((c) => (
            <article key={c.imageUrl} className="rounded-md border border-line bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">{c.title ?? c.sourceDomain}</p>
                {c.preferred ? <StatusBadge tone="green">Allowlisted source</StatusBadge> : <StatusBadge tone="muted">{c.sourceDomain}</StatusBadge>}
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.imageUrl} alt={c.title ?? `Candidate from ${c.sourceDomain}`} className="mt-3 max-h-64 rounded-sm border border-line object-contain" loading="lazy" />
              <p className="mt-2 text-xs text-muted">
                {c.width && c.height ? `${c.width}×${c.height} · ` : ""}Source page: {c.pageUrl}
              </p>
              <div className="mt-3 rounded-sm border border-gold-600 bg-surface px-3 py-2 text-xs">
                <strong>Rights warning:</strong> {RIGHTS_WARNING}
              </div>
              <form action={importCandidateAction} className="mt-3 flex flex-wrap items-center gap-3">
                <input type="hidden" name="product_id" value={id} />
                <input type="hidden" name="image_url" value={c.imageUrl} />
                <input type="hidden" name="page_url" value={c.pageUrl} />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="acknowledge_rights" required /> I confirm the licence for this image
                </label>
                <button type="submit" className="rounded-sm bg-gold-600 px-4 py-2 text-sm font-semibold text-bronze-ink">
                  Import this image
                </button>
              </form>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
