"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { AuthError, requireAdmin } from "@/lib/auth/requireAdmin";
import { writeAudit } from "@/lib/catalog/audit";
import { checkRateLimit, clientIp } from "@/lib/security/ratelimit";
import { logger } from "@/lib/security/logger";
import { setSetting } from "@/lib/settings";
import { NOTIFICATION_EVENTS, eventToggleKey } from "@/lib/notifications/events";
import { resolveChannel } from "@/lib/notifications/config";
import { normalizeRecipient } from "@/lib/notifications/recipients";
import { isWahaConfigured, logoutSession, restartSession, startSession } from "@/lib/notifications/providers/waha";
import { formBool, formText, toFieldErrors } from "@/lib/orders/schemas";

/**
 * Admin actions for the notification channels page (PHASE 06).
 *
 * Every action authorizes first with `requireAdmin()` (CLAUDE.md rule 5) and
 * writes an audit row. Nothing here talks to a provider except the session
 * actions and the test send, and all of those degrade to a clear "not
 * configured" message when WAHA's env is absent (D33) — they never throw into
 * the page.
 */

export type WhatsAppSettingsState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  ok?: boolean;
};

export type TestState = { error?: string; ok?: boolean };

const settingsSchema = z.object({
  provider: z.enum(["none", "waha", "console"]),
  public_number: z.string().trim().max(30, "Number is too long."),
  alert_number: z.string().trim().max(30, "Number is too long."),
});

/**
 * Notification settings are owner-only (SECURITY.md §2: only the owner edits
 * settings). Staff accounts can still read the page and retry notifications;
 * they just cannot change the provider, kill switch, numbers or templates.
 */
async function authorize(): Promise<{ userId: string | null } | { error: string }> {
  try {
    const admin = await requireAdmin(["owner"]);
    return { userId: admin.userId };
  } catch (err) {
    if (err instanceof AuthError && err.status === 403) {
      return { error: "Only the owner can change notification settings." };
    }
    return { error: "Sign in required." };
  }
}

/** Persist provider, kill switch, numbers, per-event toggles and templates. */
export async function saveWhatsAppSettings(
  _prev: WhatsAppSettingsState,
  formData: FormData,
): Promise<WhatsAppSettingsState> {
  const admin = await authorize();
  if ("error" in admin) return { error: admin.error };

  const parsed = settingsSchema.safeParse({
    provider: formText(formData.get("provider")) ?? "none",
    public_number: formText(formData.get("public_number")) ?? "",
    alert_number: formText(formData.get("alert_number")) ?? "",
  });
  if (!parsed.success) {
    return { error: "Check the highlighted fields.", fieldErrors: toFieldErrors(parsed.error) };
  }
  const { provider, public_number, alert_number } = parsed.data;
  const enabled = formBool(formData.get("enabled"));

  const eventToggles: Record<string, boolean> = {};
  const templates: Record<string, string> = {};
  for (const event of NOTIFICATION_EVENTS) {
    eventToggles[event] = formBool(formData.get(`event_${event}`));
    templates[event] = (formText(formData.get(`template_${event}`)) ?? "").trim().slice(0, 500);
  }

  const writes: { key: string; value: string | boolean }[] = [
    { key: "notifications.whatsapp.provider", value: provider },
    { key: "notifications.whatsapp.enabled", value: enabled },
    { key: "public.whatsapp_number", value: public_number },
    { key: "notifications.admin_alert_number", value: alert_number },
    ...Object.entries(eventToggles).map(([event, on]) => ({ key: eventToggleKey(event), value: on })),
    ...Object.entries(templates).map(([event, body]) => ({ key: `notifications.templates.${event}`, value: body })),
  ];

  for (const { key, value } of writes) {
    const { error } = await setSetting(key, value, admin.userId);
    if (error) {
      logger.error("notification setting write failed", { key, error });
      return { error: "Could not save the notification settings. Try again." };
    }
  }

  await writeAudit({
    actor: admin.userId,
    action: "settings.notifications",
    entity: "store_settings",
    meta: { provider, enabled, events: eventToggles, public_number, alert_number },
  });
  revalidatePath("/admin/settings/whatsapp");
  return { ok: true };
}

/** Plain actions used as `<form action={...}>`; they always land back on the page. */
async function runSessionAction(op: "connect" | "restart" | "disconnect"): Promise<void> {
  const admin = await authorize();
  if ("error" in admin) redirect("/admin/login");

  if (isWahaConfigured()) {
    try {
      if (op === "connect") await startSession();
      else if (op === "restart") await restartSession();
      else await logoutSession();
    } catch (err) {
      logger.error("waha session action threw", {
        op,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  await writeAudit({
    actor: admin.userId,
    action: "notifications.waha_session",
    entity: "store_settings",
    meta: { op, configured: isWahaConfigured() },
  });
  revalidatePath("/admin/settings/whatsapp");
  redirect("/admin/settings/whatsapp");
}

export async function connectWaha(): Promise<void> {
  await runSessionAction("connect");
}

export async function restartWaha(): Promise<void> {
  await runSessionAction("restart");
}

export async function disconnectWaha(): Promise<void> {
  await runSessionAction("disconnect");
}

/** Send one real message to the admin alert number, to prove a session works. */
export async function sendTestWhatsApp(_prev: TestState, formData: FormData): Promise<TestState> {
  const admin = await authorize();
  if ("error" in admin) return { error: admin.error };

  const ip = clientIp(await headers());
  const limit = await checkRateLimit(`notify:test:${ip}`, 5, 15 * 60 * 1000);
  if (!limit.allowed) return { error: "Too many test messages. Wait a few minutes." };

  const { config, notifier } = await resolveChannel("whatsapp");
  if (!config.configured || !notifier) {
    return { error: "WhatsApp is not configured — there is nothing to send a test to." };
  }
  if (!config.enabled) {
    return { error: "Notifications are switched off for WhatsApp. Turn the kill switch back on first." };
  }

  const raw = (formText(formData.get("number")) ?? "").trim();
  const recipient = normalizeRecipient("whatsapp", raw);
  if (!recipient.ok) return { error: recipient.reason };

  const result = await notifier.send({
    channel: "whatsapp",
    recipient: recipient.value,
    event: "test",
    body: "Waseem Sports test message.",
  });

  await writeAudit({
    actor: admin.userId,
    action: "notification.test",
    entity: "store_settings",
    meta: { ok: result.ok },
  });
  if (!result.ok) return { error: result.error ?? "The provider rejected the test message." };
  revalidatePath("/admin/settings/whatsapp");
  return { ok: true };
}
