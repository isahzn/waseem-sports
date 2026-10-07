import "server-only";
import { getSetting, getSettingsMap } from "@/lib/settings";
import { NOTIFICATION_EVENTS, eventToggleKey } from "./events";
import { ConsoleNotifier } from "./providers/console";
import { WahaNotifier, isWahaConfigured } from "./providers/waha";
import type { NotificationChannel, Notifier } from "./types";

/**
 * Provider selection (PHASE 06 task 1, spec §4 rule 3).
 *
 * Which adapter a channel uses is a settings row, not an env hardcode:
 *   notifications.whatsapp.provider = 'waha' | 'console' | 'none'
 * A channel is `configured` only when the chosen provider can actually send
 * (`waha` needs WAHA_URL + WAHA_API_KEY; `console` is development-only). The
 * kill switch `notifications.<channel>.enabled` can stop sending without
 * touching the provider row.
 *
 * Unconfigured never blocks anything (D33): the outbox records `skipped`, the
 * admin shows "not configured" as a normal state, and no send is attempted.
 */

export type ChannelConfig = {
  channel: NotificationChannel;
  /** The selected provider code, e.g. `waha`, `console`, `none`. */
  provider: string;
  /** A real adapter exists and can send. */
  configured: boolean;
  /** Kill switch — false stops sending without forgetting the provider. */
  enabled: boolean;
  /** Why the channel will not send right now (null when it will). */
  reason: string | null;
};

export const PROVIDER_OPTIONS: Record<NotificationChannel, { value: string; label: string }[]> = {
  whatsapp: [
    { value: "none", label: "Not configured" },
    { value: "waha", label: "WAHA (self-hosted)" },
    { value: "console", label: "Console (development only)" },
  ],
  email: [{ value: "none", label: "Not configured" }],
  sms: [{ value: "none", label: "Not configured" }],
};

function providerKey(channel: NotificationChannel): string {
  return `notifications.${channel}.provider`;
}

function enabledKey(channel: NotificationChannel): string {
  return `notifications.${channel}.enabled`;
}

/** The provider code stored for a channel, defaulting to `none`. */
export async function getProvider(channel: NotificationChannel): Promise<string> {
  const raw = await getSetting<string>(providerKey(channel), "none");
  const chosen = typeof raw === "string" && raw.trim() !== "" ? raw.trim() : "none";
  return chosen;
}

/** Kill switch. Defaults to on, so a channel is sendable once it is configured. */
export async function isChannelEnabled(channel: NotificationChannel): Promise<boolean> {
  const raw = await getSetting<boolean>(enabledKey(channel), true);
  return raw !== false;
}

type Resolution = { config: ChannelConfig; notifier: Notifier | null };

/**
 * One channel's full state. `notifier` is present whenever the provider is
 * configured, independent of the kill switch — the outbox decides what to do
 * with a disabled channel.
 */
export async function resolveChannel(channel: NotificationChannel): Promise<Resolution> {
  const provider = await getProvider(channel);
  const enabled = await isChannelEnabled(channel);
  let notifier: Notifier | null = null;
  let configured = false;
  let reason: string | null = null;

  if (provider === "waha") {
    if (channel !== "whatsapp") {
      reason = "WAHA can only send WhatsApp messages.";
    } else if (isWahaConfigured()) {
      notifier = new WahaNotifier();
      configured = true;
    } else {
      reason = "WAHA provider selected, but WAHA_URL / WAHA_API_KEY are not set.";
    }
  } else if (provider === "console") {
    if (process.env.NODE_ENV === "production") {
      reason = "The console notifier is development-only.";
    } else if (channel === "whatsapp") {
      notifier = new ConsoleNotifier();
      configured = true;
    } else {
      reason = "The console notifier only implements the WhatsApp channel.";
    }
  } else if (provider === "none") {
    reason = "No provider selected.";
  } else {
    reason = `No adapter exists for provider "${provider}".`;
  }

  if (!configured) reason = reason ?? "Channel is not configured.";
  else if (!enabled) reason = "Notifications are switched off for this channel.";

  return { config: { channel, provider, configured, enabled, reason }, notifier };
}

/** Resolve every channel for the admin status panel. */
export async function getAllChannelConfigs(): Promise<ChannelConfig[]> {
  const channels: NotificationChannel[] = ["whatsapp", "email", "sms"];
  const resolved = await Promise.all(channels.map((c) => resolveChannel(c)));
  return resolved.map((r) => r.config);
}

/** Per-event on/off toggles. Unknown events default to on. */
export async function getEventToggles(): Promise<Record<string, boolean>> {
  const keys = NOTIFICATION_EVENTS.map((e) => eventToggleKey(e));
  const map = await getSettingsMap(keys);
  const out: Record<string, boolean> = {};
  for (const event of NOTIFICATION_EVENTS) {
    const value = map.get(eventToggleKey(event));
    out[event] = value !== false;
  }
  return out;
}

/** Whether one event is allowed to enqueue at all. Defaults to on. */
export async function isEventEnabled(event: string): Promise<boolean> {
  const value = await getSetting<boolean>(eventToggleKey(event), true);
  return value !== false;
}
