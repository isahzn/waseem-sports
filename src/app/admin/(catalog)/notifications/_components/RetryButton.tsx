"use client";

import { useActionState } from "react";
import { FormError } from "../../_components/ui";
import { retryAllFailed, retryNotification } from "../actions";

/** Resend or retry one notification row. */
export function RetryButton({ id, label = "Retry" }: { id: string; label?: string }) {
  const [state, formAction, pending] = useActionState(retryNotification, {});
  return (
    <form action={formAction} className="inline-flex flex-col gap-1">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-sm border border-line px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
      >
        {pending ? "Sending…" : label}
      </button>
      <FormError message={state.error} />
      {state.ok && <span className="text-xs text-pine-800">{state.message ?? "Done."}</span>}
    </form>
  );
}

/** Retry every failed notification (capped, rate-limited, audited). */
export function RetryAllButton({ disabled }: { disabled?: boolean }) {
  const [state, formAction, pending] = useActionState(retryAllFailed, {});
  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <button
        type="submit"
        disabled={pending || disabled}
        className="rounded-sm bg-gold-600 px-4 py-2 text-sm font-semibold text-bronze-ink disabled:opacity-60"
      >
        {pending ? "Retrying…" : "Retry all failed"}
      </button>
      <FormError message={state.error} />
      {state.ok && <span className="text-xs text-pine-800">{state.message ?? "Done."}</span>}
    </form>
  );
}
