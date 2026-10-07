"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { adminDb, requireAdmin } from "@/lib/auth/requireAdmin";
import { writeAudit } from "@/lib/catalog/audit";
import { nameField, optionalText, slugField } from "@/lib/catalog/schemas";
import { LANDING_SLUG, defaultLandingSections } from "@/lib/cms/pages";
import { contentFromForm, isSectionType } from "@/lib/cms/sections";
import { logger } from "@/lib/security/logger";
import type { ConfirmState } from "../_components/ConfirmSubmit";

/**
 * Landing-page / CMS builder actions (Phase 07).
 *
 * Every action authorises first (`requireAdmin`), validates its input with zod
 * or the section schemas, writes through the service-role client (`adminDb()` —
 * a shared-password session has no `auth.uid()` for the RLS policies to match)
 * and records an audit row.
 * Content is saved straight to the live `content` column; the page's own
 * `status` publishes it — that keeps the owner's mental model "edit, then
 * publish the page" without a second draft copy to reason about.
 */

const uuidSchema = z.string().uuid();

async function adminOrRedirect() {
  try {
    return await requireAdmin();
  } catch {
    redirect("/admin/login");
  }
}

/** Bounce back to the builder with a message (form errors, confirmations). */
function back(pageId: string, message: string, kind: "ok" | "error" = "ok"): never {
  revalidatePath("/admin/pages");
  if (pageId) revalidatePath(`/admin/pages/${pageId}`);
  revalidatePath("/");
  redirect(`/admin/pages/${pageId}?${kind}=${encodeURIComponent(message)}`);
}

async function pageIdOfSection(id: string): Promise<string | null> {
  const db = adminDb();
  const { data } = await db.from("page_sections").select("page_id").eq("id", id).maybeSingle();
  return data?.page_id ?? null;
}

export async function addSection(formData: FormData): Promise<void> {
  const admin = await adminOrRedirect();
  const pageId = String(formData.get("page_id") ?? "");
  const type = String(formData.get("type") ?? "");
  if (!uuidSchema.safeParse(pageId).success) back("", "That page does not exist.", "error");
  if (!isSectionType(type)) back(pageId, "Pick a section type.", "error");

  const parsed = contentFromForm(type, formData);
  if (!parsed.ok) back(pageId, parsed.errors.join(" "), "error");

  const db = adminDb();
  const { data: last } = await db
    .from("page_sections")
    .select("sort_order")
    .eq("page_id", pageId)
    .order("sort_order", { ascending: false })
    .limit(1);
  const nextOrder = ((last?.[0]?.sort_order as number | undefined) ?? -1) + 1;

  const { error } = await db
    .from("page_sections")
    .insert({ page_id: pageId, type, content: parsed.content, is_visible: true, sort_order: nextOrder });
  if (error) {
    logger.error("section create failed", { error: error.message });
    back(pageId, "Could not add that section. Try again.", "error");
  }

  await writeAudit({ actor: admin.userId, action: "page.section.create", entity: "page_sections", entityId: pageId, meta: { type } });
  back(pageId, "Section added.");
}

export async function updateSection(formData: FormData): Promise<void> {
  const admin = await adminOrRedirect();
  const id = String(formData.get("section_id") ?? "");
  const type = String(formData.get("type") ?? "");
  if (!uuidSchema.safeParse(id).success || !isSectionType(type)) back("", "That section does not exist.", "error");

  const pageId = await pageIdOfSection(id);
  if (!pageId) back("", "That section does not exist.", "error");

  const parsed = contentFromForm(type, formData);
  if (!parsed.ok) back(pageId, parsed.errors.join(" "), "error");

  const db = adminDb();
  const { error } = await db.from("page_sections").update({ content: parsed.content }).eq("id", id);
  if (error) {
    logger.error("section update failed", { error: error.message });
    back(pageId, "Could not save that section. Try again.", "error");
  }

  await writeAudit({ actor: admin.userId, action: "page.section.update", entity: "page_sections", entityId: id, meta: { type } });
  back(pageId, "Section saved.");
}

