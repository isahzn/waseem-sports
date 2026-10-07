# whatsapp-waha — Specification

**Short name:** `whatsapp-waha`
**Created:** 2026-10-06
**Project:** Waseem Sports
**Status:** **draft — awaiting owner approval.** No application code exists yet; nothing here is built.
**Phase it lands in:** **PHASE 06 (notifications)** — after the MVP (PHASES 0–5). A local WAHA spike can start immediately without touching app code (see §8).
**Related:** `specs/phase-00-fix-spec.md` (§5.7, §F8), `docs/ARCHITECTURE.md` (Notifier abstraction, outbox), `docs/SECURITY.md` (§5, §6, §16), `docs/DECISIONS.md` (D4).

---

## 1. The request

> "For WhatsApp, I'm going to use **WAHA (WhatsApp HTTP API)**. It's self-hosted/local, so don't build this around a paid WhatsApp API provider like Ayrshare. The WhatsApp system should be able to send automated order/status notifications from the Waseem Sports system. Keep the WhatsApp integration modular so we can replace WAHA later if needed. Don't overcomplicate it."

**Owner decisions collected (2026-10-06):**

| # | Decision | Answer |
|---|---|---|
| W1 | Provider | **WAHA**, self-hosted. Not a paid SaaS (e.g. Ayrshare) |
| W2 | Hosting | Try Supabase first; **if not possible, a VPS** → verdict in §3: **not possible on Supabase, so VPS** |
| W3 | Which number notifies | **The shop's existing WhatsApp number** (the real one confirmed in `phase-00-fix-spec.md` §5.2: 077 009 0147 / 075 613 0147). Owner explicitly accepts the ban risk |
| W4 | The number must be changeable **from the website/admin**, not by editing WAHA by hand | Admin settings page (§5.4) — with one honest constraint about re-pairing |
| W5 | Failure policy | **Retry WhatsApp only** (no email fallback); surface failures to the admin |
| W6 | Scope discipline | Reliable product images + a working WhatsApp notification system. **Don't overcomplicate** |

---

## 2. Verified facts about WAHA (read from its own documentation, 2026-10-06)

Sources: `waha.devlike.pro` homepage, `/docs/overview/quick-start/`, `/docs/how-to/config/`, `/docs/how-to/security/`, `/docs/how-to/events/`, `github.com/devlikeapro/waha`.

- **Free and open source**, self-hosted. Runs as a Docker container: `docker pull devlikeapro/waha` (ARM images use the `:arm` tag). An optional $5/month community tier exists on Patreon/Boosty/crypto — support, not a requirement.
- **Runs a real WhatsApp Web instance** under the hood. Three engines, selected with `WHATSAPP_DEFAULT_ENGINE`: `WEBJS` (default, Puppeteer + Chrome), `NOWEB` (built-in WhatsApp Web version, `WAHA_NOWEB_WA_VERSION`, supports `auto-web` since 2026.8.1), `GOWS` (Go/whatsmeow).
- **Credentials are generated for you:** `docker run --rm -v "$(pwd)":/app/env devlikeapro/waha init-waha /app/env` writes a `.env` containing `WAHA_API_KEY`, `WAHA_DASHBOARD_USERNAME`, `WAHA_DASHBOARD_PASSWORD`.
- **Run:** `docker run -it --env-file ./.env -v "$(pwd)/sessions:/app/.sessions" -p 3000:3000 --name waha devlikeapro/waha`. The `sessions` volume is what keeps the pairing across restarts.
- **Dashboard** at `/dashboard`, **Swagger** at `/#/chatting`. A session starts `STOPPED`, moves to `SCAN_QR`, then `WORKING` once the QR is scanned — **pairing is the only way to set the sending identity**.
- **Send:** `POST /api/sendText` with header `X-Api-Key: <WAHA_API_KEY>` and body `{"session":"default","chatId":"123123@c.us","text":"Hi there!"}`. `chatId` is the number **without `+`**, suffixed `@c.us`.
- **Webhooks:** `WHATSAPP_HOOK_URL`, `WHATSAPP_HOOK_EVENTS`, `WHATSAPP_HOOK_RETRIES_POLICY`, and HMAC signing via `WHATSAPP_HOOK_HMAC_KEY` (globally) or per-session `config.hmac.key`.
- **Hosting/security docs exist** for production install, and a dedicated "⚠️ How to Avoid Blocking" page.
- **WAHA's own homepage says:** *"WhatsApp does not allow bots or unofficial clients on their platform, so this shouldn't be considered totally safe."*

---

## 3. Where WAHA runs: Supabase is **not** possible — VPS it is

The owner asked for a verdict. It is **no**, and the reason is structural, not a configuration detail.

