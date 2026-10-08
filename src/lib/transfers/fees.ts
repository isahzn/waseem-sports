import "server-only";

/** Server-side quote. The client NEVER decides fee/total — recomputed here. */
export function quoteTransfer(amount: number, currency: string): { fee: number; total: number } {
  const flat = envNumber("MOCK_BANK_FEE_FLAT", 50);
  const pct = envNumber("MOCK_BANK_FEE_PCT", 0);
  const upper = currency.toUpperCase();
  // Sandbox: USD legs are fee-free in the mock so FX-style tests stay simple.
  const fee = upper === "USD" ? 0 : Math.round((flat + amount * (pct / 100)) * 100) / 100;
  return { fee, total: Math.round((amount + fee) * 100) / 100 };
}

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw === undefined || raw === "" ? Number.NaN : Number(raw);
  return Number.isFinite(n) ? n : fallback;
}