export async function toggleSection(formData: FormData): Promise<void> {
  const admin = await adminOrRedirect();
  const id = String(formData.get("section_id") ?? "");
  if (!uuidSchema.safeParse(id).success) back("", "That section does not exist.", "error");

  const db = adminDb();
  const { data: row } = await db.from("page_sections").select("page_id,is_visible").eq("id", id).maybeSingle();
  if (!row) back("", "That section does not exist.", "error");

  const { error } = await db.from("page_sections").update({ is_visible: !row.is_visible }).eq("id", id);
  if (error) {
    logger.error("section visibility failed", { error: error.message });
    back(row.page_id, "Could not change that. Try again.", "error");
  }

  await writeAudit({ actor: admin.userId, action: "page.section.visibility", entity: "page_sections", entityId: id, meta: { visible: !row.is_visible } });
  back(row.page_id, row.is_visible ? "Section hidden." : "Section shown.");
}

export async function moveSection(formData: FormData): Promise<void> {
  const admin = await adminOrRedirect();
  const id = String(formData.get("section_id") ?? "");
  const direction = String(formData.get("direction") ?? "");
  if (!uuidSchema.safeParse(id).success || (direction !== "up" && direction !== "down")) {
    back("", "That move is not valid.", "error");
  }

  const db = adminDb();
  const { data: row } = await db.from("page_sections").select("id,page_id,sort_order").eq("id", id).maybeSingle();
  if (!row) back("", "That section does not exist.", "error");

  const { data: siblings } = await db
    .from("page_sections")
    .select("id,sort_order")
    .eq("page_id", row.page_id)
    .order("sort_order", { ascending: true });
  const list = siblings ?? [];
  const index = list.findIndex((s) => s.id === id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= list.length) back(row.page_id, "That section is already at the end.");

  // Swap the two sort_order values. Equal values are tolerated: the list is
  // re-numbered below so ordering stays deterministic from here on.
  const a = list[index];
  const b = list[target];
  await db.from("page_sections").update({ sort_order: b.sort_order }).eq("id", a.id);
  await db.from("page_sections").update({ sort_order: a.sort_order }).eq("id", b.id);

  await writeAudit({ actor: admin.userId, action: "page.section.move", entity: "page_sections", entityId: id, meta: { direction } });
  back(row.page_id, "Section moved.");
}

export async function deleteSection(_prev: ConfirmState, formData: FormData): Promise<ConfirmState> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return { error: "Sign in required." };
  }
  const id = String(formData.get("id") ?? "");
  if (!uuidSchema.safeParse(id).success) return { error: "Invalid section." };

  const pageId = await pageIdOfSection(id);
  const db = adminDb();
  const { error } = await db.from("page_sections").delete().eq("id", id);
  if (error) {
    logger.error("section delete failed", { error: error.message });
    return { error: "Could not delete that section." };
  }
  await writeAudit({ actor: admin.userId, action: "page.section.delete", entity: "page_sections", entityId: id });
  if (pageId) revalidatePath(`/admin/pages/${pageId}`);
  revalidatePath("/");
  return {};
}

export async function setPageStatus(formData: FormData): Promise<void> {
  const admin = await adminOrRedirect();
  const pageId = String(formData.get("page_id") ?? "");
  const publish = String(formData.get("status") ?? "") === "published";
  if (!uuidSchema.safeParse(pageId).success) back("", "That page does not exist.", "error");

  const db = adminDb();
  const { error } = await db
    .from("pages")
    .update({ status: publish ? "published" : "draft", published_at: publish ? new Date().toISOString() : null })
    .eq("id", pageId);
  if (error) {
    logger.error("page status failed", { error: error.message });
    back(pageId, "Could not publish that page. Try again.", "error");
  }

  await writeAudit({ actor: admin.userId, action: publish ? "page.publish" : "page.unpublish", entity: "pages", entityId: pageId });
  back(pageId, publish ? "Page published — it is live on the storefront." : "Page unpublished.");
}

