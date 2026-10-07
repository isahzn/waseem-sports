import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPageWithSections } from "@/lib/cms/pages";
import { SECTION_LABELS, SECTION_TYPES, defaultContent, sectionSummary } from "@/lib/cms/sections";
import { StatusBadge } from "../../_components/ui";
import { ConfirmSubmit } from "../../_components/ConfirmSubmit";
import { SectionFields } from "./SectionFields";
import {
  addSection,
  deleteSection,
  moveSection,
  setPageStatus,
  toggleSection,
  updatePageDetails,
  updateSection,
} from "../actions";

export const metadata = { title: "Page builder — Waseem Sports Admin" };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * The section builder. Everything is a server-rendered form: add a section
 * (one collapsible per type), edit a section, show/hide it, move it up or down,
 * delete it, then publish the page. Order on the page is `sort_order`.
 */
export default async function PageBuilder({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const data = await getPageWithSections(id);
  if (!data) notFound();
  const { page, sections } = data;

  const db = await createClient();
  const { data: products } = await db
    .from("products")
    .select("id,name")
    .eq("status", "published")
    .is("deleted_at", null)
    .order("name", { ascending: true })
    .limit(60);
  const productOptions = (products ?? []).map((p) => ({ id: p.id, name: p.name }));

  const ok = first(sp.ok);
  const error = first(sp.error);
  const isPublished = page.status === "published";
  const previewHref = page.slug === "home" ? "/" : `/pages/${page.slug}`;

  return (
    <main>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted">
            <Link href="/admin/pages" className="underline">
              Pages
            </Link>{" "}
            / {page.slug}
          </p>
          <h1 className="font-display text-3xl font-bold">{page.title}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            <StatusBadge tone={isPublished ? "gold" : "muted"}>{isPublished ? "Published" : "Draft"}</StatusBadge>
            <span>
              {sections.length} section{sections.length === 1 ? "" : "s"} ·{" "}
              {sections.filter((s) => s.is_visible).length} visible
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={previewHref} target="_blank" className="rounded-sm border border-line px-4 py-2 text-sm">
            View page ↗
          </Link>
          <form action={setPageStatus}>
            <input type="hidden" name="page_id" value={page.id} />
            <input type="hidden" name="status" value={isPublished ? "draft" : "published"} />
            <button
              type="submit"
              className={
                isPublished
                  ? "rounded-sm border border-line px-4 py-2 text-sm"
                  : "rounded-sm bg-gold-600 px-4 py-2 text-sm font-semibold text-bronze-ink"
              }
            >
              {isPublished ? "Unpublish" : "Publish page"}
            </button>
          </form>
        </div>
      </div>

      {ok && (
        <p role="status" className="mt-4 rounded-sm border border-pine-800 bg-pine-900 px-3 py-2 text-sm">
          {ok}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4 rounded-sm border border-red-900 bg-red-950 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      {!isPublished && (
        <p className="mt-4 rounded-sm border border-gold-600 bg-card px-3 py-2 text-sm">
          This page is a draft — nothing here is visible to customers until you publish it.
        </p>
      )}

      {/* ---------------------------------------------------------- sections */}
      <h2 className="mt-8 font-display text-xl font-bold">Sections, in page order</h2>
      {sections.length === 0 ? (
        <p className="mt-3 rounded-md border border-dashed border-line bg-card px-4 py-8 text-center text-sm text-muted">
          No sections yet. Add one below — the storefront falls back to the design&apos;s default composition until you
          publish your own.
        </p>
      ) : (
        <ol className="mt-3 flex flex-col gap-3">
          {sections.map((section, index) => (
            <li key={section.id} className="rounded-md border border-line bg-card">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
                <div>
                  <p className="font-semibold">
                    {SECTION_LABELS[section.type].name}
                    <span className="ml-2 text-xs font-normal text-muted">#{index + 1}</span>
                  </p>
                  <p className="text-xs text-muted">{sectionSummary(section.type, section.content)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone={section.is_visible ? "green" : "muted"}>
                    {section.is_visible ? "Visible" : "Hidden"}
                  </StatusBadge>
                  <form action={moveSection}>
                    <input type="hidden" name="section_id" value={section.id} />
                    <input type="hidden" name="direction" value="up" />
                    <button
                      type="submit"
                      disabled={index === 0}
                      aria-label={`Move ${SECTION_LABELS[section.type].name} up`}
                      className="rounded-sm border border-line px-2.5 py-1.5 text-sm disabled:opacity-40"
                    >
                      ↑
                    </button>
                  </form>
                  <form action={moveSection}>
                    <input type="hidden" name="section_id" value={section.id} />
                    <input type="hidden" name="direction" value="down" />
                    <button
                      type="submit"
                      disabled={index === sections.length - 1}
                      aria-label={`Move ${SECTION_LABELS[section.type].name} down`}
                      className="rounded-sm border border-line px-2.5 py-1.5 text-sm disabled:opacity-40"
                    >
                      ↓
                    </button>
                  </form>
                  <form action={toggleSection}>
                    <input type="hidden" name="section_id" value={section.id} />
                    <button type="submit" className="rounded-sm border border-line px-3 py-1.5 text-sm">
                      {section.is_visible ? "Hide" : "Show"}
                    </button>
                  </form>
                  <ConfirmSubmit
                    action={deleteSection}
                    id={section.id}
                    label="Delete"
                    confirmLabel="Confirm delete?"
                  />
                </div>
              </div>

              <details className="px-4 py-3">
                <summary className="cursor-pointer text-sm font-semibold">Edit content</summary>
                <form action={updateSection} className="mt-3">
                  <input type="hidden" name="section_id" value={section.id} />
                  <input type="hidden" name="type" value={section.type} />
                  <SectionFields type={section.type} content={section.content} products={productOptions} />
                  <button
                    type="submit"
                    className="mt-3 rounded-sm bg-gold-600 px-4 py-2 text-sm font-semibold text-bronze-ink"
                  >
                    Save section
                  </button>
                </form>
              </details>
            </li>
          ))}
        </ol>
      )}

      {/* ------------------------------------------------------------- add */}
      <h2 className="mt-8 font-display text-xl font-bold">Add a section</h2>
      <div className="mt-3 flex flex-col gap-2">
        {SECTION_TYPES.map((type) => (
          <details key={type} className="rounded-md border border-line bg-card px-4 py-3">
            <summary className="cursor-pointer text-sm font-semibold">
              {SECTION_LABELS[type].name}
              <span className="ml-2 text-xs font-normal text-muted">{SECTION_LABELS[type].hint}</span>
            </summary>
            <form action={addSection} className="mt-3">
              <input type="hidden" name="page_id" value={page.id} />
              <input type="hidden" name="type" value={type} />
              <SectionFields type={type} content={defaultContent(type) as Record<string, unknown>} products={productOptions} />
              <button
                type="submit"
                className="mt-3 rounded-sm bg-gold-600 px-4 py-2 text-sm font-semibold text-bronze-ink"
              >
                Add {SECTION_LABELS[type].name.toLowerCase()}
              </button>
            </form>
          </details>
        ))}
      </div>

      {/* ---------------------------------------------------------- details */}
      <h2 className="mt-8 font-display text-xl font-bold">Page details</h2>
      <form action={updatePageDetails} className="mt-3 rounded-md border border-line bg-card p-4">
        <input type="hidden" name="page_id" value={page.id} />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">Title</span>
            <input
              name="title"
              defaultValue={page.title}
              maxLength={200}
              className="rounded-sm border border-line bg-surface px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">URL</span>
            <input
              value={page.slug === "home" ? "/ (the landing page)" : `/pages/${page.slug}`}
              readOnly
              className="rounded-sm border border-line bg-surface px-3 py-2 text-muted"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">SEO title</span>
            <input
              name="seo_title"
              defaultValue={page.seo_title ?? ""}
              maxLength={200}
              className="rounded-sm border border-line bg-surface px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">SEO description</span>
            <input
              name="seo_description"
              defaultValue={page.seo_description ?? ""}
              maxLength={500}
              className="rounded-sm border border-line bg-surface px-3 py-2"
            />
          </label>
        </div>
        <button type="submit" className="mt-3 rounded-sm border border-line px-4 py-2 text-sm font-semibold">
          Save details
        </button>
      </form>
    </main>
  );
}
