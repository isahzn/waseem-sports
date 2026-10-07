"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

export type ConfirmState = { error?: string };

function ConfirmButton({ confirmLabel }: { confirmLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-sm bg-red-800 px-3 py-1.5 text-sm font-semibold text-red-50 disabled:opacity-60"
    >
      {pending ? "Working…" : confirmLabel}
    </button>
  );
}

/**
 * Two-step inline confirm for destructive actions (archive, delete…).
 * No window.confirm — accessible, touch-friendly, works with keyboards.
 * The server action is passed as a prop from a Server Component.
 */
export function ConfirmSubmit({
  action,
  id,
  label,
  confirmLabel,
  tone = "danger",
}: {
  action: (prev: ConfirmState, formData: FormData) => Promise<ConfirmState>;
  id: string;
  label: string;
  confirmLabel: string;
  tone?: "danger" | "neutral";
}) {
  const [armed, setArmed] = useState(false);
  const [state, formAction] = useActionState(action, {});

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => setArmed(true)}
        className={`rounded-sm border px-3 py-1.5 text-sm ${
          tone === "danger" ? "border-red-900 text-red-300" : "border-line"
        }`}
      >
        {label}
      </button>
    );
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <form action={formAction} className="inline-flex items-center gap-2">
        <input type="hidden" name="id" value={id} />
        <ConfirmButton confirmLabel={confirmLabel} />
        <button
          type="button"
          onClick={() => setArmed(false)}
          className="rounded-sm border border-line px-3 py-1.5 text-sm"
        >
          Cancel
        </button>
      </form>
      {state.error && (
        <span role="alert" className="text-xs font-semibold text-red-300">
          {state.error}
        </span>
      )}
    </span>
  );
}
