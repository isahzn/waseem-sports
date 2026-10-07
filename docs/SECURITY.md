# Security model

Not "perfectly secure" — defense in depth. For every sensitive endpoint answer: who can call it, what can it change, what input do they control, what secrets does it touch, what if called 1,000x, what if replayed, what if the client lies.

## Layers
1. **Auth:** Supabase Auth (email+password, reset by email, session cookies via `@supabase/ssr`). No master password, ever. Developer access = separate `admin_users` row with role `developer`.
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

## Threat -> defense quick map
| Attack | Defense |
|---|---|
| Admin brute force | Auth limits, rate limit, optional MFA (VERIFY Supabase MFA), audit |
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
