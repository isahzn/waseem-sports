import Link from "next/link";
import type { ReactNode } from "react";

/** Small status pill. Tones map to the brand palette (no new colors). */
export function StatusBadge({
  tone,
  children,
}: {
  tone: "green" | "gold" | "muted" | "red";
  children: ReactNode;
}) {
  const tones: Record<string, string> = {
    green: "border-pine-800 bg-pine-900 text-ink",
    gold: "border-gold-600 bg-gold-600 text-bronze-ink",
    muted: "border-line bg-card text-muted",
    red: "border-red-900 bg-red-950 text-red-200",
  };
  return (
    <span
      className={`inline-block rounded-sm border px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function visibilityTone(isVisible: boolean): "green" | "muted" {
  return isVisible ? "green" : "muted";
}

export function productStatusTone(status: string): "gold" | "muted" | "red" {
  if (status === "published") return "gold";
  if (status === "archived") return "red";
  return "muted";
}

/** Empty-table state with an optional primary action. */
export function EmptyState({
  title,
  hint,
  actionHref,
  actionLabel,
}: {
  title: string;
  hint: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="rounded-md border border-dashed border-line bg-card px-6 py-12 text-center">
      <p className="font-display text-xl font-bold">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">{hint}</p>
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className="mt-4 inline-block rounded-sm bg-gold-600 px-4 py-2 text-sm font-semibold text-bronze-ink"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}

/** GET search/filter bar — plain form, no client JS needed. */
export function SearchBar({
  q,
  extra,
}: {
  q?: string;
  extra?: ReactNode;
}) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-3">
      <label className="flex min-w-52 flex-1 flex-col gap-1 text-sm">
        <span className="text-muted">Search</span>
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Name or slug…"
          maxLength={100}
          className="rounded-sm border border-line bg-surface px-3 py-2"
        />
      </label>
      {extra}
      <button
        type="submit"
        className="rounded-sm border border-line px-4 py-2 text-sm font-semibold"
      >
        Apply
      </button>
    </form>
  );
}

export function FilterSelect({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value?: string;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-muted">{label}</span>
      <select
        name={name}
        defaultValue={value ?? options[0]?.value ?? ""}
        className="rounded-sm border border-line bg-surface px-3 py-2"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Page-number links preserving the current query string. */
export function Pagination({
  page,
  perPage,
  total,
  basePath,
  params,
}: {
  page: number;
  perPage: number;
  total: number;
  basePath: string;
  params: Record<string, string | undefined>;
}) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  if (pages <= 1) return null;

  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "" && k !== "page") sp.set(k, v);
    }
    sp.set("page", String(p));
    return `${basePath}?${sp.toString()}`;
  };

  const window: number[] = [];
  for (let p = Math.max(1, page - 2); p <= Math.min(pages, page + 2); p++) window.push(p);

  return (
    <nav aria-label="Pagination" className="mt-6 flex items-center gap-2 text-sm">
      {page > 1 && (
        <Link href={href(page - 1)} className="rounded-sm border border-line px-3 py-1.5">
          ← Prev
        </Link>
      )}
      {window[0] !== undefined && window[0] > 1 && (
        <>
          <Link href={href(1)} className="rounded-sm border border-line px-3 py-1.5">
            1
          </Link>
          {window[0] > 2 && <span className="text-muted">…</span>}
        </>
      )}
      {window.map((p) => (
        <Link
          key={p}
          href={href(p)}
          aria-current={p === page ? "page" : undefined}
          className={`rounded-sm border px-3 py-1.5 ${
            p === page ? "border-gold-600 bg-gold-600 font-semibold text-bronze-ink" : "border-line"
          }`}
        >
          {p}
        </Link>
      ))}
      {window[window.length - 1] !== undefined && window[window.length - 1]! < pages && (
        <>
          {window[window.length - 1]! < pages - 1 && <span className="text-muted">…</span>}
          <Link href={href(pages)} className="rounded-sm border border-line px-3 py-1.5">
            {pages}
          </Link>
        </>
      )}
      {page < pages && (
        <Link href={href(page + 1)} className="rounded-sm border border-line px-3 py-1.5">
          Next →
        </Link>
      )}
      <span className="ml-2 text-muted">
        {total} item{total === 1 ? "" : "s"}
      </span>
    </nav>
  );
}

/** Field wrapper with label, input slot and error slot for admin forms. */
export function Field({
  label,
  hint,
  errors,
  children,
}: {
  label: string;
  hint?: string;
  errors?: string[];
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-semibold">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
      {errors?.map((e) => (
        <span key={e} role="alert" className="text-xs font-semibold text-red-300">
          {e}
        </span>
      ))}
    </label>
  );
}

/** Generic (non-field) form error banner. */
export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-sm border border-red-900 bg-red-950 px-3 py-2 text-sm text-red-200">
      {message}
    </p>
  );
}
