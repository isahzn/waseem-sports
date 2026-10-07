# Architecture

```
GitHub (code only) -> GoDaddy Node.js Hosting (Next.js app, persistent Node 22 process)
                          |-- Supabase Postgres (all business data, RLS, SQL functions) — HTTPS (443) ONLY
                          |-- Supabase Storage (images) — HTTPS only
                          |-- Supabase Auth (admin login) — HTTPS only
                          |-- Payment provider (TBD, HTTPS webhooks)   Email/SMS (TBD, HTTPS API only)
                          |-- WAHA on a VPS with Docker + HTTPS (WhatsApp; Supabase cannot host it)
GoDaddy = app host AND domain/DNS. Direct Postgres ports (5432/6543) and outbound
SMTP are unreachable from GoDaddy — every external call must be HTTPS over 80/443.
```
Deploying code never touches data. Data lives in Supabase and has its own backups.

## Hosting constraints (GoDaddy Node.js Hosting — DECISION D10)
- The app is a **persistent Node.js 22 process**, not serverless. Listen on `process.env.PORT`, bind `0.0.0.0`.
- **Egress allowlist: HTTP:80, HTTPS:443, GoDaddy managed MySQL.** No `pg`/Prisma/Drizzle direct connections (they need blocked ports); **only `supabase-js` (`@supabase/supabase-js` + `@supabase/ssr`) over HTTPS** — PostgREST, Auth, Storage and RPC all work over 443.
- **No outbound SMTP** (loopback gateway on 2525 is GoDaddy-internal only). Every email/SMS provider behind `Notifier` must expose an **HTTPS API** (DECISION D4).
- Deploy contract (VERIFY revision before first deploy, V3): root `package.json` with non-empty `name`/`version`/`main` (the `main` file must exist); `build` + `start` scripts; runtime packages in `dependencies`; lockfile committed, `node_modules` excluded; `.npmrc` on the public registry; **one app per upload**; zip ≤ 100 MB or connected GitHub repo; files that must survive deploys in `/public/assets/`; region (NA/EU) chosen before first deploy.
- Included by default: automatic HTTPS, Cloudflare-backed CDN, WAF, encrypted env vars, per-deploy malware/vulnerability scan.

## Tech choices (VERIFY current versions/docs before installing)
- Next.js **16** App Router + TypeScript strict (15 hits EOL 21 Oct 2026). Tailwind **v4 CSS-first `@theme`** (tokens: `docs/DESIGN-TOKENS.md`).
- `@supabase/supabase-js` + `@supabase/ssr` for auth cookies (HTTPS only — see above). zod for validation.
- sharp (image re-encode/resize) — Next already bundles/uses it; confirm.
- Rate limiting: **Postgres table** (DECISION D8) — no new vendor, no new port. VERIFY exact limits in PHASE 01 + configure Supabase Auth limits.
- Tests: Vitest (unit), Playwright (e2e), SQL tests for stock concurrency.
- No other frameworks unless justified in writing.

## Two Supabase clients (never mix)
| Client | Key | Where | Used for |
|---|---|---|---|
| `supabase/browser` | anon | client components | almost nothing (maybe auth UI) |
| `supabase/server` | anon + user cookies | server components/actions | storefront reads (RLS), admin reads/writes as the logged-in admin |
| `supabase/admin` | service role | `server-only` modules | place order, webhooks, notifications, audit logs, tracking lookup |

## Request flows
**Admin edit:** form -> server action -> zod validate -> `requireAdmin(role)` -> Supabase write -> `audit()` -> `revalidateTag()` -> storefront sees it.
**Add to cart:** cart lives in a cookie/localStorage as `[{variantId, qty}]` ONLY (no prices). Cart page calls server `priceCart()` which reads DB.
**Checkout:** server action `placeOrder`: validate -> re-price from DB -> shipping fee from `shipping_rules` -> generate tracking token (store sha256) -> RPC `place_order` (one transaction, idempotency key) -> enqueue notifications -> return order number + tracking URL. If card: create payment via provider, redirect; order stays `payment_status=pending` until a verified webhook.
**Order tracking:** `/track/[orderNumber]?t=<token>` -> server hashes token, matches hash+number, returns limited fields. Generic "not found" on any mismatch; rate-limited.
**Status change:** admin action -> validate transition -> update `orders` + `order_status_history` -> stock action (cancel => release; shipped => commit) -> audit -> enqueue notification.

