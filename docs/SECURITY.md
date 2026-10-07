# Security model

Not "perfectly secure" — defense in depth. For every sensitive endpoint answer: who can call it, what can it change, what input do they control, what secrets does it touch, what if called 1,000x, what if replayed, what if the client lies.

## Layers
1. **Auth:** Supabase Auth (email+password, reset by email, session cookies via `@supabase/ssr`). **Plus, since 2026-10-07, an optional shared-password gate on `/admin`** that the owner asked for (decision D42) — it is a deliberate exception to the original "no master password, ever" rule, it is scoped to one person's shop, and it must be replaced before a public launch: see *The shared-password admin gate* below. Developer access = separate `admin_users` row with role `developer`.
2. **Authorization:** `requireAdmin(roles?)` at the top of EVERY admin server action / route handler / admin page loader. RLS (`is_admin()`) is the second gate. Role matrix in `src/lib/auth/roles.ts` (e.g. only `owner` edits settings/payments/admin users; `staff` manages orders/stock).
3. **RLS:** on for every table; anon sees only published/visible catalog; orders/payments/notifications/audit are server (service role) or admin only.
4. **Service role:** only in `src/lib/supabase/admin.ts` with `import "server-only"`. CI check: grep build output + repo for the key name in client bundles.
5. **Validation:** zod at every boundary (actions, route handlers, webhooks, search params). Max body sizes. Strings trimmed/length-limited. IDs must be uuids.
6. **Rate limiting** (per IP + per identifier): login, password reset, checkout, order tracking lookup, contact forms, admin image search, upload endpoints. Supabase Auth has its own limits — VERIFY and configure. DECISION D8 on the store for limits.
7. **CSRF/cookies:** server actions + SameSite=Lax cookies; state-changing route handlers check Origin and require auth. Cookies HttpOnly, Secure in prod.
8. **Headers:** CSP (no inline scripts if avoidable; allow Supabase/image hosts), HSTS, X-Content-Type-Options, Referrer-Policy, frame-ancestors none for admin, Permissions-Policy. Configure in `next.config` / middleware; test the site still works.
9. **XSS:** React escapes by default; never `dangerouslySetInnerHTML` with CMS content; markdown rendered through a sanitizer; JSON-LD serialized safely.
10. **Uploads:** admin only; allow jpeg/png/webp/avif; check magic bytes (not client MIME/extension); max size + max dimensions; re-encode via sharp (strips payloads/EXIF); random server-generated filenames; fixed bucket path; no SVG upload (or sanitize) in v1.
11. **Payments:** see ARCHITECTURE. Signature verification on raw body, replay table, re-verify with provider, idempotent state machine, amounts compared to the order total.
12. **Orders privacy:** no enumeration — tracking needs number + unguessable token; generic failure message; no PII in URLs beyond those; admin views are role-gated.
13. **Errors/logging:** generic messages to users; structured server logs with request id; never log secrets/passwords/full tokens/card data. Failures to track: payments, notifications, image search, auth anomalies.
14. **Audit:** `audit_logs` for login, product/stock/order/settings/page publish/payment-manual changes (actor, action, entity, minimal meta).
15. **Supply chain:** lockfile committed, `npm audit` in CI, Dependabot/renovate, minimal deps.
16. **Secrets:** `.env*` gitignored, GoDaddy encrypted env vars per app (preview vs production), separate Supabase projects for dev and prod, rotate on suspicion.

## The shared-password admin gate (D42 — deliberate, temporary)

**What it is.** When `ADMIN_PASSCODE` is set in the environment, `/admin` opens with one password instead of an account: `src/lib/auth/passcode.ts` compares it in constant time, and on success sets a signed, httpOnly, SameSite=Lax session cookie (7 days, `Secure` whenever `NEXT_PUBLIC_SITE_URL` is https). The cookie is HMAC-signed with `ADMIN_SESSION_SECRET` (falling back to a key derived from the passcode). Unsetting `ADMIN_PASSCODE` restores the Supabase account login exactly as it was — the account path is still checked first for anyone who has one.

**What it protects, and what it does not.**

| Yes | No |
|---|---|
| The whole `/admin` area: catalog, orders, stock, prices, shipping rules, the landing-page builder | It does not identify *who* acted. Two people sharing the password are one identity |
| Every write (`requireAdmin()` accepts a passcode session as role `owner`) | It is not per-person revocable — rotate the password to remove someone |
| Audit rows for every action | Audit rows from a passcode session record `actor: null`, because there is no `auth.users` row to point at |

**Why that is acceptable here and what makes it dangerous.** One owner, one shop, and the owner explicitly chose it over creating an account. But the password is now the entire admin surface: anyone who guesses it can change prices, mark orders paid, or publish a page. So:

- `/admin/login` is rate-limited (10 attempts / 15 min / IP) and the failure message never distinguishes a wrong password from a throttled one.
- **Before the site is reachable from the internet, `ADMIN_PASSCODE` must be a long random string** (`openssl rand -base64 24`), not a short typed one. The `.env` value shipped for local development is deliberately weak and is **not** a launch value.
- Real admin accounts (`admin_users` + Supabase Auth) are still the supported answer for more than one person, or for any role below owner. Unset `ADMIN_PASSCODE` and they work as before.

## Admin data access: service role + an explicit guard (D43)

Two things had to change together when the gate arrived, and both are load-bearing:

1. **Admin reads and writes use `adminDb()` (service role).** The catalog actions used the request-scoped client, whose writes are filtered by RLS policies keyed on `auth.uid()` — which a passcode session does not have. An UPDATE the policy filters out returns zero rows and *no error*, so actions reported success for writes that never happened. `adminDb()` is exported from `src/lib/auth/requireAdmin.ts` and must only be called after `requireAdmin()`.
2. **Every admin page calls `requireAdminOrRedirect()` before it reads.** A layout's `redirect()` does **not** stop the page below it: Next renders them in parallel, and the page's payload is streamed into the 307 response. Measured on 2026-10-07: an anonymous `GET /admin/pages/<id>` returned the entire rendered page builder — sections, product ids, SEO fields — inside the redirect body, because the page had already read it with the service role. `.tmp/design/admin-leak.mjs` asserts the property that catches this: anonymous admin requests redirect *and* carry none of the seeded product/page/order values.

## Threat -> defense quick map
| Attack | Defense |
|---|---|
| Admin brute force | Auth limits, rate limit, optional MFA (VERIFY Supabase MFA), audit. A shared-password admin adds one brute-force target — hence long random passcodes and the login rate limit (D42) |
| Anonymous admin data read | `requireAdminOrRedirect()` in every admin page, before any read (D43) — a layout redirect alone does not prevent the page from running |
| Price/total tampering | Cart holds ids+qty only; server prices from DB; SQL snapshot |
| Fake payment success | Only verified webhook/`getStatus` changes payment state |
| Oversell / race | `adjust_order_stock` conditional UPDATE + constraints |
| Duplicate order/webhook | idempotency keys + unique constraints |
| Order snooping | hashed token + generic errors + rate limit |
| Malicious file | magic-byte check + re-encode + size caps |
| SSRF via image import | https only, domain allowlist, block private IPs, timeouts, size cap |
| Cost abuse | rate limits, caching, per-day quota on image search + notifications |
| Stored XSS via CMS | no raw HTML, sanitized markdown, zod section schemas |
| Password-reset abuse | Supabase reset flow + rate limit + generic responses |
| Secret leak | server-only module, env separation, CI grep |

## Security test list (PHASE 10) — see phases/PHASE-10-security.md
