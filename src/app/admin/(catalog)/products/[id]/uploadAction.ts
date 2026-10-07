"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { checkRateLimit, clientIp } from "@/lib/security/ratelimit";
import type { UploadState } from "./ImagesManager";

/**
 * Bridge between the ImagesManager form and POST /api/admin/uploads.
 * The route does the real hardening (magic bytes, sharp, storage); this
 * action forwards the multipart body with the admin session cookies and
 * revalidates the detail page on success.
 */
export async function uploadProductImage(
  _prev: UploadState,
  formData: FormData,
): Promise<UploadState> {
  try {
    await requireAdmin();
  } catch {
    return { error: "Sign in required." };
  }

  const productId = String(formData.get("product_id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(productId)) return { error: "Invalid product." };

  const h = await headers();
  const ip = clientIp(h);
  const { allowed } = await checkRateLimit(`upload:${ip}`, 30);
  if (!allowed) return { error: "Too many uploads. Try again later." };

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const cookie = h.get("cookie") ?? "";
  let res: Response;
  try {
    res = await fetch(`${base}/api/admin/uploads`, {
      method: "POST",
      headers: { cookie },
      body: formData,
    });
  } catch {
    return { error: "Upload failed. Try again." };
  }

  if (!res.ok) {
    let message = "Upload failed. Try again.";
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* keep generic */
    }
    return { error: message };
  }

  revalidatePath(`/admin/products/${productId}`);
  return { ok: true };
}
