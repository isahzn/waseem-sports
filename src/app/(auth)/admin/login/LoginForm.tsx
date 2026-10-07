"use client";
import Link from "next/link";
import { useActionState } from "react";
import { loginAction } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, {});
  return (
    <form action={action} className="flex flex-col gap-4">
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
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-semibold">Password</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="rounded-sm border border-line bg-surface px-3 py-2 text-ink"
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