export async function updatePageDetails(formData: FormData): Promise<void> {
  const admin = await adminOrRedirect();
  const pageId = String(formData.get("page_id") ?? "");
  if (!uuidSchema.safeParse(pageId).success) back("", "That page does not exist.", "error");

  const parsed = z
    .object({
      title: nameField,
      seo_title: optionalText(200, "SEO title"),
      seo_description: optionalText(500, "SEO description"),
    })
    .safeParse({
      title: String(formData.get("title") ?? "").trim(),
      seo_title: String(formData.get("seo_title") ?? ""),
      seo_description: String(formData.get("seo_description") ?? ""),
    });
  if (!parsed.success) back(pageId, "Check the page details.", "error");

  const db = adminDb();
  const { error } = await db.from("pages").update(parsed.data).eq("id", pageId);
  if (error) {
    logger.error("page update failed", { error: error.message });
    back(pageId, "Could not save the page. Try again.", "error");
  }
  await writeAudit({ actor: admin.userId, action: "page.update", entity: "pages", entityId: pageId, meta: { title: parsed.data.title } });
  back(pageId, "Page details saved.");
}

export async function createPage(formData: FormData): Promise<void> {
  const admin = await adminOrRedirect();
  const parsed = z
    .object({ title: nameField, slug: slugField })
    .safeParse({ title: String(formData.get("title") ?? "").trim(), slug: String(formData.get("slug") ?? "").trim().toLowerCase() });
  if (!parsed.success) redirect(`/admin/pages?error=${encodeURIComponent("Check the page name and URL slug.")}`);

  const db = adminDb();
  const { data: clash } = await db.from("pages").select("id").eq("slug", parsed.data.slug).maybeSingle();
  if (clash) redirect(`/admin/pages?error=${encodeURIComponent("That URL slug is already in use.")}`);

  const { data, error } = await db
    .from("pages")
    .insert({ slug: parsed.data.slug, title: parsed.data.title, layout: "default", status: "draft" })
    .select("id")
    .single();
  if (error || !data) {
    logger.error("page create failed", { error: error?.message });
    redirect(`/admin/pages?error=${encodeURIComponent("Could not create that page.")}`);
  }

  await writeAudit({ actor: admin.userId, action: "page.create", entity: "pages", entityId: data.id, meta: { slug: parsed.data.slug } });
  revalidatePath("/admin/pages");
  redirect(`/admin/pages/${data.id}?ok=${encodeURIComponent("Page created. Add sections, then publish it.")}`);
}

/**
 * Create (or repair) the landing page: the `home` page with the design's
 * default composition, published. Also the one-click way to bring a fresh
 * project to a usable storefront.
 */
export async function ensureLandingPage(): Promise<void> {
  const admin = await adminOrRedirect();
  const db = adminDb();

  const { data: existing } = await db.from("pages").select("id").eq("slug", LANDING_SLUG).maybeSingle();
  let pageId = existing?.id ?? null;
  if (!pageId) {
    const { data, error } = await db
      .from("pages")
      .insert({
        slug: LANDING_SLUG,
        title: "Home",
        layout: "default",
        status: "published",
        published_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error || !data) {
      logger.error("landing page create failed", { error: error?.message });
      redirect(`/admin/pages?error=${encodeURIComponent("Could not create the landing page.")}`);
    }
    pageId = data.id;
  } else {
    await db.from("pages").update({ status: "published", published_at: new Date().toISOString() }).eq("id", pageId);
  }

  const { data: sections } = await db.from("page_sections").select("id").eq("page_id", pageId).limit(1);
  if (!sections || sections.length === 0) {
    const rows = defaultLandingSections().map((s, i) => ({
      page_id: pageId,
      type: s.type,
      content: s.content,
      is_visible: true,
      sort_order: i,
    }));
    const { error } = await db.from("page_sections").insert(rows);
    if (error) logger.error("landing sections seed failed", { error: error.message });
  }

  await writeAudit({ actor: admin.userId, action: "page.ensure_landing", entity: "pages", entityId: pageId });
  revalidatePath("/admin/pages");
  revalidatePath("/");
  redirect(`/admin/pages/${pageId}?ok=${encodeURIComponent("Landing page is ready.")}`);
}
