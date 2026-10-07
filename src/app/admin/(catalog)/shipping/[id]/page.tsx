import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ShippingForm } from "../ShippingForm";
import { updateShippingRule } from "../actions";

export const metadata = { title: "Edit delivery rule — Waseem Sports Admin" };

export default async function EditShippingRulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();

  const db = await createClient();
  const { data: rule } = await db.from("shipping_rules").select("*").eq("id", id).maybeSingle();
  if (!rule) notFound();

  const update = updateShippingRule.bind(null, id);

  return (
    <main>
      <Link href="/admin/shipping" className="text-sm text-muted hover:text-ink">
        ← Back to shipping
      </Link>
      <h1 className="mt-2 font-display text-3xl font-bold">Edit delivery rule</h1>
      <p className="mt-1 text-sm text-muted">
        Changes apply to new orders only — past orders keep the fee they were placed with.
      </p>
      <div className="mt-6">
        <ShippingForm
          action={update}
          submitLabel="Save rule"
          initial={{
            name: rule.name,
            country_codes: rule.country_codes.join(", "),
            regions: rule.regions.join(", "),
            method: rule.method,
            fee: String(rule.fee),
            free_over: rule.free_over === null ? "" : String(rule.free_over),
            est_days_min: rule.est_days_min === null ? "" : String(rule.est_days_min),
            est_days_max: rule.est_days_max === null ? "" : String(rule.est_days_max),
            is_active: rule.is_active,
            sort_order: rule.sort_order,
          }}
        />
      </div>
    </main>
  );
}
