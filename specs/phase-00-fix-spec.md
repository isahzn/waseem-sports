# phase-00-fix — Specification

**Short name:** `phase-00-fix`
**Created:** 2026-10-06
**Project:** Waseem Sports (storefront + CMS + inventory + orders)
**Project root:** `executive agent/Projects/Waseem-sports`
**Status:** Awaiting owner approval — no code or doc changes have been made yet.
**Owner decisions collected across:** 6 interview rounds (2026-10-06)

---

## 1. The request and how it was interpreted

**Original message (verbatim):** `do you have an issue`

**Interpreted as, and confirmed by the owner:** "Do you have blockers on the Waseem Sports Phase 00 audit?" — the session was interrupted mid-Phase-00, so the owner wants to know what is blocked, what is broken, and to have it fixed.

**Confirmed intent (interview round 1):**

| Question | Answer |
|---|---|
| What is the ask about? | Waseem Sports Phase 00 blockers |
| Understanding of build state | Design + plan only, no app code exists |
| Response mode | Report **and** fix in the same pass |

**What this spec is:** the complete, approved-as-far-as-possible brief for closing PHASE 00 — the audit deliverables, the design reorganisation, the handoff-package repairs, the documentation corrections, and the database hardening. It is the input to the execution pass that follows approval.

**What this spec is not:** approval to start PHASE 01+. The project runs one phase at a time; after Phase 00 is executed and reviewed, work stops again for approval.

---

## 2. Context gathered (verified state of the repository)

### 2.1 What exists

```
Projects/Waseem-sports/
├─ .env.example            (20 lines, env var names only, no secrets)
├─ .tmp/audit/             (empty leftover directory from the interrupted session)
├─ AGENTS.md, CLAUDE.md    (identical content — intended duplication)
├─ HANDOFF.md, README.md
├─ design/                 (5 HTML files + 1 PNG + 1 MP4 + a nested Vite app)
├─ docs/                   (7 files; AUDIT.md and DESIGN-TOKENS.md MISSING)
├─ phases/                 (PHASE-00 … PHASE-11, all present)
├─ prompts/                (00-FIRST-PROMPT.md, PHASE-PROMPTS.md)
└─ supabase/
   ├─ migrations/0001_init.sql   (518 lines)
   └─ seed.sql                   (9 lines, 4 settings rows)
```

- **No application code exists.** No root `package.json`, `tsconfig.json`, `next.config.*`, `src/`, `tests/`, or `.gitignore`. Only `design/Another design/package.json` (a design reference, not the product app).
- **The entire project folder is untracked in git.** `git status --short -- .` inside `Projects/Waseem-sports` returns `?? ./` — nothing here has ever been committed, including the handoff package itself.
- The surrounding workspace IS a git repo (branch `master`) with many unrelated modified/deleted files from other projects. **This spec touches only files under `Projects/Waseem-sports`.**

### 2.2 PHASE 00 acceptance criteria vs reality

`phases/PHASE-00-audit.md` requires `docs/AUDIT.md` and `docs/DESIGN-TOKENS.md`. **Neither file exists.** Phase 00 is incomplete, not failed.

---

## 3. Findings (the blockers)

Findings F1–F3 are the Phase 00 blockers proper. F4–F11 are problems found while auditing. Each is evidenced by file + line.

### F1 — Phase 00 deliverables were never produced *(blocker)*
`docs/AUDIT.md` and `docs/DESIGN-TOKENS.md` do not exist. Phase 00 was interrupted after reconnaissance only.

### F2 — Four mutually incompatible design directions, no canonical one named *(blocker)*
`docs/DESIGN.md` says "**Source of truth:** the existing HTML in `design/`" — but `design/` holds four different designs, and two files share the name `waseem-sports.html`.

| # | Files | Palette | Type | Scope |
|---|---|---|---|---|
| A | `Waseem Sports — claude Demo.html` (158 L) + `.bak` (152 L) | cream `#f3ecdc`, green `#0f3b26`, gold `#b8923a` | Barlow Condensed + Inter | Full commerce SPA demo (router, PDP, cart drawer, checkout, track, admin) |
| B | `waseem-sports.html` (124 L) | grey `#f3f4f1`, green `#0b3d2a`, gold `#a98733`/`#c7a14a` | Cormorant Garamond + Manrope | Same commerce breadth, calmer premium tone |
| C | `waseem-sports-video.html` (140 L) | **same as B** | **same as B** | B + inlined background video + photo hero layer, permanently dark |
| D | `Another design/` (Vite + React 19.2.6 + Tailwind 4.1.17, 12 src files + a 672-line standalone HTML) | ink `#0b1d12`, ember `#e9b32c`, pitch `#3cc46f` | Anton + Archivo + Space Mono | Single-page brand brochure — **no cart, PDP or checkout** |

**Owner decision: file C — `design/waseem-sports-video.html` — is canonical.** A and B and the `.bak` are superseded; `Another design/` is superseded and is not a component source for the storefront.

### F3 — The mockups contain invented business facts *(blocker for seeding)*
Present in one or more mockups and traceable to no source document:
- Phone `+94 11 000 0000`, `+94 11 235 5678`; WhatsApp `94772355678`
- Address `Malwatta Road, Pettah, Colombo 11`; also `Colombo, Sri Lanka`
- Hours `Mon–Sat 9:00–19:00`; also `Mon–Fri 8:30–18:30 / Sat 8:30–19:00 / Sun 9:00–13:00 / Poya closed` (these two contradict each other)
- Claims: `35+ Years on Malwatta Road`, `2500+ Items`, `45+ Brands`, `Best prices in town`, `2 min from Fort station`
- Demo PII: 4 fake customers with names, emails and phone numbers (`nimali@mail.lk`, `077 123 4567`, `071 555 0192`, `076 220 8841`, `070 998 3321`)
- Fictional KPIs: revenue `1,284,500`, `312` orders, `148` customers, `3.4%` conversion, `POS: Connected`
- Fictional orders `WS-1043`…`WS-1049`, `Courier: Rider 07`, `Estimated delivery · 07 Oct`

