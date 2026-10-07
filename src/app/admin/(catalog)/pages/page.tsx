import Link from "next/link";
import { requireAdminOrRedirect } from "@/lib/auth/requireAdmin";
import { listPages, LANDING_SLUG } from "@/lib/cms/pages";
import { StatusBadge } from "../_components/ui";
import { createPage, ensureLandingPage } from "./actions";

export const metadata = { title: "Pages — Waseem Sports Admin" };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Content hub: every CMS page (the landing page, the journal posts under
 * `blog/…`, and any extra page). The landing row is the one the owner will use
 * most, so it is called out when it does not exist yet.
 */
export default async function PagesAdmin({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminOrRedirect();
  const sp = await searchParams;
  const pages = await listPages();
  const landing = pages.find((p) => p.slug === LANDING_SLUG);
  const error = first(sp.error);

  return (
    <main>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Pages</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            The landing page is built from sections you add, reorder and edit here — heroes, category chips, product
            grids, trust rows, countdown deals and text. Journal posts live under this list too, as pages whose URL
            starts with <code className="text-ink">blog/</code>.
          </p>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-sm border border-red-900 bg-red-950 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      {!landing && (
        <div className="mt-6 rounded-md border border-gold-600 bg-card p-4">
          <h2 className="font-display text-xl font-bold">Set up the landing page</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            There is no landing page yet, so the storefront is showing the design&apos;s default composition. Create it
            and you get that same layout, editable section by section.
          </p>
          <form action={ensureLandingPage} className="mt-3">
            <button type="submit" className="rounded-sm bg-gold-600 px-4 py-2 text-sm font-semibold text-bronze-ink">
              Create the landing page
            </button>
          </form>
        </div>
      )}

      <h2 className="mt-8 font-display text-xl font-bold">All pages</h2>
      <div className="mt-3 overflow-x-auto rounded-md border border-line">
        <table className="w-full min-w-160 text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-card text-muted">
              <th className="px-4 py-2 font-semibold">Page</th>
              <th className="px-4 py-2 font-semibold">URL</th>
              <th className="px-4 py-2 font-semibold">Status</th>
              <th className="px-4 py-2 font-semibold">Sections</th>
              <th className="px-4 py-2 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pages.map((page) => (
              <tr key={page.id} className="border-b border-line last:border-0">
                <td className="px-4 py-2 font-semibold">{page.title}</td>
                <td className="px-4 py-2 text-muted">
                  {page.slug === LANDING_SLUG ? "/ (landing)" : `/pages/${page.slug}`}
                </td>
                <td className="px-4 py-2">
                  <StatusBadge tone={page.status === "published" ? "gold" : "muted"}>{page.status}</StatusBadge>
                </td>
                <td className="px-4 py-2 text-muted">{page.section_count}</td>
                <td className="px-4 py-2">
                  <span className="flex justify-end gap-2">
                    <Link href={`/admin/pages/${page.id}`} className="rounded-sm border border-line px-3 py-1.5 text-sm">
                      Build sections
                    </Link>
                  </span>
                </td>
              </tr>
            ))}
            {pages.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted">
                  No pages yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="mt-8 font-display text-xl font-bold">New page</h2>
      <p className="mt-1 text-sm text-muted">
        Use <code className="text-ink">blog/your-post</code> as the URL to create a journal post.
      </p>
      <form action={createPage} className="mt-3 flex flex-wrap items-end gap-3 rounded-md border border-line bg-card p-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">Title</span>
          <input
            name="title"
            required
            maxLength={200}
            className="rounded-sm border border-line bg-surface px-3 py-2"
            placeholder="Delivery and returns"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">URL slug</span>
          <input
            name="slug"
            required
            maxLength={120}
            className="rounded-sm border border-line bg-surface px-3 py-2"
            placeholder="delivery-and-returns"
          />
        </label>
        <button type="submit" className="rounded-sm border border-line px-4 py-2 text-sm font-semibold">
          Create page
        </button>
      </form>
    </main>
  );
}
