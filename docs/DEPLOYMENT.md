# Deployment & recovery (GoDaddy Node.js Hosting + Supabase)

All provider steps below: **VERIFY against the current GoDaddy deploy contract
and Supabase docs** (V3) — don't trust remembered UI paths. GoDaddy's own
pages returned 403 to automated fetches during research (2026-10-06), so the
contract facts below come from industry coverage that read the contract
directly — re-confirm the revision before the first deploy.

## Environments

- `local`: Supabase local (CLI) or a dev project. `.env.local`.
- `preview`: GoDaddy **free preview tier** (no plan, no card, private preview
  apps) — prove the Next.js build here in PHASE 01.
- `production` (+ optional `staging`): separate Supabase project per
  environment. NEVER point previews at production data. Buy **Deluxe** when a
  real staging app is needed alongside production (Economy allows only 1
  published app; Deluxe 10; Ultimate 25; each also gets 2 preview apps).

## GoDaddy deploy contract (checklist)

- Root `package.json` with non-empty `name` / `version` / `main` — and the
  `main` file must exist.
- `build` and `start` scripts both present.
- App listens on **`process.env.PORT`** and binds **`0.0.0.0`** (persistent
  Node 22 process, not serverless).
- Runtime packages in `dependencies` (production install omits devDependencies).
- Lockfile committed; `node_modules` excluded; `.npmrc` pointing at the public
  registry.
- **One application per upload** (no monorepos); zip ≤ 100 MB, or deploy from a
  connected GitHub repo.
- Files that must survive deploys go in **`/public/assets/`** (product
  originals live in Supabase Storage, not on disk — see D29).
- Region (North America or Europe) chosen **before the first deploy**.
- Egress: HTTP:80, HTTPS:443 and GoDaddy managed MySQL only. Supabase is
  reached **only over HTTPS**; outbound SMTP is not routable (email/SMS
  providers must expose HTTPS APIs — D4).
- Included: automatic HTTPS, Cloudflare-backed CDN, WAF, encrypted env vars,
  per-deploy malware/vulnerability scan.
- Suspended plan: apps stop serving, nothing deleted. Cancelled plan: apps
  frozen 30 days, then apps, secrets, databases and storage are deleted.

## Phase 01 deploy proof (2026-10-06, local)

The GoDaddy contract items provable without an account are done: root
`package.json` has non-empty `name`/`version`/`main` (`server.js` exists),
`build` + `start` scripts present, `server.js` listens on
`process.env.PORT` bound to `0.0.0.0`, runtime deps in `dependencies`,
lockfile committed (`package-lock.json`), `.npmrc` pins the public
registry, `node_modules` excluded via `.gitignore`. Proven by booting the
production build with `PORT=3101 node server.js` (see PHASE-01 execution
record). Still to prove on a real account: free-preview-tier deploy,
region choice (NA/EU), env-var setup, domain + HTTPS (V3 — re-confirm the
contract revision before the first deploy).

## Setup order

1. Create GitHub repo (private). Push code.
2. Create Supabase project(s). Apply migrations via CLI. Create the first
   owner: sign up in Supabase Auth, then insert into `admin_users`
   (role `owner`) using SQL as a one-off documented step.
3. Configure Supabase Auth: site URL, redirect URLs (prod + preview), email
   templates, password rules. Password-reset mail goes through the Supabase
   mailer or an HTTPS-API email vendor (no SMTP from GoDaddy) — VERIFY limits.
4. Deploy to a GoDaddy preview app from the repo/zip. Add env vars from
   `.env.example` (production scope only for secrets).
5. Domain: keep it on GoDaddy (registrar + DNS) and point it at the GoDaddy
   app per their current instructions (do not transfer anything away). VERIFY
   HTTPS is active.
6. Configure cron as Supabase `pg_cron` (+ `pg_net`) calling
   `/api/cron/*` with `SCHEDULED_JOBS_SECRET` over HTTPS (D30) — VERIFY availability on
   the chosen plan (V4); in-process timer is the fallback.
7. Configure webhooks at the payment provider to
   `https://<domain>/api/webhooks/<provider>` once chosen (HTTPS — every
   provider offers this).

## Pre-launch checklist

Env vars set; DB connected over HTTPS; storage upload works; owner login +
password-reset email works; domain + HTTPS; COD order end-to-end; stock
decrements correctly; notifications send (or are disabled cleanly);
WAHA VPS paired and reachable (or notifications queued, never lost); error
pages; **backups enabled AND a restore rehearsed**; security phase signed off;
no secrets in Git history.

## Backups & recovery (data and code are separate)

- Code rollback: redeploy the previous zip / git revert + redeploy (no
  serverless "promote previous deployment" here).
- Data: Supabase backups (plan-dependent — VERIFY retention/PITR) + a
  scheduled logical dump (`pg_dump` — run it from somewhere that CAN reach
  Postgres directly, e.g. Supabase scheduled backups or a local job; NOT from
  the GoDaddy app) to storage outside Supabase (e.g. owner's cloud drive/S3).
  Images: the `product-media` bucket needs its own periodic export.
- Accidental deletion: soft delete first (restore via admin "Archived"
  filter); hard delete only via a guarded admin action.
- Bad migration: test on staging copy; migrations forward-only; keep a
  down/fix migration ready. (The `0001` migration was hardened pre-apply in
  Phase 00 — D25.)
- Payment/provider outage: orders stay `pending`; reconciliation script
  compares provider vs DB.
- WAHA/VPS outage: notifications queue in the outbox; orders unaffected.
- Security incident: rotate keys (Supabase, provider, cron), revoke sessions,
  review `audit_logs` + app logs.
  Write these as `docs/RUNBOOK.md` in PHASE 11.
