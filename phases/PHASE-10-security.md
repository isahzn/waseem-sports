# PHASE 10 — Security hardening & audit
Review everything against `docs/SECURITY.md`. Produce `docs/SECURITY-REPORT.md` with pass/fail + evidence + fixes.
## Test matrix (automate where possible)
- **Auth:** wrong password, brute force, reset flow, expired/reused token, session expiry, logout, role enforcement.
- **Authz:** unauthenticated & non-admin calls to every admin action/route; direct URL access; staff vs owner actions.
- **Products:** invalid/negative price+stock, malformed ids, oversized payloads.
- **Inventory:** simultaneous purchases, qty 0/negative/huge, stale cart, more than available.
- **Checkout:** manipulated price/product/shipping, fake payment success, duplicate submit, duplicate webhook.
- **Uploads:** executable renamed, oversized, wrong MIME, malformed image, traversal filename, SVG.
- **CMS:** unauthorized create/publish, script/HTML injection.
- **Orders:** id guessing, other customer's order, modifying orders.
- **Infra:** secrets not in bundle/Git history, headers/CSP, `npm audit`, RLS matrix re-run, rate limits live.
## Acceptance
Every failure fixed or explicitly accepted by the user with reasoning. Re-run the suite after fixes.

## Amendments — 2026-10-06 (tests added by later owner decisions)
- **WhatsApp/WAHA:** `WAHA_API_KEY` (and every other secret) absent from client bundles and logs; HMAC verification on the webhook route with raw-body checks and rejection tests; unauthenticated/non-admin calls to the session/QR/retry endpoints fail; outbound send rate limit holds under a burst; killing the provider never corrupts an order.
- **Upload pipeline additions:** SVG/bomb/traversal cases (already listed) plus crop-recipe writes that must never overwrite or delete an `originals/` object; derivative URLs must be content-hashed and immutable.
- **Re-run targets:** the RLS matrix from PHASE 02 against the hardened policies and the safe `variant_availability` projection (no unpublished/soft-deleted leakage); the stock-race proofs.
- **Cannot be tested except as stated:** brute-force behaviour only against live rate limits; header/CSP behaviour only on the deployed host; `npm audit` and secret-greps only on the real build output.


also you can use the secuirity audit skill

## Execution record — 2026-10-08 (+ the owner's correction pass)

**Deliverable:** `docs/SECURITY-REPORT.md` (written this session; it did not exist before).

**Hardening landed:** `clientIp()` now takes the *last* `x-forwarded-for` entry (the first is
attacker-chosen, which made every rate limit bypassable); `hrefField` rejects protocol-relative
`//host` links (open redirect) and `gradientField` rejects `url(|expression(|@import|javascript:|
data:|behavior|binding|[<>]` (CSS injection through an inline style); the WAHA webhook caps its raw
body at 256 KB → `413`; the notifications cron no longer accepts `?secret=` (header/Bearer only);
`requireAdmin(["owner"])` on transfer create/confirm/status, the WhatsApp settings actions and the
image-search allowlist; an enforced CSP in `next.config.ts`; `sharp` `^0.34` → `^0.35.5` (the one
runtime CVE; the remaining `npm audit` highs are devDependency-only); `/admin/login` became
`force-dynamic` so `ADMIN_PASSCODE` can change with a restart instead of a rebuild.

**Correction pass (owner's list, no new phase, nothing rebuilt):** search rebuilt on a per-term
intersection across product name/slug/description, sports, categories, brands, variant name/SKU and
attribute values (the old `name`/`slug` only match meant "badminton" could not find "Yonex Double
Racket"); a new `sport_tiles` CMS section renders the live sports taxonomy so "Shop by sport" is
admin-editable (photo upload, homepage-promotion switch, one-step reorder, tile column) and the
storefront follows without a republish; the mockup's fake delivery claims were removed from code,
seed and live rows; contact links became real `tel:`/`wa.me`; the storefront nav lost its admin
link; the transfer UI stopped describing itself as a sandbox.

**Evidence (production build, port 3100):** `h0-pure` 40/40 · `h1-live` 39/39 · `h2-authed` 29/29 ·
`h3-staff` 15/15 · `h4-sport-image` 18/18 · `correction-check` 47/47 · `shop-by-sport-check` 38/38 ·
`browser-pass` 44/45. Gates: typecheck 0 · lint 0 errors (5 pre-existing warnings) · build exit 0.

**Harness bugs found and fixed while getting h3 to run** (both would have produced false evidence):
an empty `ADMIN_PASSCODE` does **not** disable the passcode gate, because Next's env loader refills
it from `.env`; and the kill filter matched `node server.js` but not the full-path command line of a
process spawned as `spawn("node", ["server.js"])`, so the "gate-off" server died on EADDRINUSE and
the checks ran against the gate-ON server. The harness now parks `.env` (restored on every exit
path) and kills by file.

**The one failure, reported not patched:** React hydration error `#418` (text mismatch) once per
page load on `/checkout`, `/track`, `/cart`, `/contact` **when the cart has items**. The rendered
page is correct; the root cause is unconfirmed and a speculative change to the cart risks a working
checkout. Details, evidence and the repro command: `docs/SECURITY-REPORT.md` §4.1.

**Still with the owner:** a real `ADMIN_PASSCODE` (currently 5 characters — a launch blocker), the
real delivery rules in `/admin/shipping` (the fees on `/faq` are still seed values), and either
products for Cricket/Tennis or archiving those two sports.
