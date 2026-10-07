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

**Phase to start at: PHASE 03 — PHASE 02 EXECUTED 2026-10-06.**

**Where we left off (execution session: 2026-10-06):** Phase 02 done and proven live — migrations `0001` (FK-order fix) + `0002` + new `0003_publish_page` applied, last-unit race won by exactly one buyer (`INSUFFICIENT_STOCK` for the loser), idempotency + commit math + negative-stock rejection + full RLS matrix verified, DB types generated, demo seed applied (see `phases/PHASE-02-database.md` § Execution record + `docs/RLS-MATRIX.md`). First owner creation still pending. Still awaiting owner input: spec §11 answers + the two feature specs; they do not gate Phase 03.

| | |
|---|---|
| ✅ **Done (Phase 00)** | `docs/AUDIT.md` · `docs/DESIGN-TOKENS.md` · design reorganisation into `design/unwanted-designs/` · package repairs (`.gitignore`, `design/README.md`, `AGENTS.md` title, `FOLDER_STRUCTURE.md`) · `docs/DATABASE.md` corrections + `docs/DECISIONS.md` D4/D8/D10/D17–D31 · hosting rewrite GoDaddy (ARCHITECTURE/DEPLOYMENT/DESIGN/FOLDER_STRUCTURE/README) · migration hardening + `seed.sql` contacts · crop-feature record (D20 + PHASE 04) · two commits |
| ❓ **Needs owner** | Shop email (V1 — not findable online, owner must supply), opening times (V2 — only "open daily" signal found), checkout fields (D12), out-of-stock/low-stock (D11/D13), extra contact candidates (D32: landline, alt WhatsApp, 88 Main St) + approval of `specs/whatsapp-waha-spec.md`, `specs/product-image-pipeline-spec.md`, and the §5 recommendations. Decided 2026-10-06: logo/video real (V8), keep `WS` prefix, reserve-on-placed + admin toggle (D2), admin-managed shipping (D5) |
| ➡️ **Next action** | Start PHASE 03 (`phases/PHASE-03-cms.md`): catalog + CMS admin (sports, categories, brands, products, pages); create the first owner first (DEPLOYMENT.md step 2); owner still owes spec §11 answers + feature-spec approvals (non-blocking) |
| 🚧 **Also still open** | The whole of PHASE 01 onward. The MVP is PHASES 0–5 (catalog, cart, COD checkout, orders, admin); do not start 6–11 before those are solid |

Full detail — the 13-step status table, the decisions already locked, the failed attempts and the guardrails — is in **[`SESSION-HANDOFF.md`](SESSION-HANDOFF.md)**.

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
