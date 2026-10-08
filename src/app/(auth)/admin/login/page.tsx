import { passcodeGateEnabled } from "@/lib/auth/passcode";

/**
 * Per-request, never statically prerendered (PHASE 10): the passcode/account
 * mode comes from `ADMIN_PASSCODE`, and an operator must be able to flip it
 * with a restart — not a rebuild. Without this the mode bakes in at build
 * time and unsetting the variable would silently keep the old form.
 */
export const dynamic = "force-dynamic";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Admin sign in — Waseem Sports" };

export default function AdminLoginPage() {
  // The shared-password gate (D42) wins when it is configured; without
  // `ADMIN_PASSCODE` this stays the account login it has always been.
  const mode = passcodeGateEnabled() ? "passcode" : "account";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4">
      <p className="font-display text-2xl font-bold">
        Waseem <span className="text-gold-400">Sports</span>
      </p>
      <h1 className="mb-6 mt-2 text-lg text-muted">Admin sign in</h1>
      <LoginForm mode={mode} />
    </main>
  );
}
