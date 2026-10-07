import { notFound } from "next/navigation";
import { getPage } from "@/lib/storefront/catalog";

/** Static-ish pages from the CMS (Phase 07 wires the section builder). */
export default async function StaticPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page) notFound();

  return (
    <main>
      <h1 style={{ fontSize: "40px" }}>{page.title}</h1>
      <div className="box mt-3">
        <p className="whitespace-pre-line">{page.body}</p>
      </div>
    </main>
  );
}
