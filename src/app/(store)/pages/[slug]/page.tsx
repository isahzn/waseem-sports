import { notFound } from "next/navigation";
import { getPage } from "@/lib/storefront/catalog";

/** Static-ish pages from the CMS (Phase 07 wires the section builder). */
export default async function StaticPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page) notFound();

  return (
    <main className="mx-auto max-w-3xl">
      <h1 className="font-display text-4xl font-bold">{page.title}</h1>
      <p className="mt-4 whitespace-pre-line text-muted">{page.body}</p>
    </main>
  );
}
