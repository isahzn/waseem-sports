# Runbook — running, recovering and fixing the shop

PHASE 11 deliverable. `docs/DEPLOYMENT.md` is *how to get it live*; this is *what to
do once it is*. Three systems, three blast radii — losing one must never mean losing
the others' data.

| System | What it holds | If it is lost |
|---|---|---|
| **Next.js app** (GoDaddy Node.js Hosting; Vercel only for the demo, `docs/VERCEL-DEMO.md`) | code only — no state on disk | redeploy the previous build; nothing to restore |
| **Supabase** (Postgres + Auth + Storage) | products, stock, orders, pages, settings, audit; product photos in the `product-media` bucket | restore the backup (below) — this is the only unrecoverable one |
| **WAHA on its own VPS** (Phase 06, currently unconfigured) | the paired WhatsApp session (a Docker volume) | re-scan the pairing QR; orders are unaffected, the outbox keeps the messages |

> Everything marked **VERIFY** below has not been exercised on a real host yet —
> the code paths exist and are tested locally, the provider-side steps are not.
> `docs/SECURITY-REPORT.md` §4.5 lists what is still unproven.

---

## 1. Deploy and roll back (app only)

**Deploy.** GoDaddy builds from the connected repo or an uploaded zip: it runs
`npm install --production`, `npm run build`, then `npm start` (`server.js`, which
listens on `process.env.PORT`). Contract details and the pre-launch checklist are in
`docs/DEPLOYMENT.md`.

**Roll back.** There is no "promote the previous deployment" button on GoDaddy
Node.js Hosting. Roll back by redeploying the last good commit:

```bash
git log --oneline -10                       # find the last good commit
git revert --no-commit <bad>..HEAD && git commit -m "roll back <bad>"
git push origin main                        # or re-upload the previous zip
```

Because the app holds no state, a code rollback can never lose data. A *database*
change is different — see §3.

**Health check after any deploy.**

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://<domain>/            # expect 200
curl -s https://<domain>/sitemap.xml | head -3                        # expect the real domain
curl -s -o /dev/null -w '%{http_code}\n' https://<domain>/admin       # expect 307/302 to /admin/login
curl -sI https://<domain>/ | grep -i content-security-policy          # expect the enforced CSP
```

If the catalog is empty, the Supabase URL/anon key were not set **before the build**
(`NEXT_PUBLIC_*` is inlined at build time — a restart is not enough, redeploy).

---

## 2. Backups and a rehearsed restore (Supabase)

`DEPLOYMENT.md` sets the expectation; this is the drill. **VERIFY the plan's PITR
window and retention before launch** — they are plan-dependent.

1. **Confirm automated backups are on** (Supabase dashboard → Database → Backups).
2. **Take a manual logical dump** — it is the only backup you can restore into a
   *different* project, and it is what you rehearse with:

   ```bash
   pg_dump "$DATABASE_URL" --no-owner --format=custom --file=waseem-$(date +%F).dump
   ```

   Run it from somewhere that can reach Postgres directly (your machine, or Supabase's
   own scheduler). **Not from the GoDaddy app** — outbound Postgres ports are blocked
   there; only HTTPS egress works.
3. **Store it off Supabase** (owner's cloud drive / S3). A backup living inside the
   system it protects is not a backup.
4. **Export the images too.** Storage is separate from the database:
   `supabase storage cp -r ss:///product-media ./product-media-backup` (or the
   dashboard's download).
5. **Rehearse the restore into a scratch project** — a restore you have never run is
   a hope, not a plan:

   ```bash
   createdb rehearsed && pg_restore --no-owner -d rehearsed waseem-2026-10-08.dump
   # then point a local .env at the scratch project and load the storefront:
   #   NODE_ENV=production PORT=3100 node server.js
   ```

   Check: product count, an order's total, `store_settings`, and that a product photo
   resolves from storage. Record the date you rehearsed it here: `__________`.

**Recovery time:** the dump is small (a few MB of text) — restore is minutes, not
hours; the images are the slow part.

---

## 3. Database changes

Migrations are forward-only (`supabase/migrations/0001…0005`), applied with the
Supabase CLI. **Test every migration on a copy first** — a bad `alter table` on the
live project is the one mistake a code rollback cannot undo.

- Renaming/dropping a column: use expand → migrate → contract, never a single step
  (`deprecation-and-migration` in the skills list).
- A bad migration: write a `0006_fix_*.sql` that moves forward. Do not hand-edit a
  migration that has already been applied.
