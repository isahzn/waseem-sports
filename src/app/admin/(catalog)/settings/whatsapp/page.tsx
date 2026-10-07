import Link from "next/link";
import { requireAdminOrRedirect } from "@/lib/auth/requireAdmin";
import { getAllChannelConfigs, getEventToggles, PROVIDER_OPTIONS } from "@/lib/notifications/config";
import { EVENT_LABELS, NOTIFICATION_EVENTS } from "@/lib/notifications/events";
import { TEMPLATE_PLACEHOLDERS, templateFor } from "@/lib/notifications/templates";
import { getQr, getSessionStatus, isWahaConfigured } from "@/lib/notifications/providers/waha";
import { getSetting } from "@/lib/settings";
import { StatusBadge } from "../../_components/ui";
import { SessionControls } from "./_components/SessionControls";
import { WhatsAppSettingsForm } from "./_components/WhatsAppSettingsForm";

export const metadata = { title: "WhatsApp notifications — Waseem Sports Admin" };
export const dynamic = "force-dynamic";

/**
 * Notification channels (PHASE 06).
 *
 * This page is honest about the disabled state: with no `WAHA_URL`/keys every
 * channel reads "Not configured" as a normal status, the session panel explains
 * that sending is switched off, and nothing here crashes on a missing provider
 * (D33). The session/QR endpoints are implemented but unproven until a live
 * WAHA session exists — the page says so rather than implying delivery works.
 */
export default async function WhatsAppSettingsPage() {
  // Authorize before reading (D43 — a layout redirect is not enough).
  await requireAdminOrRedirect();

  const configs = await getAllChannelConfigs();
  const toggles = await getEventToggles();
  const wahaConfigured = isWahaConfigured();

  const [provider, enabled, publicNumber, alertNumber] = await Promise.all([
    getSetting<string>("notifications.whatsapp.provider", "none"),
    getSetting<boolean>("notifications.whatsapp.enabled", true),
    getSetting<string>("public.whatsapp_number", ""),
    getSetting<string>("notifications.admin_alert_number", ""),
  ]);

  const templateEntries = await Promise.all(
    NOTIFICATION_EVENTS.map(async (event) => [event, await templateFor(event)] as const),
  );

  const session = wahaConfigured
    ? await getSessionStatus()
    : { configured: false, status: null, me: null, error: null };
  const qr =
    wahaConfigured && session.status !== "WORKING"
      ? await getQr()
      : ({ ok: false } as const);

  return (
    <main className="flex flex-col gap-8">
      <div>
        <Link href="/admin/notifications" className="text-sm text-muted hover:text-ink">
          ← Notification history
        </Link>
        <h1 className="mt-2 font-display text-3xl font-bold">Notifications</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Order and status messages the shop sends to customers. Anything without a provider stays
          disabled: the outbox records what it <em>would</em> send and the shop keeps working exactly
          as before. Adding the provider later turns a channel on without touching the order flow.
        </p>
      </div>

      <section>
        <h2 className="font-display text-xl font-bold">Channel status</h2>
        <p className="mt-1 text-sm text-muted">
          “Not configured” is a normal state, not an error — it means no provider is set up for that
          channel yet.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {configs.map((config) => (
            <div key={config.channel} className="rounded-md border border-line bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold capitalize">{config.channel}</p>
                <StatusBadge tone={config.configured ? "green" : "muted"}>
                  {config.configured ? "Configured" : "Not configured"}
                </StatusBadge>
              </div>
              <p className="mt-2 text-xs text-muted">Provider: {config.provider}</p>
              <p className="mt-1 text-xs text-muted">{config.reason ?? "Ready to send."}</p>
              {config.configured && !config.enabled && (
                <p className="mt-1 text-xs font-semibold text-gold-400">Kill switch is on.</p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl font-bold">WhatsApp session</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Only the shop’s own paired number can send messages, and pairing happens by scanning a QR
          code — it is the session’s identity, so it cannot be typed in. The API key stays on the
          server; the browser only ever sees the QR image.
        </p>
        <div className="mt-3">
          <SessionControls
            configured={wahaConfigured}
            status={session.status}
            me={session.me}
            error={session.error}
            qrDataUrl={qr.ok ? qr.dataUrl ?? null : null}
            alertNumber={alertNumber}
          />
        </div>
      </section>

      <WhatsAppSettingsForm
        provider={typeof provider === "string" ? provider : "none"}
        enabled={enabled !== false}
        publicNumber={typeof publicNumber === "string" ? publicNumber : ""}
        alertNumber={typeof alertNumber === "string" ? alertNumber : ""}
        toggles={toggles}
        providerOptions={PROVIDER_OPTIONS.whatsapp}
        templates={Object.fromEntries(templateEntries)}
        eventLabels={EVENT_LABELS}
        placeholders={TEMPLATE_PLACEHOLDERS}
        wahaConfigured={wahaConfigured}
      />
    </main>
  );
}
