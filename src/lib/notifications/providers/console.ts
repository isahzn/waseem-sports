import "server-only";
import { logger } from "@/lib/security/logger";
import type { NotificationMessage, Notifier, SendResult } from "../types";

/**
 * Development-only "notifier" (phase precondition). It sends nothing — it logs
 * what *would* have gone out, so the whole outbox → render → send → mark-sent
 * pipeline can be exercised locally without WAHA, a VPS or the shop's number.
 *
 * Deliberately refused in production: `resolveChannel` only ever constructs this
 * when `NODE_ENV !== "production"`, and `send` re-checks so a mis-set settings
 * row can never turn a production build into a silent no-op that reports
 * "sent". It reports a fake provider id so the outbox records a realistic row.
 */
export class ConsoleNotifier implements Notifier {
  readonly channel = "whatsapp" as const;
  readonly provider = "console";

  async send(message: NotificationMessage): Promise<SendResult> {
    if (process.env.NODE_ENV === "production") {
      return { ok: false, error: "The console notifier is development-only." };
    }
    logger.info("console notification (dev only — nothing was sent)", {
      channel: message.channel,
      event: message.event,
      recipient: message.recipient,
      body: message.body,
    });
    return { ok: true, providerMessageId: `console-${Date.now()}` };
  }
}
