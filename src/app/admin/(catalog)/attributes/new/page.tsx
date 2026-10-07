import Link from "next/link";
import { requireAdminOrRedirect } from "@/lib/auth/requireAdmin";
import { AttributeForm } from "../AttributeForm";
import { createAttribute } from "../actions";

export const metadata = { title: "New attribute — Waseem Sports Admin" };

export default async function NewAttributePage() {
  await requireAdminOrRedirect();
  return (
    <main>
      <Link href="/admin/attributes" className="text-sm text-muted hover:text-ink">
        ← Back to attributes
      </Link>
      <h1 className="mt-2 font-display text-3xl font-bold">New attribute</h1>
      <div className="mt-6">
        <AttributeForm action={createAttribute} submitLabel="Create attribute" />
      </div>
    </main>
  );
}
