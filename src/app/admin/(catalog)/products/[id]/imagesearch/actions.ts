"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { importCandidate } from "@/lib/imagesearch/service";
import { logger } from "@/lib/security/logger";

async function adminOrRedirect() {
  try {
    return await requireAdmin();
  } catch {
    redirect("/admin/login");
  }
}

/** Import one owner-picked candidate (rights checkbox is mandatory). */
export async function importCandidateAction(formData: FormData): Promise<void> {
  const admin = await adminOrRedirect();
  const h = await headers();
  const productId = String(formData.get("product_id") ?? "");
  const { id, error } = await importCandidate(
    {
      product_id: productId,
      image_url: String(formData.get("image_url") ?? ""),
      page_url: String(formData.get("page_url") ?? ""),
      acknowledge_rights: formData.get("acknowledge_rights") === "on" ? true : "off",
    },
    { headers: h, actor: admin.userId },
  );
  if (error || !id) {
    logger.error("admin image import failed");
    redirect(`/admin/products/${productId}/imagesearch?error=${encodeURIComponent(error?.message ?? "Could not import that image.")}`);
  }
  revalidatePath(`/admin/products/${productId}`);
  redirect(`/admin/products/${productId}?ok=${encodeURIComponent("Image imported — check the licence before publishing.")}`);
}
