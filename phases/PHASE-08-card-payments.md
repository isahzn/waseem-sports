# PHASE 08 — Card payments
**Precondition:** D3 decided AND provider docs verified (availability in Sri Lanka, API, webhook signing, refunds, fees, sandbox). If not, DO NOT START. Never invent an API.
## Tasks
1. Implement `PaymentProvider` adapter from the provider's official docs (cite doc URLs in the adapter header).
2. Flow: order created (`payment_status=pending`, stock reserved) -> `createPayment` -> redirect -> return page shows "processing" only. Only a verified webhook (or server-side `getStatus`) marks paid.
3. Webhook route: raw-body signature verify, timestamp/replay check if supported, insert `webhook_events` (dup => 200 no-op), compare amount/currency to order, idempotent transition, audit + notification.
4. Failure paths: payment failed/cancelled/expired => release stock, status `payment_failed`; cron to expire stale pending orders; retry payment link.
5. Sandbox tests + manual reconciliation script/report.
## Acceptance
- Forged webhook rejected; replayed webhook no-op; browser "success" URL never marks paid; amount mismatch flagged not paid; duplicate checkout doesn't double-charge.
- Not enabled in production until sandbox + go-live checklist done and owner approves.

## Amendments — 2026-10-06 (context for a session with no prior knowledge)
- **Paid and payment-failed states enqueue WhatsApp notification rows** per `specs/whatsapp-waha-spec.md` §5.1 (the "notification" in task 3's "audit + notification" is the outbox row, not a direct send). Release-on-expiry and payment-failure paths must enqueue the `cancelled`/`payment_failed` templates where configured.
- Nothing else in this phase changes. The WhatsApp adapter, retry policy and admin surfaces are PHASE 06's; this phase only produces the events.
- **Cannot be tested except live-in-sandbox:** provider webhooks only against the sandbox; real-charge behaviour is never tested in production. Webhook replay tests must use recorded real payloads, not hand-written ones.
