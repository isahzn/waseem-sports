# Unresolved business decisions

Status key: **DECISION REQUIRED** = ask the owner. Build a config point; don't silently pick.

| ID | Question | Config point | Interim behavior |
|---|---|---|---|
| D1 | Ship Sri Lanka only or worldwide? | `shipping_rules` rows (country_codes) | Data-driven; storefront only offers destinations that have an active rule. Seed none. |
| D2 | COD: reserve stock when placed, or when confirmed? | setting `cod.reserve_stock_on` = `placed`/`confirmed` | **DECIDED 2026-10-06:** `placed` (agent recommendation accepted — oversell-safe). Admin toggle with plain-language choice in the PHASE 05 admin shipping page; server-enforced, never client-decided. |
| D3 | Card payment provider (Sri Lanka)? | `PaymentProvider` interface | COD only until chosen. **VERIFY** provider availability, API, webhooks, fees. |
| D4 | Notification providers (SMS, email, WhatsApp)? | `Notifier` interface | **WhatsApp DECIDED 2026-10-06:** self-hosted WAHA on a VPS (Supabase cannot host it) — see `specs/whatsapp-waha-spec.md`. Email/SMS vendors must expose an **HTTPS API** (GoDaddy blocks SMTP). Sending stays disabled until configured; failure policy is retry-WhatsApp + admin alert, no email fallback (D29). **VERIFY** email/SMS vendor APIs (V10). |
| D5 | Shipping fees/thresholds/ETAs? | `shipping_rules` | **DECIDED 2026-10-06:** fully managed in the admin shipping page (PHASE 05 amendment). None seeded — owner enters real rules before launch. |
| D6 | Image search provider + budget? | provider adapter | Phase 9 only. **VERIFY** current APIs/pricing/terms. |
| D7 | Returns/refunds policy and who can refund? | pages + order statuses | `refunded` status exists; no automatic refund logic. |
| D8 | Rate-limit store: Postgres table vs hosted KV? | `RATE_LIMIT_PROVIDER` | **Recommended 2026-10-06:** Postgres table (no new vendor/port). Confirm in PHASE 01 + configure Supabase Auth limits (**VERIFY** V5-adjacent). |
| D9 | Customer accounts wanted at all? (early notes said "accounts") | future tables | Guest checkout + tracking only. |
| D10 | Hosting: Vercel (spec) vs GoDaddy hosting (early note)? | deployment | **DECIDED 2026-10-06:** app on **GoDaddy Node.js Hosting** (persistent Node 22, `process.env.PORT`, HTTPS-only egress); **Supabase** stays database/auth/storage over port 443 only. Start on the free preview tier, buy Deluxe when staging is needed (D30). **VERIFY** deploy-contract revision before first deploy (V3). |
| D11 | Out-of-stock display: show as sold out or hide? Allow backorder? | setting | Show "Out of stock", no backorder. |
| D12 | Required checkout fields (email optional? phone format? district?) | settings | Name, phone, address required; email optional. |
| D13 | Low-stock threshold default | `inventory.low_stock_threshold` | 5 per variant, editable. |
| D14 | Tax/VAT display? | settings | None; prices treated as final. |
| D15 | Analytics dashboard scope (early note mentioned analytics) | admin | Simple: orders/revenue/top products/low stock. No external analytics yet. |
| D16 | Legal pages (privacy, terms, returns) content | CMS pages | Owner supplies; create as pages. |

## Decided in Phase 00 (2026-10-06 — do not re-litigate; reverse by new entry here)

