"use client";

/** Print button for the packing slip (Fixes §3.6). Client-only: window.print. */
export function SlipPrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-sm bg-gold-600 px-4 py-2 text-sm font-semibold text-bronze-ink print:hidden"
    >
      Print
    </button>
  );
}
