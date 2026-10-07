"use client";

import { useActionState } from "react";
import { FormError, StatusBadge } from "../../../_components/ui";
import { connectWaha, disconnectWaha, restartWaha, sendTestWhatsApp } from "../actions";

/**
 * WAHA session panel. It never claims a session works until WAHA says so; when
 * the provider is unconfigured it explains the disabled state instead of showing
 * broken controls (D33). The session and QR endpoints are VERIFY-pending against
 * a live WAHA instance.
 */
export function SessionControls({
  configured,
  status,
  me,
  error,
  qrDataUrl,
  alertNumber,
}: {
  configured: boolean;
  status: string | null;
  me: string | null;
  error: string | null;
  qrDataUrl: string | null;
  alertNumber: string;
}) {
  const [testState, testAction, testPending] = useActionState(sendTestWhatsApp, {});

  if (!configured) {
    return (
      <div className="rounded-md border border-dashed border-line bg-card p-4">
        <div className="flex items-center gap-2">
          <StatusBadge tone="muted">Not connected</StatusBadge>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          WAHA is not set up yet, so no WhatsApp messages are sent. When the VPS exists, set
          <code className="mx-1 rounded-sm bg-surface px-1">WAHA_URL</code> and
          <code className="mx-1 rounded-sm bg-surface px-1">WAHA_API_KEY</code>, choose the WAHA
          provider above, then pair the shop number by scanning a QR code here.
        </p>
      </div>
    );
  }

  const tone = status === "WORKING" ? "green" : status === "SCAN_QR" ? "gold" : "muted";

  return (
    <div className="flex flex-col gap-4 rounded-md border border-line bg-card p-4">
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge tone={tone}>{status ?? "Unknown"}</StatusBadge>
        {me && <span className="text-sm text-muted">Paired as {me}</span>}
        {!me && <span className="text-sm text-muted">No number paired yet</span>}
      </div>

      {error && <FormError message={error} />}

      {qrDataUrl && (
        <div className="flex flex-col gap-2">
          <p className="text-sm">
            Scan this code with the shop’s WhatsApp number (Linked devices → Link a device). It
            expires — reload for a fresh one.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrDataUrl}
            alt="WhatsApp pairing QR code"
            className="h-56 w-56 rounded-sm border border-line bg-white p-2"
          />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <form action={connectWaha}>
          <button type="submit" className="rounded-sm bg-gold-600 px-4 py-2 text-sm font-semibold text-bronze-ink">
            {qrDataUrl ? "Re-pair" : "Connect"}
          </button>
        </form>
        <form action={restartWaha}>
          <button type="submit" className="rounded-sm border border-line px-4 py-2 text-sm">
            Restart session
          </button>
        </form>
        <form action={disconnectWaha}>
          <button type="submit" className="rounded-sm border border-line px-4 py-2 text-sm">
            Disconnect
          </button>
        </form>
      </div>

      <form action={testAction} className="flex flex-wrap items-end gap-3 border-t border-line pt-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">Send a test message</span>
          <input
            type="text"
            name="number"
            defaultValue={alertNumber}
            maxLength={30}
            placeholder="07x xxx xxxx"
            className="rounded-sm border border-line bg-surface px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={testPending}
          className="rounded-sm border border-line px-4 py-2 text-sm font-semibold disabled:opacity-60"
        >
          {testPending ? "Sending…" : "Send test"}
        </button>
        <div className="w-full">
          <FormError message={testState.error} />
          {testState.ok && <p className="text-sm text-pine-800">Test message accepted by WAHA.</p>}
        </div>
      </form>
    </div>
  );
}
