import { getLandingSections } from "@/lib/cms/pages";
import { SectionList } from "./_components/SectionList";

export const metadata = {
  title: "Waseem Sports — Sports Gear in Sri Lanka",
  description: "Quality sports gear in Colombo, Sri Lanka. Cash on delivery.",
};

/**
 * Home: the owner's landing composition, rendered from the CMS in the order set
 * in /admin/pages. When no landing page has been published the design's default
 * composition is used, so this route is never blank.
 */
export default async function HomePage() {
  const sections = await getLandingSections();

  return (
    <main>
      <SectionList sections={sections} />
    </main>
  );
}
