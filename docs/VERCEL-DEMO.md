# Vercel demo — setup and the problems to expect

Written 2026-10-08 for showing the finished shop to the owner on a Vercel URL.
Everything here is about a **demo**, not a launch: `docs/DEPLOYMENT.md` remains the GoDaddy plan
of record, and PHASE 11 is where the real launch checks live.

---

## 1. Import and deploy

1. Vercel → **Add New → Project** → import `isahzn/waseem-sports`, branch **main**.
2. Framework preset: **Next.js** (auto-detected). Build command `next build`, output default.
   Root directory: the repo root. **No start command** — `server.js` is only for GoDaddy's
   persistent-container hosting; Vercel runs the Next app itself and ignores it.
3. Add the environment variables below for **Production** (and Preview if you want both), **before
   the first build**, then deploy. First build takes roughly 2–4 minutes.

The app is serverless-safe: sessions are stateless HMAC cookies, the cart is a cookie, rate
limiting is backed by the `rate_limits` Postgres table, and there is no in-memory state that has to
survive between requests.

## 2. Environment variables

| Variable | Needed | Why / what breaks without it |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | **Required** | Set it to the deployed URL, `https://<project>.vercel.app`. Baked at build time into `sitemap.xml`, `robots.txt` and `metadataBase` — if it is unset, those point at `http://localhost:3000`. It is also what decides the admin cookie's `Secure` flag, so it must start with `https://`. |
| `NEXT_PUBLIC_SUPABASE_URL` | **Required** | The storefront's data. Inlined into client bundles at build time, so it must exist *before* the first build. Missing/blank → the catalog comes back empty. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Required** | Same as above (public key; safe to expose, RLS constrains it). |
| `SUPABASE_SERVICE_ROLE_KEY` | **Required for /admin** | Admin reads and writes use it server-side. Missing → admin screens fail, and rate limiting silently falls back to per-instance memory (useless on serverless). Server-only: never `NEXT_PUBLIC_`, never in the browser. |
| `ADMIN_PASSCODE` | **Required for the demo** | Without it `/admin` falls back to the Supabase **account** login, and the project has **zero auth users** — so nobody, including you, could get in. |
| `ADMIN_SESSION_SECRET` | Recommended | Signs the admin cookie. Without it the key is derived from the passcode, which still works but cannot be rotated separately. |
| `ORDER_TRACKING_SECRET` | Recommended | Peppers the order-tracking token hash. Without it token hashes are unsalted (logged as an error in production); tracking still works. |
| `WAHA_URL`, `WAHA_API_KEY`, `WAHA_HOOK_HMAC_KEY` | Leave empty | No WhatsApp provider is connected (D4/D33). Empty = every notification channel stays `none`; orders record `skipped` rows. Nothing is attempted. |
| `PAYMENT_PROVIDER`, `PAYMENT_API_KEY`, `MOCK_BANK_*` | Leave empty | Bank transfer stays switched off with no provider. |
| `IMAGE_SEARCH_*` | Leave empty | Admin image search stays in its disabled state (D6 open, no provider key). |
| `SCHEDULED_JOBS_SECRET` | Only for cron | `/api/cron/notifications` needs it. Nothing to schedule while notifications are disabled. |

`.env.example` in the repo lists the same keys. Never paste real values into the repo, a ticket or a
chat.

## 3. What to click in front of the owner

Home (Shop by sport tiles) → tap Cricket to show the honest empty page → search **badminton** (finds
the Yonex racket) → a product → add to cart → cart/checkout as a guest → **place an order** → open
the confirmation link → `/admin` with the passcode → **Sports** (tile photo, homepage switch,
reorder) → **Pages → Home** (add/hide the Shop-by-sport block) → **Orders** (the order you just
placed) → **Shipping** (where the real delivery rules go).

## 4. Problems and risks — read this part

### P1 · The admin area will be public, behind a 5-character password — **fix before sharing the link**
`/admin` is reachable by anyone who has the URL, and the current `ADMIN_PASSCODE` in the local
`.env` is five digits long (the value is deliberately not repeated in this tracked file).
On a public `vercel.app` URL that is a door, not a lock: a stranger could edit products, prices and
the homepage. Set a long random passcode in Vercel (or point the demo at a throwaway Supabase
project). This is the single highest-risk item for a public demo.

