"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { setSetting } from "@/lib/settings";
import { writeAudit } from "@/lib/catalog/audit";

async function adminOrRedirect() {
  try {
    return await requireAdmin();
  } catch {
    redirect("/admin/login");
  }
}

/** Save the owner-editable manufacturer/distributor domain allowlist. */
export async function saveAllowlist(formData: FormData): Promise<void> {
  const admin = await adminOrRedirect();
  const raw = String(formData.get("allowlist") ?? "");
  const domains = [...new Set(
    raw.split(/[\s,;]+/).map((d) => d.trim().toLowerCase().replace(/^\*\./, "")).filter((d) => /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d)),
  )].slice(0, 100);

  const { error } = await setSetting("image_search.domain_allowlist", domains, admin.userId);
  if (error) redirect(`/admin/settings/image-search?error=${encodeURIComponent("Could not save the allowlist.")}`);
  await writeAudit({ actor: admin.userId, action: "settings.image_search.allowlist", entity: "store_settings", entityId: "image_search.domain_allowlist", meta: { count: domains.length } });
  revalidatePath("/admin/settings/image-search");
  redirect(`/admin/settings/image-search?ok=${encodeURIComponent(`Allowlist saved — ${domains.length} domain${domains.length === 1 ? "" : "s"}.`)}`);
}