- Housekeeping: `rate_limits` and `image_search_cache` grow forever. Once traffic
  is real, run these on a schedule:

  ```sql
  delete from public.rate_limits where created_at < now() - interval '30 days';
  delete from public.image_search_cache where created_at < now() - interval '30 days';
  ```

  (The limiter also clears expired rows opportunistically on every check, so this
  is belt-and-braces, not load-bearing.)

---

## 4. Rotating keys, and what each one breaks

Rotate on: a laptop lost, a contractor leaving, any suspicion of leak, or before
handing the shop to someone new. Change one at a time and re-run §1's health check.

| Key | Where | Rotating it… |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API | invalidates the old key immediately. **Redeploy the app in the same window** — admin and checkout are broken until it is updated. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same page | needs a **redeploy** (it is inlined at build time). |
| `ADMIN_PASSCODE` | app env | immediately changes the admin door. It takes effect without a rebuild (`/admin/login` is dynamic). Sign-out is *not* forced for sessions already minted with the old signing key. |
| `ADMIN_SESSION_SECRET` | app env | signs every existing admin session out at once. This is the one to rotate if the passcode may have leaked (the passcode is the whole admin area — `docs/SECURITY.md`). |
| `ORDER_TRACKING_SECRET` | app env | makes every previously issued tracking link stop working. Customers who kept their confirmation link cannot open it — tell them before rotating during business hours. |
| `SCHEDULED_JOBS_SECRET` | app env + the scheduler's header | the cron route refuses callers until both sides match; queued notifications simply wait. |
| `WAHA_API_KEY` / `WAHA_HOOK_HMAC_KEY` | app env + WAHA | webhook signatures stop matching until both are updated — inbound WAHA callbacks are rejected, outbound sends fail and retry. |

`ADMIN_PASSCODE` rotation in one line: set the new value in the host's env vars,
redeploy, then sign out of `/admin` wherever it was left open.

---

## 5. People: add or remove an admin

This project has **two** ways in, and only one of them names who acted:

| Path | Env needed | Audit trail | Use it for |
|---|---|---|---|
| Shared password | `ADMIN_PASSCODE` + `ADMIN_SESSION_SECRET` | `actor: null` (there is no user id behind it) | the owner's own day-to-day, one person |
| Account (Supabase Auth + `admin_users`) | nothing extra | the real user id | staff, a developer, or anyone who needs an audit trail |

**Add an account.** Supabase dashboard → Authentication → Add user (email +
password, auto-confirm), then:

```sql
insert into public.admin_users (user_id, role, is_active)
values ('<auth-user-uuid>', 'staff', true);
-- roles: owner | admin | staff | developer  (see src/lib/auth/roles.ts)
```

**Remove someone.** `update public.admin_users set is_active = false where user_id = '<uuid>';`
then delete or disable the Auth user. Deactivating the row is enough for every
authorization check in the app.

**Turn the shared password off** (recommended once more than one person has access):
delete `ADMIN_PASSCODE` from the host's env vars and redeploy — `/admin` falls back to
the account login, exactly as it was before D42. Rotate `ADMIN_SESSION_SECRET` at the
same time so nothing minted under the old scheme survives.

---

## 6. WhatsApp (WAHA) — when it exists

Not configured in the shipped build: with `WAHA_URL`/keys empty every channel stays
`none`, orders record `skipped` outbox rows, and `/admin/settings/whatsapp` says so.
Design and stop-and-ask list: `specs/whatsapp-waha-spec.md`; phase record:
`phases/PHASE-06-notifications.md`.

- **Session backup / restore:** the pairing lives in the WAHA container's session
  volume. Back it up on the VPS (`docker run --rm -v <volume>:/data -v $PWD:/backup
  alpine tar czf /backup/waha-session.tgz -C /data .`) on a schedule, and keep a copy
  off the VPS.
- **Re-pair drill:** the number is WAHA's session identity, so it cannot be typed in —
  scan the QR from `/admin/settings/whatsapp`, then send one test message to confirm.
  Rehearse this once so a lost session is a 10-minute job, not an outage.
- **Kill switch:** `/admin/settings/whatsapp` (owner only) — turns channels off without
  touching orders. Nothing in the notification path can fail an order: sends are
  outbox rows, retried with backoff, and the order is already committed.
- **Failure triage:** `/admin/notifications` shows each row with its status and
  `last_error`, and can resend (rate-limited and audited). `WAHA_URL` wrong or the VPS
  down → rows stay `failed` and retry; the order is never affected.

---

## 7. Scheduled jobs