**Owner decision:** the address, phone and WhatsApp are **real and to be used as-is** (see §5.2 for the researched values). All contact details become **admin-editable settings**.

### F4 — Handoff-package defects
| ID | Defect | Evidence |
|---|---|---|
| F4.1 | `design/README.md` is referenced but missing | `README.md` line 13: "see `design/README.md`" |
| F4.2 | The project has **no `.gitignore` of its own** | Only the workspace-root `.gitignore` exists, and `README.md` instructs the user to copy this package into a fresh repo — the ignore rules would not travel. Trap: the root rule `.env.*` also matches `.env.example`, which this package requires |
| F4.3 | `AGENTS.md` is titled `# CLAUDE.md — Waseem Sports (agent rules)` | Both files, line 1 — copy-paste artefact |
| F4.4 | `Background.mp4` and `Logo.png` are referenced by **no** file | 0 matches across the project |
| F4.5 | `supabase/seed.dev.sql` and `supabase/tests/` are referenced but do not exist | `docs/FOLDER_STRUCTURE.md`, `supabase/seed.sql` comment |
| F4.6 | The workspace-root `Claude.md` conflicts with this project | It points at `.claude/skills/`, `.agents/skills/` and `Mcp.json`, none of which exist in the project; it requires `handoff.md` while the project has `HANDOFF.md`; it forbids subagents |
| F4.7 | `design/Another design/node_modules` exists (~69 packages) inside an archive candidate | Would be carried by any naive move/copy |
| F4.8 | Filenames contain spaces **and an em dash** (`Waseem Sports — claude Demo.html`, `Another design/`) | Quoting hazard for every script that touches them |
| F4.9 | Empty `Projects/Waseem-sports/.tmp/audit/` leftover | From the interrupted session |
| F4.10 | The project root has **no `skills/` folder**, though the onboarding prompt expects one | Skills live one level up, at the workspace root |

### F5 — `supabase/migrations/0001_init.sql` (518 lines) — security and correctness findings

Read in full. It is substantive and real: 22 tables, 1 view, 1 sequence, 12 triggers, 28 indexes, 5 functions, 36 policies, and a `product-media` storage bucket.

| ID | Finding | Evidence |
|---|---|---|
| F5.1 | **`is_admin()` ignores the role column** — every RLS write check is role-blind, so the owner/admin/staff/developer matrix in `SECURITY.md` has no database counterpart | `is_admin()` defines ~L26–29; `admin_users.role` check L20–21 |
| F5.2 | **`admin all` policies let any admin session bypass the stock functions** — `inventory`, `inventory_movements`, `orders`, `order_items`, `order_status_history`, `payment_transactions` are all in the blanket `FOR ALL` loop, so an anon-key admin session can write `on_hand`, `orders.total` and payment status directly | policy loop ~L499–504; contradicts `CLAUDE.md` rule 4 and `ARCHITECTURE.md` |
| F5.3 | **`variant_availability` leaks and bypasses RLS** — created without `security_invoker`, granted to `anon`, no `track_inventory` filter, no published/not-deleted filter, exposes `variant_id` for unpublished and soft-deleted products | view L199–205, grant L206 |
| F5.4 | **`place_order` idempotency race** — the `idempotency_key` pre-check is not row-locked and there is no `unique_violation` handler, so two concurrent checkouts with the same key both pass and the second dies with a raw `23505` | pre-check ~L417–418; unique constraint L230 |
| F5.5 | **`place_order` trusts a caller-supplied shipping fee** (`p_shipping_fee numeric`) — `ARCHITECTURE.md` says the fee comes from `shipping_rules` and `CLAUDE.md` rule 3 forbids trusting the client for the shipping fee. *(Identified by the coordinator from the function signature; to be confirmed against the body during execution.)* | signature L404–410; `shipping_rules` table L209–221 |
| F5.6 | The reserve/commit decision is passed in as `p_reserve_stock boolean` by the caller (`cod.reserve_stock_on` is a setting) — stock behaviour is delegated to the client layer | signature; seed L4 |
| F5.7 | **Undocumented guaranteed behaviour:** per-variant quantity `> 100` raises `INVALID_QUANTITY` — an invented business rule with no DECISION entry | ~L439 |
| F5.8 | `commit` decrements `on_hand` **without** the `track_inventory` guard that `reserve` has | `reserve` ~L382–386 with guard; `commit` ~L390–392 without |
| F5.9 | The manual stock-adjust function that `DATABASE.md` advertises does not exist; only a comment mentions `manual_adjust` | 5 functions total; comment L185 |
| F5.10 | `inventory_movements.order_id` has **no FK to `orders`** while comparable columns elsewhere do | L186 vs L266/L277 |
| F5.11 | `store_settings.updated_at` exists but the table is absent from the trigger loop, so it never auto-updates | column L34; loop L356 |
| F5.12 | Malformed `place_order` input raises raw cast errors (`22P02`) and raw NOT NULL errors (`23502`) instead of named exceptions | `(e->>'variant_id')::uuid` ~L436; `p_customer->>'name'` ~L432 |
| F5.13 | `revoke`/`grant` enumerate the full argument-type list, so any future signature change silently leaves the function executable by default | L462–465 |
| F5.14 | `admin_users` has **no write policy at all** (SELECT-own-row only) — the admin-invite/role-edit path is service-role-only; acceptable but undocumented | L496 |
| F5.15 | `variant_availability` is a *deliberate* public projection but its shape contradicts that intent (see F5.3) | L199–206 |

