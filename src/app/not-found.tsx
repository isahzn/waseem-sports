import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-4 text-center">
      <h1 className="font-display text-5xl font-bold">404</h1>
      <p className="mt-2 text-muted">This page could not be found.</p>
      <Link
        href="/"
        className="mt-6 rounded-sm bg-gold-600 px-5 py-2.5 text-sm font-semibold text-bronze-ink"
      >
        Back home
      </Link>
    </main>
  );
}
