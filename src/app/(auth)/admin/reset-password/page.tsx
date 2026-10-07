"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setError(null);
    const password = String(formData.get("password") ?? "");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setPending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setPending(false);
    if (error) {
      // Generic — do not leak reset-link validity details.
      setError("Could not reset the password. Request a new link.");
      return;
    }
    router.push("/admin/login");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4">
      <h1 className="mb-6 font-display text-2xl font-bold">Set a new password</h1>
      <form action={onSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">New password</span>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="rounded-sm border border-line bg-surface px-3 py-2 text-ink"
          />
        </label>
        {error ? (
          <p role="alert" className="text-sm text-gold-400">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="rounded-sm bg-gold-600 px-4 py-2 font-semibold text-bronze-ink disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save new password"}
        </button>
      </form>
    </main>
  );
}
