"use client";

import { useActionState } from "react";
import { Field, FormError } from "../../../_components/ui";
import { saveWhatsAppSettings } from "../actions";

/**
 * The editable side of the notification settings: provider, kill switch,
 * numbers, per-event toggles and message templates. Templates are plain text
 * with a fixed placeholder set — an unknown token renders empty, never
 * `undefined` (see `lib/notifications/templates.ts`).
 */
export function WhatsAppSettingsForm({
  provider,
  enabled,
  publicNumber,
  alertNumber,
  toggles,
  providerOptions,
  templates,
  eventLabels,
  placeholders,
  wahaConfigured,
}: {
  provider: string;
  enabled: boolean;
  publicNumber: string;
  alertNumber: string;
  toggles: Record<string, boolean>;
  providerOptions: { value: string; label: string }[];
  templates: Record<string, string>;
  eventLabels: Record<string, string>;
  placeholders: readonly string[];
  wahaConfigured: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveWhatsAppSettings, {});
  const fe = state.fieldErrors ?? {};
  const events = Object.keys(templates);

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <FormError message={state.error} />
      {state.ok && (
        <p className="rounded-sm border border-pine-800 bg-pine-900 px-3 py-2 text-sm">
          Notification settings saved.
        </p>
      )}

      <section>
        <h2 className="font-display text-xl font-bold">Provider &amp; switch</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field
            label="WhatsApp provider"
            hint={
              wahaConfigured
                ? "WAHA is configured — choose it to start sending."
                : "WAHA env is not set. Choosing it keeps the channel disabled until it is."
            }
            errors={fe.provider}
          >
            <select
              name="provider"
              defaultValue={provider}
              className="rounded-sm border border-line bg-surface px-3 py-2"
            >
              {providerOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <label className="flex items-center gap-3 self-end rounded-sm border border-line bg-card px-4 py-3 text-sm">
            <input type="checkbox" name="enabled" defaultChecked={enabled} className="h-4 w-4" />
            <span>
              <span className="block font-semibold">WhatsApp notifications on</span>
              <span className="block text-xs text-muted">
                The kill switch. Off = nothing is sent and new notifications record as “skipped”.
              </span>
            </span>
          </label>
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl font-bold">Numbers</h2>
        <p className="mt-1 text-sm text-muted">
          The public number is what customers tap to chat; the alert number is where the shop should
          hear about failures. Neither changes who messages are sent <em>from</em> — that is the
          paired WAHA session.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label="Public WhatsApp number" errors={fe.public_number}>
            <input
              type="text"
              name="public_number"
              defaultValue={publicNumber}
              maxLength={30}
              placeholder="077 009 0147"
              className="rounded-sm border border-line bg-surface px-3 py-2"
            />
          </Field>
          <Field label="Admin alert number" errors={fe.alert_number}>
            <input
              type="text"
              name="alert_number"
              defaultValue={alertNumber}
              maxLength={30}
              placeholder="07x xxx xxxx"
              className="rounded-sm border border-line bg-surface px-3 py-2"
            />
          </Field>
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl font-bold">Events</h2>
        <p className="mt-1 text-sm text-muted">
          Which order events notify the customer. Turning one off records it as “skipped” rather than
          sending.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {events.map((event) => (
            <label
              key={event}
              className="flex items-center gap-3 rounded-sm border border-line bg-card px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                name={`event_${event}`}
                defaultChecked={toggles[event] !== false}
                className="h-4 w-4"
              />
              <span>{eventLabels[event] ?? event}</span>
            </label>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl font-bold">Templates</h2>
        <p className="mt-1 text-sm text-muted">
          Plain text, short. Placeholders:{" "}
          {placeholders.map((p) => (
            <code key={p} className="mr-1 rounded-sm bg-surface px-1 text-xs">{`{${p}}`}</code>
          ))}
          . A missing value renders empty.
        </p>
        <div className="mt-3 flex flex-col gap-4">
          {events.map((event) => (
            <Field key={event} label={eventLabels[event] ?? event}>
              <textarea
                name={`template_${event}`}
                defaultValue={templates[event] ?? ""}
                rows={2}
                maxLength={500}
                className="rounded-sm border border-line bg-surface px-3 py-2 font-sans text-sm"
              />
            </Field>
          ))}
        </div>
      </section>

      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-sm bg-gold-600 px-5 py-2 text-sm font-semibold text-bronze-ink disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save notification settings"}
        </button>
      </div>
    </form>
  );
}