### F6 — `docs/DATABASE.md` accuracy
Confirmed accurate: every claimed table, the soft-delete pattern, `numeric(12,2)` money, the tracking-token hash, all idempotency constraints, and the `coalesce(variant.price, product.base_price)` rule inside `place_order`.
Wrong or incomplete:
- Claims a manual stock-adjust with reason `'manual_adjust'` **exists** (it does not — F5.9)
- Omits `inventory.track_inventory`
- Describes `place_order` idempotency as sound (it is racy — F5.4)
- Never mentions 12 real columns: `products.promo`, `products.compare_at_price`, `products.published_at`, `products.search_tsv`, `sports.is_featured`, `brands.is_featured`, `orders.stock_reserved`, `orders.stock_committed`, `orders.shipping_method`, `pages.layout`, `pages.og_image_path`, `product_images.license_note`

### F7 — `supabase/seed.sql` business values
Seeds 4 rows: `store.currency` = `LKR` (correct), `cod.reserve_stock_on` = `placed` (documented placeholder for DECISION D2), plus two values with no decision trail: `order.number_prefix` = `WS` and `public.store_name` = `Waseem Sports`.
Also: `store.currency` and `order.number_prefix` do **not** match the `public.%` read policy, so the storefront cannot read the currency through the anon client as seeded.

### F8 — Hosting contradicts the build plan *(architectural)*
`ARCHITECTURE.md`, `HANDOFF.md` and DECISION D10 all assume Vercel. The owner requires the app to run on GoDaddy. Research (2026-10-06) on GoDaddy's Node.js Hosting, GA 12 Aug 2026:
- Runs the app as a **persistent Node.js 22 process** (not serverless) — Next.js is supported and explicitly detected by their framework detection
- **Outbound traffic is limited to HTTP:80, HTTPS:443 and GoDaddy's managed MySQL**; external databases on other ports are explicitly unreachable (port 3306 named). **Supabase Postgres on 5432/6543 is therefore unreachable** — but Supabase **over HTTPS (443)** works fully, which covers `supabase-js`, Auth, Storage, PostgREST and RPC
- **Outbound SMTP is not routable** (a loopback gateway on port 2525 handles mail through a GoDaddy helper); Nodemailer and third-party SMTP relays do not work
- Deploy contract rules: root `package.json` with non-empty `name`/`version`/`main` (and the `main` file must exist); both `build` and `start` scripts; **listen on `process.env.PORT`** and bind `0.0.0.0`; runtime packages in `dependencies` (production install omits devDependencies); ship a lockfile, exclude `node_modules`; an `.npmrc` pointing at the public registry; **one application per upload** (no monorepos); zip upload ≤ 100 MB, or a connected GitHub repo
- Included by default: automatic HTTPS, Cloudflare-backed CDN, WAF, encrypted env vars, malware/vulnerability scanning per deploy; region (North America or Europe) chosen before the first deploy
- Published-app allowance: 1 (Economy) / 10 (Deluxe) / 25 (Ultimate), plus 2 preview apps on each; a free preview tier exists without a plan or card
- Files that must survive deploys go in `/public/assets/`
- If the plan is suspended, published apps stop serving but nothing is deleted; if cancelled, apps are frozen 30 days before permanent deletion
- Sources: GoDaddy Node.js Hosting announcement (2026-08-20), GoDaddy's published deploy contract, and industry coverage of it (2026-08-21). GoDaddy's own pages returned 403 to automated fetches, so the contract details come from coverage that states it read the contract directly. **VERIFY the contract revision before the first deploy.**

### F9 — Skills location
The root `Claude.md` and the onboarding prompt expect `.claude/skills/`, `.agents/skills/` and a `skills/` folder at the project root. None exist inside `Projects/Waseem-sports`. Skills live at the **workspace root** (`skills and plugins/`, `.claude/skills`, `.agents/skills`), with those relevant to this project: `impeccable`, `frontend-ui-engineering`, `ui-ux-pro-max`, `webapp-testing`, `browser-testing-with-devtools`, `spec-driven-development`, `planning-and-task-breakdown`, `test-driven-development`, `security-and-hardening`, `documentation-and-adrs`, `incremental-implementation`, `source-driven-development`.

### F10 — The canonical design's own defects (to carry into the audit)
From reading `waseem-sports-video.html` and its sibling:
- The background video is an **AI-generated clip** (inlined base64 MP4 whose C2PA manifest reads "Created with PixVerse AI Video Generation", `digitalSourceType = trainedAlgorithmicMedia`, 2026-09-30). **Owner decision: keep it exactly as designed**; the audit must record the page-weight and provenance facts.
- Permanently dark: `<html data-theme="dark">`, so the light-mode token set is unreachable in that file.
- Header search is `readonly`, self-labelled "(search goes live in the demo)".
- No stock check on add-to-cart; cart/orders in memory only (lost on refresh).
- `place()` fabricates an order number and always stores status `0`; the toast claims "SMS and email sent" when nothing is sent.
- Shop carries the note "Sort and filters connect to the database later"; no sort control exists.
- Home category indices are hardcoded (`[2,4,5,7]` for "You may also like").
- Variant option names (`Pack`, `Colour`, `Size`, `Weight`) are business taxonomy hardcoded in JS.
- Money format and the free-delivery threshold/fee (`10000` / `450`) are inline literals, not config.
- Accessibility: `alt=""` on cart thumbnails; checkout inputs have no `name` attributes and bare `<label>` with no `for`/`id`; toast relies on `role="status"` without `aria-live`; countdown text has no accessible label.
- Design-token contrast risks flagged by `DESIGN.md` and confirmed in source: gold `#a98733` text on green `#0b3d2a`, and `#2a2000` on the gold announcement bar. **These must be measured in the browser** (§7).
- Mixed line endings across `design/` (CRLF in the video file, LF in `waseem-sports.html`).

### F11 — Feature request captured during the interview: admin photo crop + text detection
The owner's own words: the product photos used to have text baked in; an AI was asked to remove it; he wants to **crop photos in the admin product page** when adding a product, including a TypeScript text-recognition step, with **auto-detect then auto-crop, and the user still able to change the crop**. Scope: **product photos only**.

---

## 4. Decisions taken (owner-confirmed)