| ID | Decision | Detail |
|---|---|---|
| D17 | Canonical design: `design/waseem-sports-video.html` | Everything else archived to `design/unwanted-designs/` (moved, never deleted; gitignored). Audit: `docs/AUDIT.md`; tokens: `docs/DESIGN-TOKENS.md`. |
| D18 | Contact facts seeded from research | `130/6 Golden Plaza, Main Street, Colombo 11` · `077 009 0147` · `075 613 0147` · WhatsApp `077 009 0147` (primary hotline; confirm in admin). All contact settings admin-editable. Email + opening hours NOT seeded — see D32. |
| D19 | Product photos kept; missing photo = neutral block | The 11 design photos stay. Storefront shows a neutral "no photo yet" block when a product has no image — never a broken image. |
| D20 | Admin photo crop + baked-text detection | Auto-detect → auto-crop, owner can adjust; **product photos only**; lives in PHASE 04. OCR approach (browser vs server) is VERIFY V7 — behaviour chosen, implementation not. |
| D21 | Order-number prefix `WS` (D-NEW-1 — DECIDED 2026-10-06: keep `WS`) | Seeded; editable in admin; falls back to `ORD` if the setting row is ever absent. |
| D22 | Max quantity per variant: 100 | Was a magic constant in `place_order`; now setting `order.max_qty_per_variant` = `100`. Owner can change it without a migration. |
| D23 | Blank contact values are hidden, never rendered | Until email/hours are filled in admin, the storefront omits those rows (no empty labels, no placeholder text). |
| D24 | Skills live at the workspace root | No project `skills/` copy; use workspace-root skills (`.agents/skills`, `.claude/skills`). |
| D25 | `0001_init.sql` edited in place — once | It had never been applied anywhere. From the first real apply, never-edit-applied-migrations binds; further changes are `0002_*.sql`. |
| D26 | GoDaddy plan path: free preview → Deluxe | Prove the build on the free preview tier (PHASE 01); buy Deluxe when a real staging app is needed (Economy allows only 1 published app). Region (NA/EU) chosen before first deploy. |
| D27 | Notification failure policy | Retry WhatsApp with backoff, then alert the admin in the dashboard. No email fallback (owner's choice). An order is never affected by a notification failure. |
| D28 | Sending number = the shop's own WhatsApp | Ban risk explicitly accepted by the owner; mitigations + swap-out path in `specs/whatsapp-waha-spec.md` §7. QR re-pairing happens in the admin page (the number is the WAHA session identity — it cannot be typed in). |
| D29 | Product-image normalisation | Normalise by default (auto-rotate, trim, 1:1 crop, sRGB, strip EXIF, deterministic derivatives); cut-out is opt-in per product, browser-run, revertible. No AI-generated/upscaled product imagery. See `specs/product-image-pipeline-spec.md` (draft). |
| D30 | Scheduled jobs: Supabase `pg_cron` → app over HTTPS | `/api/cron/*` guarded by `SCHEDULED_JOBS_SECRET`. VERIFY `pg_cron` + `pg_net` on the chosen plan (V4); in-process timer is the documented fallback. |
| D31 | `orders.customer_phone` index kept (V12 interim) | Fast support lookup wins for a single shop; re-decide with the owner in PHASE 02 if privacy review says otherwise. |
| D32 | Contact research round 2 (2026-10-06, owner asked to "find it") | Web search (Facebook/Instagram/TikTok posts) | **Email: not found anywhere — owner must supply it (V1 stays VERIFY). Hours: no times published**; only signal is a "365 Days Open" reel (open daily, contradicting the mockup's "Poya closed") — times stay VERIFY (V2). **New unconfirmed candidates — do NOT seed, confirm with owner:** landline `011 254 3980`; alternate WhatsApp `075 613 0247` (one post lists it instead of `077 009 0147`); alternate address `88 Main Street, Colombo 11` (2023 new-showroom post) plus recent "Waseem Sports Premium" opening posts. If the owner confirms any, add as `public.*` settings (admin-editable) in the Phase 01/03 pass. |

Full VERIFY / ASK register (V1–V12, WA-V1…V7, IM-V1…V8, D2/D5/D7/D11–D16/D-NEW-1): `specs/phase-00-fix-spec.md` §8. The questions that shape storefront content (V1 email, V2 hours, V8 logo/video, D5 shipping rules, D2 reserve policy) go to the owner at the Phase 00 review.

## Decided after Phase 01 (2026-10-06 — do not re-litigate; reverse by new entry here)

| ID | Decision | Detail |
|---|---|---|
| D33 | Unconfigured providers never block progress | SMS / email / WAHA / image-search ship as interface + disabled `none` state when unconfigured (PHASE-06/09 amendments 2026-10-06). Outbox records `skipped`, orders unaffected, admin shows "not configured". Live proof deferred to the phase where the provider arrives. |
| D34 | Storefront stock **counts** are read server-side, never through a new anon policy | `inventory` stays anon-invisible by design (§5.10); the public projection `variant_availability` exposes status only. The count needed to cap a quantity or say "only N left" comes from `src/lib/storefront/availability.ts` — server-only, service role, filtered to active variants of published, non-deleted products, and a missing row means *unknown* (never *zero*, so an infra failure cannot fake an out-of-stock). `place_order` remains the authoritative gate. Discovered 2026-10-07: Phase 04's anon read made every cart line look out of stock. |
| D35 | `supabase/seed.sql` is part of "the project is set up", not an optional extra | Verified 2026-10-07 that the linked dev project had an empty `store_settings`, so order numbers generated as `ORD…` instead of `WS…` (D21), the per-variant cap fell back to 100, and the storefront had no contact rows. The seed is now applied (insert-only, matching the file's `on conflict do nothing`) and any new environment must apply `0001+` migrations **and** `seed.sql` before it is called ready. |
