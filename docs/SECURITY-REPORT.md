# Security report — Waseem Sports

Owner: Waseem Sports · Environment tested: local production build (`NODE_ENV=production`, port
3100) against the linked Supabase project · Date: 2026-10-08.

This report covers two passes:

1. **PHASE 10 hardening** — adversarial review of the admin, the API and the database, with the
   fixes it produced.
2. **The correction pass** (2026-10-08) — the owner's own list of fixes to the finished build,
   including one security-relevant change (admin-only routes for money movement) already covered
   by (1), plus the verification for a **new upload path** added in that pass.

Every claim below is the result of a command that was run; the harnesses live in `.tmp/phase10/`
and are re-runnable. Nothing here is inferred from "the code looks right".

---

## 1. What was fixed, and why it mattered

| # | Issue | Fix | Where |
|---|---|---|---|
| 1 | **Rate-limit bypass.** `clientIp()` read the *first* `x-forwarded-for` entry, which is attacker-supplied. Sending a random value per request gave a fresh bucket every time, so every rate limit (login, checkout, uploads, tracking) was trivially bypassable. | Read the **last** entry, the one the trusted proxy appended. | `src/lib/security/ratelimit.ts` |
| 2 | **Open redirect** in CMS links. `hrefField` accepted `//evil.example`, which looks like an internal path but the browser treats as external. An owner-set (or later-compromised) hero slide could bounce shoppers off-site. | Reject protocol-relative URLs; internal links must be a single leading `/`. | `src/lib/cms/sections.ts` |
| 3 | **CSS injection** through a stored hero gradient. The value is interpolated into a React inline style, so `url(...)`, `expression(...)`, `@import`, `javascript:` and `data:` had to be refused. | Allow only a plain `linear-gradient(...)`/`radial-gradient(...)`, no `url(`/`expression(`/`@import`/angle brackets. | `src/lib/cms/sections.ts` |
| 4 | **Unbounded webhook body.** The WhatsApp webhook read the whole request body before checking anything — a memory-exhaustion vector on a public endpoint. | 256 KB raw-body cap, answered `413`. | `src/app/api/webhooks/waha/route.ts` |
| 5 | **Secret in a URL.** The notification cron accepted `?secret=`, which lands in access logs, referrers and browser history. | Query-string auth removed; header/`Bearer` only. | `src/app/api/cron/notifications/route.ts` |
| 6 | **Money movement was reachable by any admin session.** Staff could create, confirm and settle bank transfers, and change WhatsApp settings. | `requireAdmin(["owner"])` on transfer create/confirm/status, WhatsApp settings actions and the image-search allowlist. Staff get `403`; the read-only quote endpoint stays open to staff. | `transfers/*`, `settings/whatsapp/actions.ts`, `settings/image-search/actions.ts` |
| 7 | **No CSP.** A single missed escape anywhere became script execution. | Enforced CSP in `next.config.ts`: `default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`, scripts self + inline (Next's bootstrap), images `https:`, media `blob:`, connect to `*.supabase.co`. | `next.config.ts` |
| 8 | **Known runtime CVE** in `sharp`. | `^0.34` → `^0.35.5`; PNG→WebP round trip re-verified through the upload pipeline. | `package.json` |
| 9 | **Login page baked at build time.** `ADMIN_PASSCODE` could not be set or cleared without a rebuild — an operator changing it would have seen no effect and could believe the gate had moved. | `export const dynamic = "force-dynamic"` on `/admin/login` (now `ƒ Dynamic` in the build output). | `src/app/(auth)/admin/login/page.tsx` |

### Verified side effects

- **RLS is still the second layer.** Anonymous reads return **0 rows across 11 tables**, and
  anonymous writes to catalog/order/storage are denied (not silently ignored) — `h1-live.mjs`.
- **Stock is still SQL-only.** The storefront's availability projection exposes a *status*, never a
  quantity.
- **The order-tracking link is still unguessable.** Order lookups with a wrong or absent token
  return `404`, with no difference in response time between "no such order" and "wrong token".
- **Wrong admin passwords leak nothing.** Eleven distinct wrong passcodes all answer
  `Incorrect password.` — identical text, no length or format hint — `h2-authed.mjs`.
- **Login rate limiting works.** 10 attempts / 15 minutes / IP; the limiter's refusal is
  indistinguishable from a wrong password to the caller (it is logged as `login rate-limited`).
  This was observed accidentally and is recorded because it is a real control, not a nuisance:
  see §4.7 for how it affects test runs.

## 2. What was NOT fixed, and why

| Left as-is | Reason |
|---|---|
| `npm audit` still reports **high** severity advisories | They are all in the **devDependency** chain `eslint-config-next → … → braces`; no runtime code path uses them. `sharp`'s runtime advisory was fixed (#8). |
| The passcode session is treated as the **owner** role | By design (D42): the shared password *is* the owner's login, and there is no staff identity behind it. The staff/owner split only exists for real accounts, which is what `h3-staff.mjs` proves. |
| Delivery fees and lead times on `/faq` | They are **data**: rows in `shipping_rules`, editable in `/admin/shipping`, not hardcoded copy. The owner still has to enter the real ones (D5). See §4.3. |
| `ws_admin` cookie value is reused as the passcode session | It is HMAC-signed, `httpOnly`, `SameSite=Lax`, `Secure` when the site is https, with a 7-day expiry — see `src/lib/auth/passcode.ts` for the reasoning spelled out. |

## 3. Evidence — harnesses and results

All runs are against the production build. Admin access is minted from `ADMIN_SESSION_SECRET`
(HMAC) or a real sign-in; no password is typed by the harness except the deliberate wrong-password
matrix, and no secret is printed.

| Harness | What it proves | Result |
|---|---|---|
| `.tmp/phase10/h0-pure.mjs` | Unit-level invariants (parsing, validation, cookie/cart, money formatting) | **40 / 40** |
| `.tmp/phase10/h1-live.mjs` | Live HTTP + DB: security headers and CSP, cron query-secret rejected / header accepted, unsigned WAHA webhook `401`, tracking rate limit, order privacy `404`s, RLS anon 0 rows over 11 tables, anon catalog/order/storage writes denied, no quantities in the availability projection | **39 / 39** |
| `.tmp/phase10/h2-authed.mjs` | Authed admin surface: 11 wrong passcodes with no oracle, correct one opens `/admin`, upload malice matrix (exe/content-typed-svg `415`, corrupt png `422`, truncated jpeg `422`, ≥10 MB `400`, traversal-named exe `415`, honest png `201` → `products/<uuid>.webp`), crop editor `422/404/403` | **29 / 29** |
| `.tmp/phase10/h3-staff.mjs` | A real `staff` account (Supabase Auth + `admin_users`) vs owner-only enforcement: quote `200` (proves the session works), create/confirm/status `403` **and no row written**, WhatsApp settings save refused with no value changed, anon `401`, cleanup of its own account | **15 / 15** |
| `.tmp/phase10/h4-sport-image.mjs` | The **new** sport-photo upload path, same malice matrix: empty, executable, SVG-with-script, HTML, PHP, corrupt png, truncated jpeg, random bytes, 7000px side, >10 MB — all rejected with the right status; honest PNG accepted, stored as `sports/<uuid>.webp`, publicly readable, verified WebP magic, no EXIF payload; product-namespace paths are never deleted by the sport cleanup | **18 / 18** |
| `.tmp/phase10/correction-check.mjs` | The owner's own fix list end to end (search, store structure, admin separation, claim removal, contact links, no prototype wording) + 10 hostile inputs | **47 / 47** |
| `.tmp/phase10/shop-by-sport-check.mjs` | "Shop by sport" is admin-editable and the storefront follows: tiles render and are ordered, per-sport promotion off removes that tile on the next request, hiding the block removes it from the homepage, restoring puts it back, admin screens expose name/photo/order/promotion, anon never sees or reaches them | **38 / 38** |
| `.tmp/phase10/browser-pass.mjs` | Real Chrome: customer walk (phone-width layout, tiles, search typed into the header, add-to-cart, cart/checkout/track as a guest, contact links, no broken links, no admin link) and admin walk (7 screens load clean, sports screens expose the edits, builder shows the block) | **44 / 45** — the one failure is §4.1 |

`npm run typecheck` (0 errors), `npm run lint` (0 errors; 5 pre-existing warnings, 4 of them unused
`eslint-disable` directives) and `npm run build` (exit 0) all pass on the final tree.

## 4. Residual risk and open items

### 4.1 Cart hydration error (open, low severity, not root-caused)
With **items in the cart**, the production build logs React error `#418` (hydration text mismatch)
once on `/checkout`, `/track`, `/cart` and `/contact`. The rendered page is correct — no wrong
price, no wrong count, and the walk passes every functional check on those pages — but every
customer with a non-empty cart gets an error in the console on each page load.
Reproduce: `.tmp/phase10/dbg-diff.mjs` (sets a real cart cookie, loads the page in Chrome, diffs
what the server rendered against what the browser shows).
The only cookie-derived text on those pages is the header cart badge, which is the leading suspect;
the root cause was **not** confirmed, and a speculative patch to the cart would risk a working
checkout, so it is reported rather than guessed at. Fixing it needs the dev-mode React diff, which
this environment could not reproduce (dev-mode repro attempts produced no warning).

### 4.2 `ADMIN_PASSCODE` is still too short
`.env` holds a 5-character passcode. It is HMAC-signed and rate-limited, but it is a launch
blocker: set a long random one before the shop goes live (it is on the pre-launch checklist in
`docs/DEPLOYMENT.md`).

### 4.3 Delivery claims are now data, and the data is still a placeholder
The literal mockup claim ("Island-wide free delivery over Rs. 10,000") is gone from the code, the
seed and the live rows: the free-delivery threshold was cleared on both seeded shipping rules, so
no page promises free delivery any more. What remains — "Colombo and suburbs LKR 450, Islandwide
LKR 700, 1–2 / 3–5 days" — is read live from `shipping_rules`. Those numbers are the seed's, not
the owner's. **The owner must enter the real rules in `/admin/shipping`, or archive the rows.**
Until then the FAQ quotes prices the shop has not confirmed; that is a business decision, and
deleting the rows would leave checkout with no shipping option at all.

### 4.4 Cricket and Tennis have no products
Both sports were created (visible, promoted, ordered) because the owner named them as main sports.
Neither has products, so their pages and tiles are honest empty states ("Nothing here yet"). No
placeholder stock was invented. They can be archived from `/admin/sports` with one click if the
shop does not actually carry them. The live database also has no *categories* for them, so they do
not appear in the `/shop` chip row; the demo seed lists them, so a fresh seed would add the
categories.

### 4.5 Not verifiable from this machine
Everything below needs the deployed host, and none of it is proven by the runs above:
- security headers and CSP **as served by GoDaddy/Cloudflare** (a CDN can rewrite headers, and
  Cloudflare's own `CF-Connecting-IP` handling is what `clientIp()` should follow in production —
  the code carries that note);
- real WhatsApp delivery (no provider is configured; WAHA env vars are empty);
- backup restore, and the scheduled jobs on the host's scheduler;
- PHASE 11 journey tests against staging (there is no staging environment).

### 4.6 Test-only artifacts in the live database
`TEST-DEMO-BALL` and `TEST-DEMO-SHOE` products exist as **archived + soft-deleted** rows (their
variants are still `is_active`). They are not reachable from the storefront and RLS hides deleted
rows, but they are not part of the seed and should be removed before launch.

### 4.7 Notes for whoever re-runs the harnesses
- `h3-staff.mjs` parks `.env` (restored on every exit path) to genuinely disable the passcode gate:
  Next's env loader fills an **empty** value in from `.env`, so `ADMIN_PASSCODE=""` does not turn
  the gate off — the staff checks silently ran against the gate-on server until this was fixed.
- It also clears only its own `login:127.0.0.1` rate-limit bucket, because every local attempt comes
  from one IP; without that, the login is (correctly) refused and the run reports a false failure.
- `server.js` runs Next in **dev mode** unless `NODE_ENV=production`, so harnesses that spawn it
  must set it or the "production" checks are measuring a dev server.