| # | Decision | Answer |
|---|---|---|
| 4.1 | **Canonical design** | `design/waseem-sports-video.html` — everything else moves to `design/unwanted-designs/` |
| 4.2 | Real business facts | Address, phone, WhatsApp are **real, use as-is**; all contact details become **admin-editable** (address, phone, email, WhatsApp) |
| 4.3 | The 11 product photos | **Keep them — do not remove.** If no photo exists, the storefront shows a **neutral "no photo yet" block** |
| 4.4 | Crop + text-detect feature | **Auto-detect → auto-crop, owner can adjust the crop**; product photos only; documented in **PHASE 04 + DECISIONS.md** |
| 4.5 | Hero background video | **Keep exactly as designed** (inlined base64). Audit records weight + AI provenance |
| 4.6 | Archive location | `design/unwanted-designs/` — **move** (not copy, not delete) |
| 4.7 | Repair scope | All five: the two Phase 00 docs, handoff-package defects, `DATABASE.md` corrections, and the migration hardening; plus "fix whatever else you think needs fixing" |
| 4.8 | Hosting | **GoDaddy Node.js Hosting** for the app; **Supabase** remains database/auth/storage, reached **only over HTTPS** |
| 4.9 | Stack | **Next.js** (owner-confirmed: "I want to make this entire project in Next.js") |
| 4.10 | Skills | Use the **workspace-root** skills; the project does not need its own copy |
| 4.11 | Verification | **Render the canonical HTML in the real browser** and capture computed values / contrast — screenshots are not saved into the repo |
| 4.12 | Spec location | `specs/phase-00-fix-spec.md` |
| 4.13 | Migration strategy, SQL depth, token format, GoDaddy plan tier, cron approach, git committing | **Delegated: "whatever you recommend"** → see §5 |

---

## 5. Recommendations I am making on the owner's behalf (§4.13)

Each of these is a decision I own and must record in `docs/DECISIONS.md` with its reasoning, so it can be reversed in one place.

### 5.1 Migration strategy — edit `0001_init.sql` in place
No environment has ever applied it (no Supabase project exists, `DATABASE.md` line 3 states it has never been run). `CLAUDE.md`'s "never edit applied migrations" therefore does not apply, and an in-place edit leaves a single clean history for a schema that has no deployed ancestors. From the moment a real environment applies it, the rule binds again and all further changes become new `0002_*.sql` files.
**Record as:** DECISIONS entry, plus a header comment in the migration stating it has been hardened in Phase 00 and not yet applied anywhere.

### 5.2 Contact values to seed (researched 2026-10-06)
Owner-confirmed real: **130/6 Golden Plaza, Main Street, Colombo 11**, phones **077 009 0147** and **075 613 0147** (hotline), WhatsApp delivery offered worldwide — from the shop's own Facebook page post. Supporting/independent listing: chichi.lk `waseem_sports`, "Main Street Colombo 01, Pettah" +94 71 588 0228.
Notes and cautions:
- The mockups' "Malwatta Road" address was found in **no** source and is treated as invented.
- Several similarly named businesses exist (`waseemsports.com` and Instagram `@waseem.sports` are manufacturer/exporter businesses; they may be unrelated). Research is not proof of identity.
- **Email and opening hours were not confirmable → VERIFY.** The `plawra2024@gmail.com` address on a marketplace listing is not evidence of the shop's own email. The `Poya closed` / Sunday hours in the mockup remain unverified.
- Therefore: seed the confirmed address + two phones + WhatsApp; leave email and hours **blank, flagged VERIFY** in `docs/DECISIONS.md`, and let the owner fill them in admin. Never render a blank contact value on the storefront — hide the row.

### 5.3 Token format — Tailwind v4 CSS-first `@theme`, plus a raw variable table
`DESIGN-TOKENS.md` ships **both**: (a) a ready-to-paste Tailwind v4 `@theme` block using the canonical palette and type scale, and (b) a human-readable table of the same tokens with source line references, usage notes and measured contrast ratios. Rationale: the app is Next.js + Tailwind (per `ARCHITECTURE.md`), Tailwind v4's CSS-first `@theme` is the current configuration model and matches what `design/Another design` already used, and the raw table keeps the design auditable without reading Tailwind docs.

### 5.4 Stack versions (researched 2026-10-06)
- **Next.js 16.x latest stable** (16.3.x line; 16.4 in canary). Next.js **15 reaches EOL on 21 Oct 2026** — two weeks after this spec is written — so pinning 15 is rejected.
- **Tailwind CSS v4** (CSS-first `@theme`), **TypeScript strict**, **zod** at every server boundary.
- `@supabase/supabase-js` + `@supabase/ssr`; **supabase-js over HTTPS only** — no `pg`, Prisma or Drizzle (they need ports GoDaddy blocks).
- `sharp` for upload re-encode (bundled with Next.js).
- **Vitest** (unit) + **Playwright** (e2e) + SQL tests for stock concurrency. _Corrected 2026-10-07: Vitest and Playwright were **never installed**; the project has no test runner. Verification is `npm run typecheck` / `npm run lint` / `npm run build` plus the SQL/RPC suites (`supabase/tests/`, the gitignored `.tmp/`)._
- **VERIFY at PHASE 01 install time:** exact current latest patch versions, and that nothing in the stack needs a blocked outbound port (the only allowed egress is 80/443).

### 5.5 Rate limiting (DECISION D8) — Postgres table
With GoDaddy + Supabase-only access, a Postgres-backed rate limiter adds no new vendor, no new key, and no new port. A hosted KV would introduce another external dependency for a store at this scale. **VERIFY** the exact limits at PHASE 01 and configure Supabase Auth's own limits.

### 5.6 Scheduled jobs — Supabase `pg_cron` calling the app over HTTPS
Persistent-process hosts make an in-process timer possible, but a database-scheduled job that calls `/api/cron/*` with `SCHEDULED_JOBS_SECRET` over 443 survives app restarts and multiple instances, needs no Vercel Cron, and keeps the secret check in one place. **VERIFY** `pg_cron` + `pg_net` availability on the chosen Supabase plan at PHASE 06; the in-process timer stays as the documented fallback.