`/api/cron/notifications` drains the outbox. Auth is `SCHEDULED_JOBS_SECRET` via
`Authorization: Bearer <secret>` or `x-cron-secret`; **a `?secret=` query parameter is
refused on purpose** (secrets in URLs end up in access logs). With no secret set the
route answers `503` rather than running unauthenticated.

- Production: Supabase `pg_cron` + `pg_net` every few minutes (**VERIFY** availability
  on the plan; D30). `pg_net` can send headers, so no query parameter is needed.
- Vercel demo: nothing runs unless a `vercel.json` cron entry is added
  (`docs/VERCEL-DEMO.md` P7) — harmless while notifications are disabled.
- Nothing to schedule at all while every channel is `none`.

---

## 8. Logs, monitoring, audit

- **App logs** are one JSON object per line on stdout:
  `{"ts":"…","level":"info","msg":"admin signed in with the shared password","ctx":{"ip":"…"}}`
  (`src/lib/security/logger.ts`). GoDaddy keeps them per deployment — **VERIFY the
  retention window** and copy anything you need to keep.
- **Audit trail:** `audit_logs` (actor, action, entity, minimal meta) for logins,
  catalog/stock/order/settings changes and page publishes. Query the real thing from
  the app's environment, e.g.
  `select created_at, actor, action, entity, entity_id from audit_logs order by created_at desc limit 50;`
- **Notification health:** `/admin/notifications` (status + last error + resend), and
  the dashboard shows what needs attention.
- **Rate limits:** counted in the `rate_limits` table (per IP / per identifier) —
  login, checkout, tracking lookup, uploads, image search.
- **Errors:** user-facing pages are generic; the detail goes to the log with the same
  request. `app/error.tsx` is the boundary for an unexpected render failure.

---

## 9. Common fixes

| Symptom | Cause | Fix |
|---|---|---|
| Catalog empty, `/shop` blank | `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` missing **at build time** | set them, then **redeploy** (a restart is not enough) |
| Product thumbnails broken | wrong Supabase URL, or the `product-media` bucket/policies missing | check the URL, then re-apply `supabase/migrations/0001` storage policies |
| `sitemap.xml` / `robots.txt` point at localhost | `NEXT_PUBLIC_SITE_URL` unset at build time | set it to the deployed `https://…` and redeploy (also controls the admin cookie's `Secure` flag) |
| `/admin` shows an email + password form, no account works | `ADMIN_PASSCODE` missing and there are zero auth users | set `ADMIN_PASSCODE` (or create the owner account, §5) |
| `/admin` asks for the password again immediately | the cookie is `Secure` on an http URL, or `ADMIN_SESSION_SECRET` changed | set `NEXT_PUBLIC_SITE_URL` to the real `https://…`; sign in again after a secret rotation |
| Checkout says online ordering is not open | no active `shipping_rules` row | add the real delivery rule in `/admin/shipping` (owner decision D5) |
| Every cart line says out of stock | stock is 0/untracked on the variant | `/admin/inventory` → set on-hand, or untick *track inventory* |
| An order's stock is stuck reserved | order cancelled outside the normal flow | `/admin/orders/<id>` → the stock panel has release / commit / reserve |
| Notifications never arrive | no provider configured (expected), wrong WAHA key, or the cron is not scheduled | `/admin/settings/whatsapp` status panel; then §6 and §7 |
| A page/product edit returns a 500 | a server component is passing a function to a client component, or malformed CMS content | check the app log for the error digest; re-save the section (the builder refuses values the schema rejects) |
| Cart count/badge looks stale after a deploy | the browser is holding a pre-deploy chunk | hard reload; the count is re-priced on every page load |
| Rate-limited during a demo (login/checkout) | the limiter is doing its job (10 login tries / 15 min / IP) | wait out the window, or `delete from public.rate_limits where key like 'login:%';` |

---

## 10. Before you call it launched

Walk `DEPLOYMENT.md`'s pre-launch checklist, then these drills, and record the date
next to each:

- [ ] a restore from §2 has been rehearsed into a scratch project — date: `______`
- [ ] `ADMIN_PASSCODE` is long and random, or removed — date: `______`
- [ ] the real delivery rules are entered in `/admin/shipping` (D5) — date: `______`
- [ ] the WAHA session has been backed up and re-paired once (§6) — date: `______`
- [ ] the PHASE 11 journeys have run against production (`phases/PHASE-11-production-qa.md`)
- [ ] security headers and CSP measured **as served by the live host** — date: `______`
- [ ] the owner quick-guide (`docs/OWNER-GUIDE.md`) has been handed over