| Requirement of WAHA | Supabase | Verdict |
|---|---|---|
| Run a Docker container | Supabase offers Postgres, Auth, Storage, Realtime and **Edge Functions (Deno)**. There is no container hosting | ❌ |
| Hold a **long-lived socket** to WhatsApp for days/weeks | Edge Functions are request-scoped. Documented limits: **wall-clock 400 s (paid) / 150 s (free)**, **256 MB memory**, ~200 ms active CPU, ephemeral storage — and background tasks are capped by the same wall clock | ❌ |
| Run **Chrome/Puppeteer** (WEBJS engine) or a built-in WhatsApp Web client | No arbitrary binaries in the Deno runtime | ❌ |
| Persist the **session/QR credentials** across restarts | Edge Functions have no durable local filesystem (S3-like mounts are not a session store) | ❌ |

**Conclusion: WAHA must run on a VPS (or any Docker host).** Where Supabase *does* fit, and will be used:

- the **outbox** (`notifications` table) that decides *what* to send,
- **`pg_cron` + `pg_net`** to trigger the sending job over HTTPS (per `phase-00-fix-spec.md` §5.6),
- the **database/RLS** surface for the admin WhatsApp page.

An Edge Function *could* receive WAHA webhooks, but there is no reason to add a second runtime for that — the app already exposes `/api/webhooks/waha`.

### VPS shape (recommendation, ~£4–6/month)

- 1–2 vCPU, 2 GB RAM, 20 GB disk (the WEBJS engine needs Chrome, so 2 GB is the realistic floor); **VERIFY** against the current WAHA production guide before buying.
- Docker + a TLS-terminating reverse proxy (Caddy is the least configuration) → WAHA reachable **only over HTTPS on 443**, never plain HTTP.
- Firewall: 443 public; port 3000 **not** exposed publicly — reach it over the internal network or bind to localhost behind the proxy.
- Persistent volume for `/app/.sessions`; snapshot/back it up (losing it means re-scanning the QR).
- Region close to Sri Lanka for latency. **VERIFY** provider choice and price at PHASE 06.
- GoDaddy's egress rule (ports **80/443 only**) is satisfied: the app calls WAHA over HTTPS 443, and WAHA calls WhatsApp over 443.

---

## 4. Architecture: modular by construction

The abstraction already exists in `docs/ARCHITECTURE.md`; WAHA becomes one implementation of it. **Swapping WAHA later must be a config change plus one adapter file — nothing else.**

```
order event (server action)
        │  inserts a row, never calls WAHA inline
        ▼
notifications (outbox table)  ──dedupe_key──►  no duplicates
        ▲
        │  pg_cron → POST /api/cron/notifications   (SCHEDULED_JOBS_SECRET)
        │
  ┌─────┴──────────────────────────────────────────────┐
  │  lib/notifications/outbox.ts  (claim → send → mark)│
  │      └── registry: channel → Notifier              │
  │            ├── WahaNotifier      (this spec)       │
  │            ├── EmailNotifier     (PHASE 06)        │
  │            └── <future official WhatsApp Cloud API>│
  └─────┬──────────────────────────────────────────────┘
        │  HTTPS  ·  X-Api-Key  ·  POST /api/sendText
        ▼
     WAHA (VPS, Docker)  ──►  WhatsApp
        │
        └── webhook (HMAC) ──►  /api/webhooks/waha  → delivery status, session state
```

Rules:
1. **Business code only inserts outbox rows.** It never calls WAHA, never awaits a send, and never fails an order because a message failed.
2. **One interface.** `Notifier { channel: 'email'|'sms'|'whatsapp'; send(msg): Promise<{ok:boolean; error?:string; providerMessageId?:string}> }`. `WahaNotifier` is one implementation.
3. **Provider chosen by a settings row**, not by an env hardcode: `notifications.whatsapp.provider = 'waha' | 'none'`. Swapping later = add an adapter + change the row.
4. **The API key is server-only.** `lib/notifications/providers/waha.ts` imports `server-only`; the key never reaches the browser, never gets a `NEXT_PUBLIC_` prefix, and is never logged.
5. **Idempotent + retried.** `dedupe_key` stops duplicate sends on retries and re-triggered cron runs; bounded exponential backoff; a capped attempt count; `failed_permanent` after the cap.
6. **Rate-limited** (SECURITY.md): a per-minute cap on outbound WhatsApp sends, enforced before the call, so a bug can't blast the number.

---

## 5. What gets sent, and how the owner controls it

### 5.1 Order/status notifications (the point of the feature)

| Trigger | Recipient | Message |
|---|---|---|
| Order placed (`new`) | `order.customer_phone` | Order number, item count, total, tracking link |
| `confirmed` | same | Confirmed + what happens next |
| `processing` / `packed` | same | Being prepared |
| `shipped` | same | Shipped + courier if known |
| `delivered` | same | Delivered + a note about returns |
| `cancelled` | same | Cancelled + reason if the admin entered one |
| Payment failed (card, PHASE 08) | same | Retry link |

