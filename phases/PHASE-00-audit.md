# PHASE 00 — Audit & architecture confirmation
**Goal:** understand what exists before writing app code. No feature code in this phase.
## Tasks
1. Inspect `design/` HTML: pages, sections, repeated components, colors, fonts, interactions, images, anything broken or hardcoded.
2. Inspect any existing repo files (package.json, Next version, configs) if present.
3. Write `docs/AUDIT.md`: current state, reusable pieces, problems, conflicts vs `docs/ARCHITECTURE.md`.
4. Write `docs/DESIGN-TOKENS.md`: colors, type scale, spacing, radii, shadows; component inventory mapped to CMS section types.
5. Confirm/adjust the plan: list any change you'd make to ARCHITECTURE/DATABASE and why (don't silently deviate).
6. List VERIFY items to research (Next/Supabase current setup, rate limiting options, auth email limits).
## Acceptance
- AUDIT.md + DESIGN-TOKENS.md exist and are specific (file/section names), not generic.
- Every open question is in `docs/DECISIONS.md` or asked to the user.
## Stop and ask
Summarize findings to the user and wait for approval before PHASE 01.

## Amendments — 2026-10-06 (owner decisions made during this phase; do not re-litigate)
- **Canonical design:** `design/waseem-sports-video.html`. Everything else moves to `design/unwanted-designs/` — audit only the canonical file (see `specs/phase-00-fix-spec.md` §6.3).
- **Hosting:** the app runs on GoDaddy Node.js Hosting; Supabase is reached only over HTTPS. The `ARCHITECTURE.md`/`DEPLOYMENT.md` Vercel story is rewritten as part of this phase (`specs/phase-00-fix-spec.md` §F8).
- **Stack:** Next.js 16 (15 reaches EOL 21 Oct 2026), Tailwind v4 CSS-first `@theme`. Tokens ship as both a `@theme` block and a raw table.
- **Specs written this phase:** `specs/whatsapp-waha-spec.md` (WhatsApp via self-hosted WAHA — decided, not a paid provider) and `specs/product-image-pipeline-spec.md` (concrete proposal awaiting approval). Both stay draft until approved.
- **Cannot be tested in this phase — prove later:** the migration only by applying it (PHASE 02); the GoDaddy deploy only on the preview tier (PHASE 01); RLS/concurrency only with live SQL tests (PHASE 02); computed colours/contrast only by rendering the canonical file in a browser (step 3 of this phase's execution — do it, don't eyeball the source); photo content only after extraction (PHASE 04).
