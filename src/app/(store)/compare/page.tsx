import { CompareView } from "./CompareView";

export const metadata = {
  title: "Compare products — Waseem Sports",
  description: "Compare saved products side by side: price, stock, brand and options.",
  robots: { index: false, follow: true },
};

/** Compare: the selection is a device-local list, so the table renders client-side. */
export default function ComparePage() {
  return (
    <main>
      <h1 style={{ fontSize: "40px" }}>Compare</h1>
      <CompareView />
    </main>
  );
}