### 5.7 Email provider class — HTTPS API only
GoDaddy blocks outbound SMTP and runs a loopback gateway on port 2525 for its own helper. Therefore every email provider behind the `Notifier` abstraction must expose an **HTTPS API** (not SMTP-only). This narrows DECISION D4 but does not choose a vendor; sending stays disabled until a provider is configured and its docs are verified.

### 5.8 GoDaddy plan tier — start on the free preview tier, buy Deluxe when staging is needed
The owner's framing was "front end is GoDaddy, back end is Supabase" and he was unsure about plans. Recommendation: prove the Next.js build deploys on the **free preview tier** (no plan, no card, private preview apps) in PHASE 01, then buy **Deluxe** when a real staging app is needed alongside production (Economy allows only 1 published app, so it cannot host both).
Constraints to record now: one app per upload; zip ≤ 100 MB or GitHub deploy; region (NA/EU) chosen before the first deploy; suspended plan stops serving but deletes nothing; cancelled plan freezes apps for 30 days then deletes apps, secrets, databases and storage.

### 5.9 Git — the project is untracked; two commits, Waseem paths only
`Projects/Waseem-sports` has **never been committed** (`?? ./`), so there is no baseline to diff against and the first commit necessarily adds the whole package. Plan:
1. **Initial commit of the package as received** — the handoff docs, `phases/`, `prompts/`, `supabase/`, the canonical design file and its assets, and `specs/`. This captures the received state *before* my edits, so the owner can see exactly what I changed. Risk to flag at execution time: committing the received state means `docs/AUDIT.md` and `docs/DESIGN-TOKENS.md` are absent in that commit, which is intentional (they are the next commit's content, and it keeps "what was handed to me" separate from "what I produced").
2. **Phase 00 outputs** — the two audit docs, the reorganisation, doc corrections, migration hardening, package repairs.
The surrounding workspace repo holds many unrelated modified/deleted files from other projects; stage explicit Waseem paths only (never `git add -A` / `git add .`), and nothing outside `Projects/Waseem-sports` may be staged or touched. Note that `design/unwanted-designs/` is gitignored, so the archived designs stay local and out of both commits.

### 5.10 Database design choices inside the hardening
- **`variant_availability` stays a `security definer` view** (not `security_invoker`), because it is an intentional public projection and anon has no `inventory` policy. Instead it is made **safe by construction**: restrict the exposed columns to `(variant_id, product_id, status)` — no counts — and add `published`, not-deleted, visible and `track_inventory` filters. Rationale recorded in the migration comment and `DATABASE.md`.
- **Writes become service-role-only** for `inventory`, `inventory_movements`, `orders`, `order_items`, `order_status_history`, `payment_transactions`, `webhook_events`, `audit_logs`: admins keep RLS **read** access, and all mutations go through server actions that call `requireAdmin(role)` and then the service-role client. This is exactly the flow `ARCHITECTURE.md` already describes, and it removes the F5.2 bypass.
- **Role-aware authorization** gets a dedicated helper (`is_admin()`, plus a role-list variant) so the `SECURITY.md` matrix is expressible; `admin_users` writes stay service-role-only.
- **`place_order`** reads reserve/commit policy and shipping fee from the database rather than trusting the caller (F5.5, F5.6), handles the idempotency race with `on conflict` + re-select (F5.4), and raises named errors for malformed input (F5.12).
- Invented constants become settings with a recorded default: per-variant max quantity (F5.7) and the order-number prefix (F7).

---

## 6. Deliverables and acceptance criteria

### 6.1 Files to create

| Path | Purpose | Acceptance |
|---|---|---|
| `specs/phase-00-fix-spec.md` | This document | exists; every interview decision recorded |
| `docs/AUDIT.md` | PHASE 00 deliverable | Names files and sections specifically (file + line), not generically. Covers: the four designs and why C is canonical; the canonical file's full section/component inventory; hardcoded business data with locations; images and their form; interactions and what is broken; accessibility gaps; the AI-video provenance; what conflicts with `ARCHITECTURE.md`/`DATABASE.md`; the browser-render results including measured contrast |
| `docs/DESIGN-TOKENS.md` | PHASE 00 deliverable | Tailwind v4 `@theme` block + raw token table with source lines, usage notes, measured contrast; component inventory mapped to CMS section types; responsive/motion/accessibility rules |
| `design/README.md` | Fixes F4.1 | Names the canonical file; states that everything else is archived; documents `Logo.png` / `Background.mp4` provenance and status |
| `design/unwanted-designs/README.md` | Archive provenance | States what each archived design was, why it was superseded, and that nothing should build on it |
| `Projects/Waseem-sports/.gitignore` | Fixes F4.2 | Ignores `node_modules/`, `.next/`, `.env*` **except `.env.example`**, `*.log`, OS junk, `.tmp/`, and `design/unwanted-designs/` |
| `docs/PHOTO-PIPELINE.md` *(or a section in DECISIONS.md — decide during execution)* | F11 feature record | The crop + text-detect feature spec: behaviour, where it lives (PHASE 04), what is auto vs manual, failure modes, and the OCR approach marked VERIFY |

### 6.2 Files to modify

| Path | Change |
|---|---|
| `supabase/migrations/0001_init.sql` | Hardening per §5.10: role-aware helper, service-role-only writes, view projection fix, `place_order` idempotency + DB-sourced shipping fee/policy + named errors, `track_inventory` consistency in `commit`, FK on `inventory_movements.order_id`, `store_settings` updated_at trigger, `admin_adjust_stock(...)` with ledger, constants moved to settings |
| `supabase/seed.sql` | Contact + currency + policy setting keys; remove invented values; keep `cod.reserve_stock_on` as a documented placeholder |
| `docs/DATABASE.md` | Correct the three wrong claims, add the 12 undocumented columns, restate the stock lifecycle to match the SQL, mark the PHASE 02 to-do list accurately |
| `docs/DECISIONS.md` | New/updated entries: canonical design, hosting (D10), contact facts, photos + neutral placeholder, crop feature, order prefix, max qty per variant, email-over-HTTPS (D4), rate limiting (D8) |
| `docs/DESIGN.md` | Name the canonical file; keep the brand direction; point at `DESIGN-TOKENS.md` |
| `docs/ARCHITECTURE.md` | Hosting → GoDaddy (replace Vercel); persistent-process constraints (PORT binding, HTTPS-only egress, no SMTP); cron via `pg_cron`; Supabase-over-HTTPS-only rule |
| `docs/DEPLOYMENT.md` | Rewrite for GoDaddy Node.js Hosting: deploy contract checklist, env vars, region, plan allowances, backups/restore, where `Logo.png`/`Background.mp4` end up |
| `docs/FOLDER_STRUCTURE.md` | Add `specs/`, `design/unwanted-designs/`, `design/README.md`, `docs/AUDIT.md`, `docs/DESIGN-TOKENS.md`; correct the Vercel assumptions; note `/public/assets/` persistence rule |
| `README.md` | Fix the dangling `design/README.md` reference; point at the canonical design; note the GoDaddy/Supabase split |
| `AGENTS.md` | Correct the H1 (F4.3); keep content identical in intent to `CLAUDE.md` |
| `HANDOFF.md` | Record: Phase 00 closed, canonical design, hosting change, photos kept, crop feature queued, blockers resolved with pointers |
| `.env.example` | Only additions that a verified constraint requires (e.g. contact/`public.` settings are DB rows, not env vars) — no invented keys |

### 6.3 Files to move

```
design/Waseem Sports — claude Demo.html      → design/unwanted-designs/legacy-claude-demo/Waseem Sports — claude Demo.html
design/Waseem Sports — claude Demo.bak.html  → design/unwanted-designs/legacy-claude-demo/Waseem Sports — claude Demo.bak.html
design/waseem-sports.html                    → design/unwanted-designs/legacy-waseem-sports/waseem-sports.html
design/Another design/ (whole folder)        → design/unwanted-designs/another-design/
```

Two subfolders are required because `design/waseem-sports.html` and `design/Another design/waseem-sports.html` are **different designs with the same filename**.
Stays in `design/`: `waseem-sports-video.html` (canonical), `Logo.png`, `Background.mp4`, the new `README.md`.
`design/unwanted-designs/` is gitignored so the ~69-package `node_modules` tree it carries does not enter the repository. The owner chose "move"; this preserves that while keeping the repo clean. **Nothing is deleted.**

### 6.4 Explicitly not in scope
- Any application code (`src/`, `package.json`, `next.config.*`) — that is PHASE 01
- Applying the migration to a real Supabase project, generating `src/types/database.ts`, writing SQL concurrency/RLS tests — that is PHASE 02
- Choosing a card payment provider, a notification vendor, or an OCR library vendor
- Redesigning the canonical design, or rebuilding `Another design/` in Next.js
- Removing the product photos, or cropping the baked-in price overlays (kept per §4.3)
- Touching any file outside `Projects/Waseem-sports`

### 6.5 Already created alongside this spec (not part of the execution pass)

| Path | Why it exists |
|---|---|
| `SESSION-HANDOFF.md` | The resume document, so a cleared/fresh session can pick this work up. Sibling projects in this workspace all keep their session handoff at the project root, but here that name collides: on Windows `handoff.md` **is** `HANDOFF.md`, which is the client's original brief. The distinct name is deliberate. It records this session's goal, state, active files, changes, failed attempts and next steps |
| `specs/README.md` | Documents the `specs/` convention and this spec's status (draft → approved → executed) |
| `HANDOFF.md` (banner added) | A pointer at the top of the client's brief so no future agent writes a session handoff over it |
| `specs/whatsapp-waha-spec.md` | Feature spec for the owner's 2026-10-06 WhatsApp decision: the Supabase/VPS hosting verdict, the modular `Notifier` design, admin-editable numbers + QR re-pairing, the retry-only failure policy, the ban risk and its mitigations, local test setup, and the PHASE 06 test list |
| `specs/product-image-pipeline-spec.md` | Feature spec proposing the concrete product-photo pipeline for approval before PHASE 04: stages, exact output sizes/formats, crop + baked-in-text detection, opt-in cut-out, size budgets, acceptance tests |

Everything else in §6.1–§6.3 is still to be produced by the execution pass.

---

## 7. Verification plan

### 7.1 Browser verification of the canonical design (required by PHASE 00)
Load `design/waseem-sports-video.html` in Chrome (file URL is sufficient; it self-contains fonts via Google Fonts and the video via base64). Capture into `docs/AUDIT.md`:
1. **Computed styles** for each typographic role (announcement, logo, h1 hero, section h2, product name, price, body, table, admin h1): resolved `font-family`, `font-size`, `font-weight`, `line-height`, `letter-spacing`, `text-transform`.
2. **Resolved colour values** for every token as actually painted in dark mode (the file is `data-theme="dark"`), confirming the CSS variable set is the one that ships.
3. **Contrast ratios** for the pairs `DESIGN.md` warns about: gold-on-green (`#a98733` / `#c7a14a` on `#0b3d2a`, `#062418`, `#0f4530`) and the announcement bar (`#2a2000` on `#a98733`). Report measured ratios against the AA thresholds **for the actual rendered size** (large-text vs normal-text rules), and mark any failure as a required design fix rather than silently "improving" it.
4. **Route renders:** `#/`, `#/shop`, `#/product/0`, `#/cart`, `#/checkout`, `#/account`, `#/admin` — confirm each renders, note console errors, and record what is broken or obviously fake.
5. **Asset reality check:** the hero video element mounts and plays; `prefers-reduced-motion: reduce` hides it; the inlined video's byte weight and its C2PA provenance; whether `Logo.png`/`Background.mp4` match what the page actually uses.
6. **Layout measurements:** container max-width, product-grid minimum tile width, radii, and any shadow values that need to become tokens.
Screenshots are **not** saved into the repo (§4.11); findings are recorded as measurements and notes.

### 7.2 Document and SQL verification
- Re-read every file I edit and confirm each claim in `AUDIT.md` has a file + line behind it.
- For the migration: no environment can run it yet, so verification is a careful **syntax and semantics review** (balanced `$$`, matching `revoke`/`grant` argument lists after any signature change, policy names unique, functions still `security definer` with pinned `search_path`, every new setting key present in `seed.sql`, every table still covered by the RLS-enable loop). **The migration is not claimed to be applied or executed** — that is PHASE 02's job, and this spec says so.
- Cross-check the repaired `docs/DATABASE.md` against the SQL line by line, both directions.
- Run a link check over `docs/` and the root markdown for dangling references (the class of defect F4.1 came from), and a grep for the `Vercel` assumption after the hosting change so no stale reference survives.
- Confirm no secrets were introduced: `git diff` review, and no value from any real `.env`.

### 7.3 What will not be verified
- The migration executing successfully against a live Postgres/Supabase — deferred to PHASE 02
- The app building or deploying on GoDaddy — deferred to PHASE 01 (the free preview tier is where that is proven)
- Pixel-accurate visual parity with the original design beyond the token extraction above
- Anything on mobile devices; browser checks are desktop Chrome only

---

## 8. Consolidated VERIFY / DECISION REQUIRED register

Carried into `docs/DECISIONS.md` on execution. "VERIFY" = needs research/docs before it can be built; "ASK" = needs the owner.

| ID | Type | Item | Blocking |
|---|---|---|---|
| V1 | VERIFY | Shop **email address** — not confirmable from research | PHASE 05 (notifications), storefront contact block |
| V2 | VERIFY | **Opening hours** (the two mockup sets contradict each other and neither is verified) | Storefront footer/contact |
| V3 | VERIFY | GoDaddy **deploy contract revision** and the exact `start`/`PORT`/`0.0.0.0` requirements before the first deploy | PHASE 01 |
| V4 | VERIFY | `pg_cron` + `pg_net` availability on the chosen Supabase plan | PHASE 06 |
| V5 | VERIFY | Current latest patch versions for Next.js 16, Tailwind v4, `@supabase/ssr`, Vitest, Playwright; and that no dependency needs a blocked outbound port | PHASE 01 install. **Closed 2026-10-07:** versions pinned (Next 16.3.8, React 19.2.8, Tailwind v4, zod 3.24, sharp 0.34 — `docs/ARCHITECTURE.md`), no dependency needs a blocked port, and Vitest/Playwright were never installed (no test runner exists) |
| V6 | VERIFY | Whether GoDaddy's CDN caches `next/image` optimized responses, and whether multi-instance scaling would desync the ISR/revalidate cache | PHASE 01/04 |
| V7 | VERIFY | OCR approach for the crop feature (browser-side vs server-side), including dependency size, accuracy on real product photos, and cost — the owner chose behaviour, not implementation | Before PHASE 04 builds it |
| V8 | VERIFY | Whether `Logo.png` is the real brand logo, and whether `Background.mp4` is the same clip as the inlined hero video | PHASE 04 header/assets |
| V9 | VERIFY | Card payment provider availability in Sri Lanka (existing DECISION D3) — now also constrained to HTTPS webhooks, which every provider offers | PHASE 08 |
| V10 | VERIFY | **Email** vendor reachable over an HTTPS API only (GoDaddy blocks SMTP) — the remaining half of D4. WhatsApp is now **decided**: WAHA, self-hosted | PHASE 06 |
| WA-V1…V7 | VERIFY | WAHA engine choice, production install guide, VPS sizing/region, session status list, Plus-only features, Sri Lankan phone formats, webhook event types — `specs/whatsapp-waha-spec.md` §10 | PHASE 06 |
| IM-V1…V8 | VERIFY | Image pipeline: whether prices are inside the images, photo→product mapping, cut-out library version/perf, OCR accuracy, container memory for sharp, Next image optimisation behind the CDN, total photo count, paper-bake option — `specs/product-image-pipeline-spec.md` §8 | PHASE 04 |
| V11 | VERIFY | Supabase Auth email-sending limits (existing SECURITY item 6) | PHASE 01 |
| V12 | ASK | `orders.customer_phone` index: keep (fast support lookup) or drop (privacy)? | PHASE 02 |
| D2 | ASK | `cod.reserve_stock_on` — `placed` (seed placeholder, oversell-safe) vs `confirmed` | PHASE 05 |
| D5 | ASK | Shipping fees/thresholds/ETAs — none seeded; the mockup's free-over-10,000 + 450 fee are invented | PHASE 05 |
| D7 | ASK | Returns/refunds policy | PHASE 05+ |
| D11–D16 | ASK | Out-of-stock display, required checkout fields, low-stock threshold, tax/VAT, analytics scope, legal pages | PHASE 04/05 |
| D-NEW-1 | ASK | Order-number prefix: seed `WS` as an editable placeholder, or leave it and fall back to `ORD`? | PHASE 02 |

---

## 9. Execution plan (the pass that follows approval)

Ordered, each step reviewable on its own:

1. **Pre-flight** — `git status` on the Waseem paths only; confirm no unrelated file will be staged; create `specs/` and the archive folders.
2. **Design reorganisation** — move the four leftovers into `design/unwanted-designs/` with the subfolder layout in §6.3; write `design/README.md` and the archive README; create the project `.gitignore` (which also protects the archive). Verify: the canonical file is untouched and still opens; the moves are exact; no file was deleted.
3. **Browser render** — the §7.1 capture against the canonical file.
4. **Write `docs/AUDIT.md`** — findings F2, F3, F4, F10, F11 + the render results + the conflicts against `ARCHITECTURE.md`/`DATABASE.md`, every claim carrying file + line.
5. **Write `docs/DESIGN-TOKENS.md`** — the §5.3 token set, component inventory mapped to CMS section types, and the accessibility/motion rules.
6. **Repair the package** — F4.1–F4.3, F4.5, F4.9: `README.md`, `AGENTS.md`, `.tmp/` handling, `FOLDER_STRUCTURE.md`.
7. **Correct `docs/DATABASE.md`** and add `docs/DECISIONS.md` entries (§6.2).
8. **Rewrite the hosting story** in `ARCHITECTURE.md` + `DEPLOYMENT.md` (§5.8, §5.4, §5.6, §5.7).
9. **Harden the migration + seed** (§5.10) and verify per §7.2.
10. **Record the crop feature** (F11) in DECISIONS.md + the PHASE 04 notes.
11. **Update `HANDOFF.md`** and write the session handoff/next-steps note.
12. **Self-check** — walk PHASE-00's six tasks and both acceptance criteria; report honestly what passed, what did not, and what was not verified.
13. **Two commits** (§5.9), naming Waseem paths explicitly.
14. **STOP** — summary + risks, then wait for approval before PHASE 01.

---

## 10. Risks

| Risk | Mitigation |
|---|---|
| Moving `Another design/` carries ~69 packages of `node_modules` | Archive folder is gitignored; nothing is deleted; the tree can be re-installed from its lockfile if ever needed |
| Filenames contain spaces and an em dash; a shell script could mangle them | Quote every path; verify counts before/after the move |
| The migration hardening is unexecutable until PHASE 02, so a mistake stays hidden | Keep changes surgical and review-level verifiable; PHASE 02's SQL tests (concurrency, idempotency, RLS as anon/admin) are the real gate and are explicitly deferred, not skipped |
| Removing the `admin all` policies changes how the admin UI must write data | The service-role-after-`requireAdmin()` flow is already the documented architecture; PHASE 03/05 admin actions must be built that way, and this becomes a stated constraint, not a surprise |
| GoDaddy's egress limits could invalidate a library choice later | Egress rule recorded in `ARCHITECTURE.md`; V5 checks every dependency |
| The AI-generated hero video is kept against a design brief that bans AI clichés | The owner decided explicitly (§4.5); the audit records the provenance and weight so it can be revisited with facts |
| Contact values come from a 2021 Facebook post and a marketplace listing | Only confirmed values are seeded, each with its source recorded; email and hours stay blank/VERIFY; research is never presented as authoritative |
| The workspace repo has many unrelated modified files | Stage explicit paths only; verify `git status` before each commit |
| **WhatsApp ban risk** — the owner chose the shop's own number, and WhatsApp bans unofficial clients (WAHA's own docs say so; a WAHA issue reports bans after ~1 month and ~4 days; 2026 analysis claims >90 % of such bans are permanent) | Owner accepted the risk (W3). Mitigations in `specs/whatsapp-waha-spec.md` §7: order notifications only, rate limits, no retry storms, session health monitoring, a kill switch, and modularity so the official Cloud API can replace WAHA without touching orders |
| **Product images may not be fully recoverable from the design file** — they are base64 blobs inside HTML, and the photo→product mapping is positional | Extraction is a PHASE 04 pre-step with eye-confirmation of the mapping; originals are stored in the private `originals/` prefix so nothing is lost or re-derived |
| **WAHA is a new infrastructure dependency** that GoDaddy cannot host, so notifications depend on a VPS being up | Host decided as a VPS (§3 of the WAHA spec); a WAHA outage queues notifications instead of losing them, and never affects an order |

