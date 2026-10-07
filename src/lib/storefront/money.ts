/**
 * LKR formatting shared by every storefront surface, matching the canonical
 * design's `f(n)` — "LKR 1,450". Whole amounts stay whole (as the design
 * shows them); anything with cents keeps two decimals so totals never round
 * away money.
 */
export function formatLKR(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === "") return "—";
  const v = typeof n === "string" ? Number(n) : n;
  if (!Number.isFinite(v)) return "—";
  const whole = Math.round(v * 100) % 100 === 0;
  return `LKR ${v.toLocaleString("en-US", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}