Each is a **template row in the database**, editable by the owner (never raw HTML, per CLAUDE.md rule 8 / HANDOFF decision 8). Placeholders are a fixed, documented set (`{order_number}`, `{customer_name}`, `{total}`, `{currency}`, `{tracking_url}`, `{shop_name}`) missing a value renders empty rather than printing `undefined`.

### 5.2 Recipient number normalisation

`order.customer_phone` is free text at checkout. Convert to WAHA's `chatId` shape — digits only, no `+`, `@c.us` suffix — and validate it looks like a real number **before** queueing. Sri Lankan local format (`07x xxx xxxx`) must map to `94xxxxxxxxx`. If it can't be normalised, the row is marked `skipped_invalid_recipient` and surfaced in admin rather than retried forever.

### 5.3 Admin alerts and settings

- **Failure alert:** when a send exhausts its retries, or WAHA reports the session is not `WORKING`, the admin dashboard shows a persistent, dismissible alert with a count, the affected orders, and a **Retry** button (owner decision W5 — no email fallback).
- Session health is polled on the cron run and on demand, so a silently logged-out session is *noticed*.

### 5.4 Making the number editable from the website (decision W4)

Two different things are called "the number", and only one of them can be typed in:

| What | Where it's stored | Editable from admin? |
|---|---|---|
| The shop's **public** WhatsApp number (storefront click-to-chat, contact page, footer) | `store_settings` (`public.whatsapp_number`) | ✅ Yes — plain text field |
| The **alert recipient** for admins | `store_settings` (`notifications.admin_alert_number`) | ✅ Yes — plain text field |
| The **paired sending identity** (who messages come *from*) | Inside WAHA's session, created by scanning a QR | ⚠️ **Not by typing a number.** Requires re-pairing |

So the admin "WhatsApp" page provides:

1. **Session status** (STOPPED / SCAN_QR / WORKING / FAILED — **VERIFY** the full status list) and the last successful send.
2. **Connect / Re-pair** button → the server asks WAHA for the QR and renders it **through our own admin page** (`/admin/settings/whatsapp`), with a poll until it reports `WORKING`. The WAHA API key never leaves the server.
3. **Disconnect** (logout the session) and **Restart session**.
4. Editable text fields for the two numbers above, per-event toggles, and the message templates.

This satisfies W4 in the only way the technology allows: the owner never touches the WAHA container or its `.env`, but changing *which phone sends the messages* is a QR scan in the admin page — not a text box. If the owner wants the storefront number and the sending number to differ, that works too.

---

## 6. Configuration

**App-side env (names only; values never committed — `.env.example` already lists `WHATSAPP_*`):**

| Variable | Purpose |
|---|---|
| `WAHA_BASE_URL` | e.g. `https://waha.example.com` (server-only) |
| `WAHA_API_KEY` | `X-Api-Key` (server-only, secret) |
| `WAHA_SESSION` | session name from WAHA config (default `default`) |
| `WAHA_HOOK_HMAC_KEY` | verifies inbound WAHA webhooks (secret) |
| `SCHEDULED_JOBS_SECRET` | in `.env.example`; protects `/api/cron/*` |

**WAHA-side env on the VPS:** `WAHA_API_KEY`, `WAHA_DASHBOARD_USERNAME`, `WAHA_DASHBOARD_PASSWORD`, `WHATSAPP_HOOK_URL` (our `/api/webhooks/waha`), `WHATSAPP_HOOK_EVENTS`, `WHATSAPP_HOOK_HMAC_KEY`, `WHATSAPP_HOOK_RETRIES_POLICY`, `WHATSAPP_DEFAULT_ENGINE`, `TZ`.

**VERIFY at PHASE 06** — engine choice (`NOWEB` vs `WEBJS` vs `GOWS`; which is most stable for a low-volume order-notification workload), the current production install guide, WAHA version pinning and auto-update behaviour, and whether anything in our use needs WAHA Plus.

---

## 7. Security and the ban risk (stated plainly)

**Inbound webhooks** are treated like payment webhooks: verify the HMAC over the **raw body** before parsing, reject on mismatch, and record the event id — a duplicate is a 200 and a no-op (`webhook_events` uniqueness already exists in the schema).

**The app never exposes WAHA to the internet on your behalf** — no browser call to WAHA, no key in a client bundle, no proxying arbitrary paths.

**The ban risk is real and documented, and the owner has accepted it (W3):**

- WAHA's own homepage: *"WhatsApp does not allow bots or unofficial clients on their platform, so this shouldn't be considered totally safe."*
- A WAHA GitHub issue reports two numbers banned — one after ~1 month, another after 4 days of use.
- 2026 industry analysis claims **>90% of out-of-terms bans are permanent, with manual appeals no longer accepted**.
- Consequence to plan for: **the shop's customer-facing WhatsApp could stop working** — not just notifications. The notifications channel degrades; the order never does.

