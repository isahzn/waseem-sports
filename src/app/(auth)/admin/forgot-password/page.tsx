import Link from "next/link";
import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, clientIp } from "@/lib/security/ratelimit";
import { logger } from "@/lib/security/logger";

export const metadata = { title: "Forgot password — Waseem Sports" };

const schema = z.object({ email: z.string().email() });

async function requestReset(formData: FormData) {
  "use server";
  const parsed = schema.safeParse({ email: formData.get("email") });
  const h = await headers();
  const ip = clientIp(h);
  const rl = await checkRateLimit(`reset:${ip}`, 5);
  if (!rl.allowed) {
    logger.warn("password-reset rate-limited", { ip });
    // Always show the same message — never reveal account existence.
    return;
  }
  if (!parsed.success) return;
  const supabase = await createClient();
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email,
    { redirectTo: `${siteUrl}/admin/reset-password` },
  );
  if (error) logger.warn("password-reset request failed", { ip });
}

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4">
      <h1 className="mb-2 font-display text-2xl font-bold">Forgot password</h1>
      <p className="mb-6 text-sm text-muted">
        Enter your admin email. If an account exists, a reset link will be
        sent.
      </p>
      <form action={requestReset} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">Email</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="username"
            className="rounded-sm border border-line bg-surface px-3 py-2 text-ink"
          />
        </label>
        <button
          type="submit"
          className="rounded-sm bg-gold-600 px-4 py-2 font-semibold text-bronze-ink"
        >
          Send reset link
        </button>
        <Link
          href="/admin/login"
          className="text-sm text-muted underline underline-offset-2"
        >
          Back to sign in
        </Link>
      </form>
    </main>
  );
}
