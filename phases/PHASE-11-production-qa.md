# PHASE 11 — Production QA & launch
1. Full journey on staging then production: browse -> search -> product -> variant -> cart -> checkout -> COD (and card if enabled) -> order -> stock -> admin -> status updates -> notifications -> tracking -> delivered. Then the failure paths (provider down, out of stock mid-checkout, network drop).
2. Mobile + tablet + desktop pass; accessibility pass (keyboard, contrast, screen-reader spot check); Lighthouse numbers recorded.
3. Ops: error monitoring/logging in place; backups on AND a restore rehearsed; `docs/RUNBOOK.md` (deploy, rollback, restore, rotate keys, add admin, common fixes); owner quick-guide (1-2 pages, screenshots) for products, stock, orders, homepage.
4. Launch checklist from `docs/DEPLOYMENT.md`; confirm all DECISIONS resolved or consciously deferred.
5. Hand over: owner account, developer account (separate), credentials stored in a password manager, not in chat/Git.

## Amendments — 2026-10-06 (context for a session with no prior knowledge)
- **Production is three systems, not one:** the Next.js app on GoDaddy Node.js Hosting, Supabase (database/auth/storage), and WAHA on its own VPS. `docs/RUNBOOK.md` must cover all three: deploy, rollback, restore, key rotation, WAHA session backup/restore and the QR re-pair drill, adding an admin, and common fixes.
- **Data separated by blast radius:** losing the GoDaddy app is code-only (redeploy); losing Supabase needs the configured backup + a rehearsed restore; losing the WAHA session volume means re-scanning the QR — back it up, and rehearse the re-pair.
- **Credentials handed over in a password manager** (task 5) now explicitly include: `WAHA_API_KEY`, `WAHA_HOOK_HMAC_KEY`, `SCHEDULED_JOBS_SECRET`, the service-role key, and the VPS access.
- **Go-live gates added:** every test in `specs/whatsapp-waha-spec.md` §8 passes against the production VPS; the ban-risk acceptance is recorded (owner accepted it 2026-10-06; the number to lose is the shop's own); all DECISIONS resolved or consciously deferred; owner quick-guide covers the admin WhatsApp page (status, re-pair, failures).
- **Cannot be tested until launch:** the full journey must run on staging first, then production, including the failure paths (provider down, out-of-stock mid-checkout, network drop). Staging-only verification is not launch verification.