**Mitigations that cost nothing** (all inside this design):
1. **Order notifications only.** No bulk, no cold outreach, no marketing blasts — the behaviour that gets numbers banned.
2. **Rate limit + no retry storms** — bounded attempts with backoff, never a tight loop.
3. **Session health monitoring** so a logout is noticed instead of silently black-holing notifications.
4. **Modularity as insurance (W1/W6):** swapping to the official WhatsApp Business Cloud API later is one adapter + one settings row. That is the escape hatch if the number is ever banned.
5. **The admin can turn WhatsApp off** (`notifications.whatsapp.provider = 'none'`) without touching orders.

Also read WAHA's own "How to Avoid Blocking" page before pairing (VERIFY at PHASE 06) and follow it.

---

## 8. Local development and testing (can start now, no app code)

The owner wants to test locally first. This is a spike, not PHASE 06 work:

```bash
# 1. Image (ARM hosts: devlikeapro/waha:arm)
docker pull devlikeapro/waha

# 2. Generate the credentials .env  (WAHA_API_KEY, dashboard user/password)
docker run --rm -v "$(pwd)":/app/env devlikeapro/waha init-waha /app/env

# 3. Run it, persisting the session
docker run -it --env-file ./.env \
  -v "$(pwd)/sessions:/app/.sessions" \
  -p 3000:3000 --name waha devlikeapro/waha
```

Then: open `http://localhost:3000/dashboard`, start the `default` session, wait for `SCAN_QR`, scan with the shop phone, confirm `WORKING`.

```bash
# 4. Prove sending works (number WITHOUT +, with @c.us)
curl -X POST 'http://localhost:3000/api/sendText' \
  -H 'Content-Type: application/json' \
  -H "X-Api-Key: <WAHA_API_KEY>" \
  -d '{"session":"default","chatId":"94770090147@c.us","text":"Waseem Sports test"}'
```

**VERIFY before testing:** WAHA's quick-start command is explicitly labelled *"Not a Production-Ready Installation"* — fine for a local spike, but the VPS deployment must follow their production/security guide. Do not pair the **live shop number** to a throwaway local container that has no backups; test with the paired number only once the VPS is in place and the session volume is backed up.

**Test list for PHASE 06** (also the acceptance criteria):

| # | Test | Expected |
|---|---|---|
| 1 | Placing an order with a valid phone | Outbox row → sent → `sent` with a provider message id; customer receives it |
| 2 | Same order, cron runs twice | Second run sends nothing (dedupe) |
| 3 | WAHA container stopped | Send fails, retries with backoff, admin alert appears, **order is unaffected** |
| 4 | Session logged out / `SCAN_QR` | Admin page shows it; alert raised; retry button re-queues after re-pairing |
| 5 | Phone number in local `07x` format | Normalised to `94…@c.us` and delivered |
| 6 | Garbage phone number | `skipped_invalid_recipient`, visible in admin, not retried forever |
| 7 | Inbound webhook with a bad HMAC | Rejected, logged, no state change |
| 8 | Duplicate webhook event | 200 and no-op |
| 9 | 200 queued messages | Rate limit holds; no blast; no ban-triggering burst |
| 10 | Provider set to `none` | Nothing is attempted; no errors; orders unaffected |

---

## 9. Scope discipline (W6 — "don't overcomplicate")

**In:** one provider adapter, the outbox and retry job, DB-stored templates, the admin page (status, QR, numbers, toggles, failures), recipient normalisation, webhook receipt with HMAC, tests above.

**Out (deliberately):** a chat inbox for replying to customers, media/marketing broadcasts, chatbot/auto-replies, multi-number or multi-session routing, WhatsApp channels/status automation, a second notification channel, delivery-read analytics, n8n (banned by CLAUDE.md).

---

## 10. Open VERIFY items

| ID | Item | When |
|---|---|---|
| WA-V1 | Which engine (`NOWEB`/`WEBJS`/`GOWS`) is most stable for low-volume notifications | PHASE 06, before pairing |
| WA-V2 | WAHA production install + security guide, and the "How to Avoid Blocking" recommendations | PHASE 06 |
| WA-V3 | VPS provider, region, price, sizing (2 GB floor for Chrome) | PHASE 06 purchase |
| WA-V4 | Full session status list, and the exact QR-fetch endpoint shape in the current version | PHASE 06 |
| WA-V5 | Whether any feature we need sits behind WAHA Plus | PHASE 06 |
| WA-V6 | Sri Lankan number formats that must normalise to `94…` (mobile vs landline, 10-digit variants) | PHASE 06 |
| WA-V7 | Webhook event names/types we actually subscribe to | PHASE 06 |
