import "server-only";

/**
 * The notification seam (PHASE 06).
 *
 * Business code never talks to a provider. It writes an outbox row
 * (`lib/orders/notify.ts`); the cron job renders a DB-backed template and asks
 * the channel's `Notifier` to send it. Swapping WAHA for the official WhatsApp
 * Cloud API later is one adapter file plus one settings row — nothing in the
 * order flow changes (spec §4).
 *
 * `server-only`: these types describe a server send path and must never reach a
 * client bundle.
 */

export type NotificationChannel = "whatsapp" | "email" | "sms";

/** A fully rendered message, ready for one adapter. */
export type NotificationMessage = {
  channel: NotificationChannel;
  /** The recipient exactly as stored on the outbox row (raw customer value). */
  recipient: string;
  event: string;
  /** The final, plain-text body. Never HTML, never provider-specific markup. */
  body: string;
};

export type SendResult = {
  ok: boolean;
  /** Human-readable failure reason, stored as `last_error`. Never a secret. */
  error?: string;
  /** Provider's own message id, when it returns one. */
  providerMessageId?: string;
};

/**
 * One channel implementation. Implementations must:
 *  - never throw (return `{ ok: false, error }` instead),
 *  - never log the API key or the message body,
 *  - be idempotent from the caller's point of view (the outbox owns retries).
 */
export interface Notifier {
  readonly channel: NotificationChannel;
  /** Provider code recorded on the outbox row (`waha`, `console`, …). */
  readonly provider: string;
  send(message: NotificationMessage): Promise<SendResult>;
}