## Allowed order status transitions (enforce in TS `orders/transitions.ts`)
new -> confirmed | cancelled | payment_failed; confirmed -> processing | cancelled; processing -> shipped | cancelled;
shipped -> delivered; delivered -> refunded; payment_failed -> new (retry) | cancelled. Cancel after shipped is not allowed (use refund).
If `cod.reserve_stock_on = 'confirmed'`: reserve on new->confirmed (may fail with INSUFFICIENT_STOCK -> show admin a clear error).

## Payment abstraction
```ts
interface PaymentProvider {
  code: string;
  createPayment(o: {orderId; amount; currency; returnUrl; idempotencyKey}): Promise<{providerTxnId; redirectUrl?}>;
  verifyWebhook(req: {rawBody: string; headers: Headers}): Promise<VerifiedEvent | null>; // signature check
  getStatus(providerTxnId: string): Promise<'pending'|'succeeded'|'failed'>;               // server-side re-verify
  refund?(...): Promise<...>;
}
```
`COD` is a provider with no redirect and no webhook. Webhook handler: verify signature -> insert `webhook_events` (unique provider+event_id; duplicate => 200 and stop) -> re-check via `getStatus` where supported -> transition payment state idempotently -> never trust browser return URL.

## Notification abstraction
```ts
interface Notifier { channel: 'email'|'sms'|'whatsapp'; send(msg): Promise<{ok:boolean; error?:string}> }
```
Outbox pattern: business code only inserts `notifications` rows (`dedupe_key` prevents duplicates). A cron route (`/api/cron/notifications`, protected by `SCHEDULED_JOBS_SECRET`) sends queued/failed rows with capped retries. Failure never affects the order. Templates live in DB settings or a templates table later.
WhatsApp sends via self-hosted **WAHA on a VPS** (DECISION D4/D28, `specs/whatsapp-waha-spec.md`); SMS/email send via HTTPS-API vendors. Failure policy: retry WhatsApp with backoff, then alert the admin in the dashboard — no email fallback (D27).

## Content / CMS
Page = row in `pages`; sections = rows in `page_sections` with `type` + JSON `content`. A registry `sections/registry.ts` maps `type -> {schema (zod), Component, editor form}`. Storefront renders the same components for preview (draft_content) and live (content). Publishing copies `draft_content -> content`. New section type = add to registry (code); new page/section instance = data only. Dynamic routes: `/[...slug]` for CMS pages, `/` renders page `home`.

## Image recommendation (Phase 9)
Server-only route, admin-only, rate-limited, cached. Builds queries from product name/brand/category (deterministic templates). Provider adapter (DECISION D6, VERIFY API). Prefer allowlisted manufacturer/distributor domains. Returns ~3 candidates with `sourceUrl`, thumbnail, dimensions, and a rights warning. Owner picks -> optional import: server fetches with SSRF protections (https only, block private/link-local IPs, size/time limits, re-encode with sharp), stores provenance in `product_images.source_*`. Failure => manual upload still works. No LLM.

## Caching
Storefront: server-render with `revalidateTag` on admin writes (tags: `products`, `product:{slug}`, `sports`, `categories`, `page:{slug}`, `settings`). Never cache anything containing orders/PII. Pagination on all lists (cursor or page/limit, max page size enforced). VERIFY whether GoDaddy's CDN caches `next/image` responses and whether multi-instance scaling desyncs the ISR cache (V6) — record the answer in PHASE 01.

## SEO
`generateMetadata` per route, canonical URLs, `sitemap.ts`/`robots.ts` built from DB, JSON-LD Product/BreadcrumbList. URLs: `/products/[slug]`, `/sports/[slug]`, `/categories/[slug]`, `/brands/[slug]`, `/search`. Filter/sort params -> `noindex` or canonical to base to avoid duplicate content.
