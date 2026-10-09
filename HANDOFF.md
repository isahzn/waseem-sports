# HANDOFF — read this first

> **Naming note for agents — do not overwrite this file.**
> This is the **original handoff package** for the project (client brief, decisions, risks).
> The agent's live session handoff lives in [`SESSION-HANDOFF.md`](SESSION-HANDOFF.md), and the
> Phase 00 plan of record is [`specs/phase-00-fix-spec.md`](specs/phase-00-fix-spec.md).
> A workspace rule says to write a session handoff to `handoff.md` in the project root — on
> Windows that resolves to *this* file, so writing it there would destroy this brief. Write
> session handoffs to `SESSION-HANDOFF.md` instead.

---

## Where we are right now — start here

> This status section is maintained by the agent; the brief below it is the client's and is not rewritten.

**Status 2026-10-08. Phases 00–10 are built and verified (see `docs/SECURITY-REPORT.md`),
PHASE 06 ships disabled pending a WAHA VPS and `PHASE 11`'s local half is done — every gate
and harness re-run green on the final tree, the runbook and owner guide written, and its two
remaining SHOP SCREENS proven live (create a page through the builder; host the section-field
XSS matrix). What is left needs the owner or a deployed host: a real `ADMIN_PASSCODE`, the real
delivery rules, products under Cricket/Tennis, and the PHASE 11 launch checks
(`phases/PHASE-11-production-qa.md`, `SESSION-HANDOFF.md`).**

| | |
|---|---|
| ✅ **Built and verified** | **00** audit + tokens · **01** foundation · **02** schema applied to the linked Supabase project and proven live (last-unit race, idempotency, commit math, full RLS matrix — `docs/RLS-MATRIX.md`) · **03** catalog + CMS admin · **04** storefront · **05** checkout → COD order → tokenized tracking + admin orders/shipping/dashboard · **07 (front end only)** a measured 1:1 replica of the canonical design, a multi-page storefront, `/admin` as its own area, and the landing-page section builder. Records: each `phases/PHASE-0N-*.md` § Execution record, decisions D1–D43 in `docs/DECISIONS.md`, the seed `scripts/seed-demo.mjs`. |
| ⚠️ **Temporary, by owner request** | `/admin` opens with one shared password (`ADMIN_PASSCODE`, D42) instead of an account. It is the whole admin surface (prices, stock, orders, publishing) — **before the site is public it must be a long random value or removed** (`docs/SECURITY.md`, `docs/DEPLOYMENT.md` pre-launch checklist). A passcode session also records `actor: null` in `audit_logs`, so the trail cannot name who acted; create the owner account per `DEPLOYMENT.md` step 2 when that matters. |
| ❓ **Needs owner** | Shop email (V1 — not findable online), opening hours (V2 — only an "open daily" signal found), checkout fields (D12), out-of-stock/low-stock (D11/D13), real delivery rules entered in `/admin/shipping` before launch (D5 — deliberately nothing is seeded), and approval of `specs/whatsapp-waha-spec.md` + `specs/product-image-pipeline-spec.md`. Decided earlier and holding: logo/video are real, `WS` prefix, reserve-on-placed with an admin toggle (D2), admin-managed shipping (D5) |
| ➡️ **Next action** | Owner actions, in this order: set a long random `ADMIN_PASSCODE` on the host (or remove it and use an account), enter the real delivery rules in `/admin/shipping` (D5), and decide Cricket/Tennis (add products or archive the sports). Then the PHASE 11 launch checks that need a host: full journeys on staging then production, mobile/accessibility/Lighthouse, live WhatsApp (needs the VPS + engine decision), a rehearsed backup restore, and headers/CSP as served by GoDaddy. `docs/RUNBOOK.md` is the operator's document for all of it. |
| 🚧 **Still open** | PHASE 11's launch half (host + owner actions above) and PHASE 06's provider work (WAHA VPS, engine choice, pairing — all stop-and-ask). Everything else is built, and PHASES 07–10's deferred proofs were closed on 2026-10-08. |
| 🧭 **Where the real detail lives** | [`SESSION-HANDOFF.md`](SESSION-HANDOFF.md) — per-session record, failed attempts, guardrails, next steps. Read it before this file's status table. |

