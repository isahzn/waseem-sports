import { z } from "zod";

const publicSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional().or(z.literal("")),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional().or(z.literal("")),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().or(z.literal("")),
  ORDER_TRACKING_SECRET: z.string().optional().or(z.literal("")),
  SCHEDULED_JOBS_SECRET: z.string().optional().or(z.literal("")),
  // Phase 08 sandbox transfers (mock provider only — no real bank).
  PAYMENT_PROVIDER: z.string().optional().or(z.literal("")),
  MOCK_BANK_ENABLED: z.string().optional().or(z.literal("")),
  MOCK_BANK_BALANCE: z.string().optional().or(z.literal("")),
  MOCK_BANK_MAX_AMOUNT: z.string().optional().or(z.literal("")),
  MOCK_BANK_FEE_FLAT: z.string().optional().or(z.literal("")),
  MOCK_BANK_FEE_PCT: z.string().optional().or(z.literal("")),
  MOCK_BANK_CURRENCIES: z.string().optional().or(z.literal("")),
});

export type PublicEnv = z.infer<typeof publicSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

function parseEnv() {
  const pub = publicSchema.parse({
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  });

  // Server-only vars must never be read in the browser. This module is
  // imported by server code; browser code imports only the `publicEnv`
  // shape via NEXT_PUBLIC_* values inlined at build time.
  const server =
    typeof window === "undefined"
      ? serverSchema.parse({
          SUPABASE_SERVICE_ROLE_KEY:
            process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
          ORDER_TRACKING_SECRET: process.env.ORDER_TRACKING_SECRET ?? "",
          SCHEDULED_JOBS_SECRET: process.env.SCHEDULED_JOBS_SECRET ?? "",
          PAYMENT_PROVIDER: process.env.PAYMENT_PROVIDER ?? "",
          MOCK_BANK_ENABLED: process.env.MOCK_BANK_ENABLED ?? "",
          MOCK_BANK_BALANCE: process.env.MOCK_BANK_BALANCE ?? "",
          MOCK_BANK_MAX_AMOUNT: process.env.MOCK_BANK_MAX_AMOUNT ?? "",
          MOCK_BANK_FEE_FLAT: process.env.MOCK_BANK_FEE_FLAT ?? "",
          MOCK_BANK_FEE_PCT: process.env.MOCK_BANK_FEE_PCT ?? "",
          MOCK_BANK_CURRENCIES: process.env.MOCK_BANK_CURRENCIES ?? "",
        })
      : {
          SUPABASE_SERVICE_ROLE_KEY: "",
          ORDER_TRACKING_SECRET: "",
          SCHEDULED_JOBS_SECRET: "",
          PAYMENT_PROVIDER: "",
          MOCK_BANK_ENABLED: "",
          MOCK_BANK_BALANCE: "",
          MOCK_BANK_MAX_AMOUNT: "",
          MOCK_BANK_FEE_FLAT: "",
          MOCK_BANK_FEE_PCT: "",
          MOCK_BANK_CURRENCIES: "",
        };

  return { ...pub, ...server };
}

export const env = parseEnv();

/** True when Supabase is configured (dev project or local CLI). */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
