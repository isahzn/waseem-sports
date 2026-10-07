"use client";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-4 text-center">
      <h1 className="font-display text-3xl font-bold">Something went wrong</h1>
      <p className="mt-2 text-muted">
        Please try again. If it keeps happening, contact the shop.
      </p>
      <button
        onClick={reset}
        className="mt-6 rounded-sm bg-gold-600 px-5 py-2.5 text-sm font-semibold text-bronze-ink"
      >
        Try again
      </button>
    </main>
  );
}