---

## What we're building
Waseem Sports: sports retailer in Sri Lanka. Custom storefront + CMS + inventory + orders + owner dashboard.
Single business, clean code, reusable later. NOT multi-tenant, NOT a POS.

## Known from the client/dev conversations
- Stack: Next.js 16 (TS) + Supabase (Postgres/Auth/Storage, reached only over HTTPS) + **GoDaddy Node.js Hosting** for the app (owner decision 2026-10-06 — supersedes the old Vercel plan; see DECISIONS D10).
- Currency LKR. Palette: dark green + dark gold, premium, no emojis in product visuals, nothing cartoonish, strong typography.
- Multi-page site. Owner-friendly admin. Analytics dashboard (light).
- Notifications: WhatsApp via self-hosted WAHA on a VPS (owner decision 2026-10-06, ban risk accepted); SMS/email via HTTPS-API vendors, provider TBD. Outbox + retry; failure never affects the order (DECISIONS D4/D27/D28).
- Canonical design: `design/waseem-sports-video.html` (owner decision 2026-10-06). Reuse it; convert to components. Superseded designs archived under `design/unwanted-designs/`.
- 11 real product photos exist in the canonical HTML (base64 JPEGs, positional mapping — eye-confirm in PHASE 04). Photos kept per owner; admin crop + baked-text auto-detect/auto-crop queued for PHASE 04 (D20). `Background.mp4` (confirmed hero clip, byte-identical to the inlined video) and `Logo.png` (confirmed brand logo) are real per owner 2026-10-06.
- Dev budget is tight => build in vertical slices, MVP first.

## Decisions I made (change only with the user's OK)
1. Every product has >=1 variant; "simple" product = one hidden default variant. Same code path for stock/cart/orders.
2. Homepage = the `pages` row with slug `home`. One CMS system, not two.
3. No customer accounts. Guest checkout + order tracking via `order_number + secret token` (token stored hashed).
4. No `customers` / `customer_addresses` tables for now (would be dead weight without accounts). Contact + address are snapshotted on the order. Add later with accounts.
5. Stock model: `available = on_hand - reserved`; changed only by SQL functions (`place_order`, `adjust_order_stock`).
6. Notifications use an outbox table + retry job; providers behind an interface.
7. Section content = validated JSON per section type (zod), not free HTML.
8. Descriptions are plain text/markdown, sanitized. No raw HTML from the CMS.

## Conflicts with earlier notes (flagged, not silently resolved)
- Earlier note said "accounts" + "GoDaddy hosting". Guest checkout stands (D9); **hosting is GoDaddy Node.js Hosting** — decided with the owner 2026-10-06 (D10), master-spec Vercel plan superseded.
- "Temu-style" (dense, visual, scrolling ads) vs "serious premium retailer". Follow the HTML design; keep density in product grids/promos, keep the premium typography and restraint.
- Scope is large for the stated price/AI budget. Ship in this order: **MVP = phases 0-5** (catalog, cart, COD checkout, orders, admin). Then 6 (notifications), 7 (page builder), 8 (cards), 9 (image search), 10-11 (hardening/QA). Don't start 7-9 before 0-5 are solid.

## Biggest technical risks
1. Overselling / inconsistent stock => only via SQL functions; test with concurrent purchases.
2. Trusting client prices/payment status => server recomputes; webhooks verified; no "success URL = paid".
3. RLS mistakes leaking orders/PII or letting anon write => test every table as anon, customer, admin.
4. Service-role key leaking to the client => server-only modules (`import "server-only"`), grep in CI.
5. Malicious uploads / SSRF via image import => re-encode with sharp, allowlist domains, block private IPs.
6. Cost abuse (image search, notifications, checkout spam) => rate limits + caching + quotas.
7. Payment provider unknown => build the abstraction + COD first; card only after provider is chosen AND docs verified.
8. Data loss => Supabase backups configured and a restore actually tested before launch.

## How the agent should proceed
Phase files are in `phases/`. Do them in order. Each has tasks, acceptance criteria, and "stop and ask" points.
Never skip PHASE 00 (audit the HTML + any existing repo before writing code).
