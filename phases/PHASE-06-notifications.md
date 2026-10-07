# PHASE 06 — Notifications
**Precondition:** D4 answered per channel AND provider docs researched (VERIFY). No provider chosen => build outbox + interface + a dev "console" notifier only.
## Tasks
1. `Notifier` interface + provider adapters chosen by settings/env. Email first if provider is ready; SMS next; WhatsApp only via official business API/approved provider.
2. Outbox: enqueue on order events (placed, confirmed, processing, shipped, delivered, cancelled) with `dedupe_key = orderId:event:channel`. Skip email when no email; skip gracefully when channel unconfigured (`status='skipped'`).
3. Cron route (auth by `SCHEDULED_JOBS_SECRET`): send queued/failed with capped retries and backoff; record `last_error`; never throw into order flow.
4. Templates (plain, short, include order number + tracking link). Admin: notification history per order + "resend" (rate-limited, audited).
5. Password-reset email via Supabase SMTP is separate — verify it works.
## Acceptance
- Provider down => order fine, notification failed with error, retried later, no duplicate sends on retry/replay.
- No message leaks another customer's data; tracking token only in that customer's link.

## Amendments — 2026-10-06 (the precondition changed — read this first)
- **WhatsApp provider is DECIDED: self-hosted WAHA on a VPS** (not a paid SaaS). Task 1's "official business API/approved provider" line is superseded for WhatsApp; the email provider is still open (HTTPS-API only — GoDaddy blocks SMTP). Full design: `specs/whatsapp-waha-spec.md`.
- **What to build:** `WahaNotifier` implementing the existing `Notifier` interface, chosen by a `notifications.whatsapp.provider` settings row (`waha`|`none`); outbox + `dedupe_key` + `pg_cron` → `/api/cron/notifications`; bounded retries with backoff; inbound webhook receipt with HMAC verified over the raw body; admin page with session status, QR re-pairing, editable numbers, per-event toggles, and failures + retry.
- **Owner-set failure policy:** retry WhatsApp only — **no email fallback**. Failures surface as a persistent admin alert with a retry button. The order flow is never affected.
- **Owner-accepted risk:** the shop's own number is paired, and unofficial WhatsApp clients can be banned (WAHA's own docs warn of it). Keep volume to order notifications only, enforce outbound rate limits, monitor session health, expose the kill switch, and keep the adapter swappable so the official Cloud API can replace WAHA without touching orders.
- **Spike first, per the spec's §8:** run WAHA locally with Docker, pair a throwaway number, send one test. Do not pair the live shop number to a container with no session backup; the VPS session volume must be backed up (see PHASE 11).
- **Stop-and-ask additions:** WAHA engine choice, VPS purchase (provider/region/size), and compliance with WAHA's "How to Avoid Blocking" page before pairing the live number.
- **Cannot be tested except live:** delivery, session logout/disconnect handling, webhook retries and HMAC rejection with real events, and the dedupe/no-duplicate behaviour under a real retry storm. Simulated WhatsApp is not proof — the spec's §8 test table (10 tests) is the acceptance gate.

## Amendments — 2026-10-06 (provider-optional policy; owner directive)
- **A missing provider never blocks this phase or the project.** If WAHA, SMS or email has no VPS/provider/keys (env empty, e.g. `WAHA_URL` unset), build the full seam — `Notifier` interface, outbox + `dedupe_key`, `skipped`-status rows, cron route, templates, admin history/resend — with that channel set to `none` and a "not configured" status in admin. Ship it disabled. Wire the live adapter only when the provider exists.
- **Acceptance without a provider:** outbox records `skipped` rows, the order flow is unaffected, admin shows per-channel "not configured" (not an error), no crash on send attempt. Live-delivery proof moves to the phase/event where the provider arrives — record which one.
- The dev "console" notifier from the original precondition stays dev-only.
