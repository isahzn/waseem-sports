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