---

## 11. Approval checklist

Waiting on the owner for:
- **V1** shop email address
- **V2** opening hours (and whether Poya-day closing applies)
- **V8** whether `Logo.png` is the real brand logo and whether `Background.mp4` is the hero clip
- **D5** shipping rules (fee, free-delivery threshold, delivery estimates, and whether the mockup's "free over LKR 10,000 / 450 fee" is real)
- **D2** whether stock reserves on order placement or on confirmation
- **D12** required checkout fields, and **D11/D13** out-of-stock display and low-stock threshold
- **D-NEW-1** order-number prefix
- **Approval of the two new feature specs** written from your 2026-10-06 requirements: `specs/whatsapp-waha-spec.md` and `specs/product-image-pipeline-spec.md` (both draft)
- Confirmation that §5's nine recommendations are acceptable as defaults
- **No longer open** (answered this session): the WhatsApp provider (WAHA), the sending number (the shop's own — ban risk accepted), the failure policy (retry WhatsApp only + admin alert), and the image approach (normalise by default, opt-in cut-out)

Everything else is settled, and no file has been changed yet.

---

## 12. Changelog

| Date | Change |
|---|---|
| 2026-10-06 | Initial spec — created after 6 interview rounds, a five-worker read-only audit of `design/`, the SQL and the handoff package, and web research into the real business, GoDaddy Node.js Hosting, and current Next.js/Tailwind versions |
| 2026-10-06 | Added the owner's WhatsApp + product-image requirements: two feature specs written (`specs/whatsapp-waha-spec.md`, `specs/product-image-pipeline-spec.md`); §6.5, the VERIFY register, the risk table and the approval checklist updated. **Supabase ruled out as a WAHA host** — Edge Functions are request-scoped (400 s wall clock, 256 MB), cannot run Docker or Chrome, and cannot hold a WhatsApp session |
| 2026-10-06 | **Phase files amended at the owner's instruction** so a future session can continue cold: all 12 `phases/*.md` gained dated `## Amendments — 2026-10-06` blocks (owner decisions mapped per phase + "cannot be tested in this phase" lists). Bodies left byte-identical. New skill `.agents/skills/change-with-continuity/SKILL.md` created encoding the amend-edit-record-verify workflow; `skills-lock.json` untouched (community-source manifest only) |