### P2 · The demo writes to the real database
There is no staging project, so a demo checkout creates a **real order** and decrements real stock.
That is fine for showing the owner, but place the demo order yourself first and then happen, and
clean up afterwards in `/admin/orders` (cancel/archive) so the shop's order list starts clean. If
you would rather nothing persisted, create a second free Supabase project, run
`supabase/migrations/*.sql` + `scripts/seed-demo.mjs` against it, and point the Vercel env vars
there instead.

### P3 · ~~A cart with items logs a React console error~~ — **fixed 2026-10-08**
With items in the cart, `/checkout`, `/track`, `/cart` and `/contact` (and `/`) used to log React
hydration error `#418` once per load. The cause was the header cart badge: its count comes from the
`refreshCart` server action, which could resolve while React was still hydrating. The count is now
gated behind a hydration-safe hook (`src/lib/storefront/use-hydrated.ts`) in each component that
renders it. Verified with a real cart cookie: **zero console errors across five routes, three runs**
(`.tmp/w-hydrate.mjs`), and the browser pass is **45/45**. Full detail: `docs/SECURITY-REPORT.md` §4.1.

### P4 · The FAQ quotes delivery fees the owner never set
The FAQ reads live `shipping_rules`: **"Colombo and suburbs LKR 450 · 1–2 days"** and
**"Islandwide LKR 700 · 3–5 days"**. Those numbers came from the demo seed. The fake
"free over LKR 10,000" promise is gone (the threshold was cleared), but the fees themselves are
still unconfirmed. Decide before the demo: enter the real rules in `/admin/shipping`, archive the
rules, or expect the owner to ask about them (D5 is still open).

### P5 · Cricket and Tennis lead to empty pages on purpose
Both sports are visible and promoted because the owner named them as main sports, but the shop has
no cricket or tennis products. The pages say "Nothing here yet" — deliberately, rather than
inventing stock. Hide them with one click each in `/admin/sports` if you would rather not show an
empty category, or add products before the demo.

### P6 · Notifications, transfers and image search are all switched off
That is the shipped state, not a defect: no WhatsApp provider, no bank provider, no image-search
key. In the admin these screens say so plainly. Nothing pretends to work, and no "demo/mock"
wording is shown to customers. Do not promise the owner live WhatsApp order updates — that needs a
VPS and a WAJI/WPPConnect pairing decision (PHASE 06's remaining work).

### P7 · Nothing runs on a schedule
Vercel does not call `/api/cron/notifications` unless you add a `vercel.json` cron entry (and
`SCHEDULED_JOBS_SECRET`). With notifications disabled there is nothing to schedule, so this is only
a note for later.

### P8 · Two heavy files are served from `/public` (nit)
`/assets/bg.mp4` (3.2 MB, the page backdrop) and `/assets/logo.png` (1.25 MB, used as the favicon).
Both work on Vercel; the favicon is far bigger than it needs to be and is worth shrinking later.
Neither blocks the demo.

### P9 · First-build order matters
`NEXT_PUBLIC_*` values are inlined at build time. If you add them *after* the first deploy, you must
redeploy (not just restart) or the site keeps the blank/localhost values. Symptom summary: empty
catalog → Supabase URL/anon key; broken product images → Supabase URL; sitemap/robots pointing at
localhost → `NEXT_PUBLIC_SITE_URL`; admin login screen showing an email/password form with no
account → `ADMIN_PASSCODE` missing.

### P10 · The admin password is a launch blocker, not just a demo one
That five-digit passcode must be replaced before the shop takes real orders. Changing it without changing
`ADMIN_SESSION_SECRET` leaves existing sessions valid — rotate both if you ever suspect the
passcode leaked.

## 5. What is still unproven
Headers/CSP as served by the real host (Vercel applies the `headers()` from `next.config.ts`, but
that has not been measured on a deployed URL), live WhatsApp delivery, backup restore, and the
PHASE 11 journey tests. Nothing in the local harness runs (`.tmp/phase10/`, gitignored) proves
anything about a deployed environment.
