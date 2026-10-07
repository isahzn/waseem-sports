"use client";
import Link from "next/link";
import { useActionState } from "react";
import { loginAction, passcodeAction } from "./actions";

const inputClass = "rounded-sm border border-line bg-surface px-3 py-2 text-ink";

/**
 * Two ways in, decided by the server (`page.tsx`):
 * - `passcode`: the shared admin password — one field (D42);
 * - `account`: the Supabase email + password login, unchanged.
 */
export function LoginForm({ mode }: { mode: "passcode" | "account" }) {
  const [state, action, pending] = useActionState(
    mode === "passcode" ? passcodeAction : loginAction,
    {},
  );

  if (mode === "passcode") {
    return (
      <form action={action} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">Admin password</span>
          <input
            name="passcode"
            type="password"
            required
            autoFocus
            autoComplete="current-password"
            className={inputClass}
          />
        </label>
        {state.error ? (
          <p role="alert" className="text-sm text-gold-400">
            {state.error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="rounded-sm bg-gold-600 px-4 py-2 font-semibold text-bronze-ink disabled:opacity-60"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
        <Link href="/" className="text-sm text-muted underline underline-offset-2">
          ← Back to the store
        </Link>
      </form>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-semibold">Email</span>
        <input name="email" type="email" required autoComplete="username" className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-semibold">Password</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className={inputClass}
        />
      </label>
      {state.error ? (
        <p role="alert" className="text-sm text-gold-400">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-sm bg-gold-600 px-4 py-2 font-semibold text-bronze-ink disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <Link
        href="/admin/forgot-password"
        className="text-sm text-muted underline underline-offset-2"
      >
        Forgot password?
      </Link>
    </form>
  );
}
