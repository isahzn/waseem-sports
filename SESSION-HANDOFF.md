# SESSION-HANDOFF — for the next session (resume here after /clear)

> **Read order:** this file → `specs/phase-00-fix-spec.md` (the full plan) → `CLAUDE.md` (rules) → `HANDOFF.md` (the client's original brief).
> **`HANDOFF.md` is the client's received brief — never overwrite it.** This file is deliberately named `SESSION-HANDOFF.md` because on Windows `handoff.md` and `HANDOFF.md` are the same file.

**Last session:** 2026-10-07 (Phase 05 built + verified end-to-end, then **Phases 00–05 committed and pushed to the project's own repo** — `7f66b18` on `main`) · **Project:** Waseem Sports · **Working dir:** `executive agent/Projects/Waseem-sports`

> **Repository (changed 2026-10-07):** the project now has its **own** git repository at `Projects/Waseem-sports` with `origin = https://github.com/isahzn/waseem-sports.git`. Commit and push project work **there** from now on — it holds the whole package plus the Phases 00–05 history (220 files). The surrounding workspace repo still tracks the same paths for its own history; it is unrelated to this project and is never the place to commit Waseem work. `.env` (live keys) and `supabase/.temp/` (machine-local CLI state) are gitignored and were verified absent from the pushed tree.

---

## START HERE — which phase, and exactly where we left off

**Phase to start at: PHASE 06 (`phases/PHASE-06-notifications.md`) — the MVP code (Phases 01–05) is written and verified; the only MVP work still owed is an admin click-through with a real account. First, the owner decides whether to commit Phases 01–05.** Records: Phase 05 → `phases/PHASE-05-checkout-orders.md` § Execution record; Phase 04 → `phases/PHASE-04-storefront.md` § Execution record + `docs/EXTRACTED-PHOTOS.md`; Phase 03 → `phases/PHASE-03-cms.md`.

**PHASE 05 (2026-10-07) in one paragraph:** storefront checkout (`/checkout`) → COD order → tokenized confirmation/tracking (`/order/<number>?t=`) → `/track` lookup, plus admin orders (list/detail/status transitions/stock actions/notes/audit, new-orders badge), admin shipping rules CRUD with the D2 reserve-policy toggle, and the dashboard. Verified: `tsc`/eslint/`next build` clean (41 routes) · live RPC suite 16/16 · pure-logic suite 8/8 · browser E2E 19/19 (real Chrome placing a real order). Four real defects were found and fixed on the way (details in the phase record): the anon `inventory` read that made every cart line "out of stock" (→ D34), the undecoded server-side cart cookie, the Phase 03 `p_delta`/`p_on_hand_delta` RPC argument bug, and the empty `store_settings` in the dev project (→ D35). Test data was cleaned up and demo stock restored.

**Position:** PHASE 00 EXECUTED 2026-10-06 (spec §9 steps 1–13). All deliverables produced and committed in two commits (see Commits below). The phase file is `phases/PHASE-00-audit.md`; the plan of record is `specs/phase-00-fix-spec.md` §9.

| PHASE 00 step (spec §9) | Status |
|---|---|
| 1. Pre-flight (`git status`, create `specs/`, archive folders) | ✅ Done — Waseem tree fully untracked, unrelated workspace files untouched |
| 2. Design reorganisation → `design/unwanted-designs/` | ✅ Done — 4 leftovers moved (3 subfolders), canonical md5-verified untouched |
| 3. Browser render of the canonical design (spec §7.1) | ✅ Done — headless Chrome CDP, all 7 routes, 0 JS errors, full contrast table |
| 4. Write `docs/AUDIT.md` | ✅ Done — file + line throughout, render results inside |
| 5. Write `docs/DESIGN-TOKENS.md` | ✅ Done — Tailwind v4 `@theme` + raw table + CMS map |
| 6. Repair the handoff package | ✅ Done — `design/README.md`, archive README, project `.gitignore`, `AGENTS.md` title, `README.md`, `FOLDER_STRUCTURE.md`, `.tmp/` gitignored |
| 7. Correct `docs/DATABASE.md` + add `docs/DECISIONS.md` entries | ✅ Done — 12 columns, `track_inventory`, race-free lifecycle, D4/D8/D10/D17–D31 |
| 8. Rewrite the hosting story in `ARCHITECTURE.md` + `DEPLOYMENT.md` | ✅ Done — GoDaddy contract, HTTPS-only egress, no-SMTP rule (also DESIGN/FOLDER_STRUCTURE/README/HANDOFF) |
| 9. Harden `supabase/migrations/0001_init.sql` + `seed.sql` | ✅ Done — §5.10 in full; libpg_query parse 99 stmts OK; NOT applied anywhere |
| 10. Record the crop + text-detection feature (PHASE 04 + DECISIONS) | ✅ Done — D20 + PHASE-04 amendment |
| 11. Update `HANDOFF.md` (client brief) | ✅ Done — status section rewritten, stack/notifications/design/photos/conflict bullets updated |
| 12. Self-check against PHASE-00's acceptance criteria | ✅ Done — both criteria met (see Self-check below) |
| 13. Two commits (design reorg, then Phase 00 outputs) | ✅ Done — Waseem paths only, hashes below |
| **Delivered earlier** | `specs/phase-00-fix-spec.md`, `SESSION-HANDOFF.md`, `specs/README.md`, `specs/whatsapp-waha-spec.md`, `specs/product-image-pipeline-spec.md` |

**First action for the next session:** get the owner's go-ahead and commit Phases 01–05 (Waseem-only paths, never `git add -A`), then create the first admin account (DEPLOYMENT.md setup step 2) and walk the admin screens with a real session — that click-through is the one MVP proof still missing. After that, start `phases/PHASE-06-notifications.md`. Phase 02 record lives in `phases/PHASE-02-database.md` § Execution record + `docs/RLS-MATRIX.md`; Phase 01 in `phases/PHASE-01-foundation.md`. Still awaiting owner input: spec §11 answers (shop email V1, opening hours V2, D12 field confirmation, D11/D13) + the two feature specs + the new D34/D35 decisions — none of them gate Phase 06 except the D5 delivery rules the owner must enter before launch.

**Phase order for context (from `HANDOFF.md`):** MVP = PHASES 0–5 (catalog, cart, COD checkout, orders, admin) → then 6 notifications, 7 page builder, 8 cards, 9 image search, 10–11 hardening/QA. Do not start 7–9 before 0–5 are solid.

---

## Goal

Close **PHASE 00** of the Waseem Sports build. The session started from the owner's question `do you have an issue`, which resolved to: *diagnose the Phase 00 blockers, and fix them in the same pass.*

That produced a full specification. **Execution has not started — it is waiting on owner approval.**

---

## Current state

| Area | State |
|---|---|
| `specs/phase-00-fix-spec.md` | ✅ Executed (§9 steps 1–13). Was the plan of record. |
| `docs/AUDIT.md`, `docs/DESIGN-TOKENS.md` | ✅ **Exist** — browser-measured, file + line specific. Acceptance met. |
| Design reorganisation | ✅ Done — `design/` holds canonical + `Logo.png` + `Background.mp4` + `README.md`; rest in gitignored `unwanted-designs/` |
| `docs/DATABASE.md` corrections | ✅ Done — matches the hardened SQL |
| Migration hardening | ✅ Done — §5.10 in full, libpg_query parse clean (99 stmts). **Never applied anywhere** — PHASE 02 applies it. |
| Hosting story | ✅ GoDaddy everywhere (ARCHITECTURE, DEPLOYMENT rewritten, DESIGN/FOLDER_STRUCTURE/README/HANDOFF updated) |
| Contact/claim business facts | ✅ Seeded (address, 2 phones, WhatsApp, currency, prefix, max-qty); email/hours blank + VERIFY |
| Application code | ✅ Phase 01 foundation (2026-10-06, env renamed + re-verified same day): Next 16.3.8 + Tailwind v4 scaffold, Supabase clients, admin auth shell, security baseline, `server.js` GoDaddy entry. Verified: typecheck/lint/build clean, SERVICE_ROLE grep empty, live `server.js` proof with real keys (`supabaseConfigured:true`). Only untested: real-admin login/403 (needs owner creation), reset-email delivery, GoDaddy preview deploy |
| Git | ✅ Two Waseem-only commits on `master`: `1fb889d` (received baseline) + `e714659` (Phase 00 outputs; amended once to record these hashes — tree unchanged apart from this file). Workspace files untouched. |
| Photos in the design | ✅ Kept, per the owner. `Background.mp4` proven byte-identical to the inlined hero video. |
| WhatsApp + image specs | ✅ Still draft, awaiting approval — `specs/whatsapp-waha-spec.md`, `specs/product-image-pipeline-spec.md` |

**Nothing in this session changed any file except the four named in "Changes made" below.** Verified with `find . -newermt "-6 hours"` from the project root.

---

## Active files

- `specs/phase-00-fix-spec.md` — **created this session.** The complete Phase 00 brief: findings F1–F11, owner decisions 4.1–4.13, my nine recommendations (§5), deliverables (§6.1–§6.5), verification plan (§7), VERIFY register (§8), execution plan (§9, 14 steps), risks (§10), approval checklist (§11).
- `specs/README.md` — created this session: the `specs/` convention and each spec's status (all three are draft, awaiting approval).
- `specs/whatsapp-waha-spec.md` — created this session from the owner's WhatsApp requirement: the reason WAHA cannot run on Supabase, the VPS plan, the modular `Notifier` design, admin-editable numbers + QR re-pairing, retry-only failure policy, ban risk + mitigations, local Docker test commands, PHASE 06 test list.
- `specs/product-image-pipeline-spec.md` — created this session from the owner's product-photo requirement: the proposed pipeline with exact output sizes and formats, crop + baked-in-text detection (browser OCR), opt-in cut-out, size budgets, acceptance criteria.
- `SESSION-HANDOFF.md` — created this session (this file).
- `docs/AUDIT.md`, `docs/DESIGN-TOKENS.md` — **do not exist yet**; they are the first outputs of execution.
- `HANDOFF.md` — client's brief; a pointer banner was added at the top this session (content otherwise untouched).
- `CLAUDE.md` / `AGENTS.md` — the rules. `AGENTS.md` is mis-titled `# CLAUDE.md — …` (known defect F4.3, fix in execution).
- `supabase/migrations/0001_init.sql` — the schema to harden, per §5.10. Never applied anywhere.
- `design/waseem-sports-video.html` — **the canonical design** (owner decision 4.1).
- `phases/*.md` — all 12 now carry dated `## Amendments — 2026-10-06` blocks (owner decisions + "cannot be tested in this phase" lists). A cold session can continue from any phase file alone.
- `.agents/skills/change-with-continuity/SKILL.md` — new skill encoding this workflow (**project-local**, per the work-only-inside-this-folder rule; future sessions discover it via the project skills scan or this handoff).

---

## Changes made (this session)

All additive — nothing rewritten, nothing deleted:

1. `specs/phase-00-fix-spec.md` — created; later extended with §6.5 (the documents created alongside it) and with the WhatsApp/image requirements, the VERIFY register, the risk table and the approval checklist.
2. `SESSION-HANDOFF.md` — created (this file).
3. `specs/README.md` — created.
4. `HANDOFF.md` — added the naming/pointer banner plus the "Where we are right now" status section. Its five original sections are intact (verified).
5. `phases/*.md` (all 12) — appended dated `## Amendments — 2026-10-06` blocks: the owner's changes (GoDaddy hosting, WAHA notifications, product-photo pipeline, canonical design, Next 16, hardened-schema notes, seeded settings) and, in each file, a "Cannot be tested in this phase — prove later" list. Original bodies byte-identical.
6. `.agents/skills/change-with-continuity/SKILL.md` — created (owner request): the amend-edit-record-verify workflow as a reusable skill, with the Waseem phase amendments as its worked example. `skills-lock.json` deliberately untouched (it pins `npx skills add` community sources with hashes; a hand-authored skill has no source entry to pin).

No code, no SQL, no other document content, no file moved or deleted.

---

## Failed attempts / limitations (do not re-tread these)

1. **GoDaddy's own pages return 403 to automated fetches.** `godaddy.com/hosting/nodejs` and the Node.js Hosting FAQ could not be read directly. The deploy-contract facts in §F8 came from 2026-08-21 industry coverage that states it read the contract in a browser. Flagged **V3** — verify the contract revision before the first deploy.
2. **The canonical HTML cannot be read end-to-end.** Its base64 image/video arrays sit on single enormous lines that exceed the read limit. Mapping of the canonical file was done through its sibling `design/waseem-sports.html`; therefore line numbers quoted for the canonical file are **borrowed from the sibling**, and §7.1 requires the executor to re-read the canonical file and cite **its own** line numbers.
3. **A `find design -exec ls -ld` command timed out at 30 s** (it walked `Another design/node_modules`). Use targeted `ls` / `wc -l` instead of recursive `find -exec` in `design/`.
4. **The migration has never been executed**, so no SQL behaviour was proven — only read. PHASE 02 is where SQL tests (concurrency, idempotency, RLS as anon/admin) must run. Do not claim it works before then.
5. **No browser render has happened yet.** The §7.1 measurement pass still needs to be run against the canonical design.

---

## Decisions locked this session (do not re-litigate)

- **Canonical design:** `design/waseem-sports-video.html`. Everything else → `design/unwanted-designs/` (moved, never deleted), with subfolders because two different files share the name `waseem-sports.html`.
- **Hosting:** app on **GoDaddy Node.js Hosting** (persistent Node 22 process, bind `process.env.PORT`); **Supabase** stays the database/auth/storage, reached **only over HTTPS**. Direct Postgres ports and outbound SMTP are blocked by GoDaddy.
- **Stack:** Next.js **16** (15 hits EOL 21 Oct 2026), Tailwind **v4 CSS-first `@theme`**, zod, `@supabase/supabase-js` + `@supabase/ssr`, Vitest + Playwright, `sharp`.
- **Contacts:** 130/6 Golden Plaza, Main Street, Colombo 11 · 077 009 0147 · 075 613 0147 · WhatsApp. **Email and opening hours are unverified → VERIFY.** All contact fields must be admin-editable.
- **Photos:** keep the existing ones; fallback is a **neutral "no photo yet" block**.
- **Photo crop + text detection:** auto-detect → auto-crop, owner can adjust; **product photos only**; lives in **PHASE 04 + DECISIONS.md**.
- **Hero video:** keep exactly as designed (it is AI-generated — PixVerse C2PA provenance — recorded in the audit).
- **WhatsApp = WAHA**, self-hosted (not a paid SaaS like Ayrshare). Full design: `specs/whatsapp-waha-spec.md`.
- **WAHA cannot run on Supabase** — Edge Functions are request-scoped (400 s wall clock, 256 MB, no Docker, no Chrome, no durable session store). Host = **VPS with Docker + HTTPS**, per the owner's "if it can't be Supabase, use a VPS". Supabase still owns the outbox table, the `pg_cron` trigger and the admin data.
- **The sending number is the shop's own WhatsApp number** (077 009 0147 / 075 613 0147). The owner explicitly accepts the ban risk; mitigations and the swap-out path are in the WAHA spec §7. Changing the paired number happens by scanning a QR **in the admin page** — it cannot be typed in, because the number is the identity of WAHA's session. The shop's public WhatsApp number and the admin alert number are plain editable settings.
- **Notification failure policy:** retry WhatsApp with backoff, then alert the admin in the dashboard. **No email fallback** (owner's choice). The order is never affected.
- **Product images:** normalise by default (auto-rotate, trim, 1:1 crop, sRGB, strip EXIF, deterministic derivatives); **cut-out is opt-in per product**, run in the browser, revertible. No AI-generated or AI-upscaled product imagery. Exact pipeline proposal: `specs/product-image-pipeline-spec.md`.
- **Migration:** edit `0001_init.sql` **in place** (never applied anywhere); role-aware RLS; admin writes become service-role-only after `requireAdmin()`; fix the `variant_availability` projection; fix `place_order` (idempotency race, DB-sourced shipping fee, named errors).
- **Git:** two commits, explicit Waseem paths only, never `git add -A`.
- **Phase files are append-only history:** owner decisions land as dated amendment blocks, never as rewrites of the received plan — so a contextless session can continue from any single phase file. This is now the standing practice, encoded in the `change-with-continuity` skill.
- **Untestable items are recorded at their owner file:** every phase with deferred proof carries an explicit "Cannot be tested… prove later" list naming the phase/environment that will prove it.

---

## Guardrails

1. Work **only** inside `Projects/Waseem-sports`. The surrounding workspace repo has unrelated modified/deleted files — never stage them.
2. **Never overwrite `HANDOFF.md`** (client brief). Session handoffs go in `SESSION-HANDOFF.md`.
3. **Never delete** designs, photos or assets. Moves only, per spec §6.3.
4. No app code before PHASE 01 is approved. No migration applied to a live project before PHASE 02.
5. Never invent APIs, prices, providers or business rules (`CLAUDE.md` rule 8) — mark `VERIFY` / `DECISION REQUIRED` and ask.
6. One phase at a time; after each phase, summarise (built / tested with results / not tested / risks) and **stop for approval**.

---

## Next steps

1. **Done — Phases 00–05 are committed and pushed** (`7f66b18` on `main`, origin `https://github.com/isahzn/waseem-sports.git`, 220 files, no secrets). Continue committing to that repo as the phases land (explicit paths, never `git add -A`).
2. **Create the first admin account** (DEPLOYMENT.md setup step 2), then click through `/admin` with a real session: order confirm → processing → shipped → delivered (stock reserve/commit), cancel (release), the manual stock panel, internal notes, shipping-rule CRUD, the D2 reserve-policy toggle, the dashboard. This is the only MVP proof still missing — it needs the owner's account, which no session can create for itself.
3. **Owner enters real delivery rules** in `/admin/shipping` before launch (D5 — deliberately nothing is seeded) and confirms the D2 policy. Until a rule exists the storefront shows the honest "online checkout isn't open yet" panel with the shop's WhatsApp number and phone instead of guessing a fee.
4. **PHASE 06 — notifications** (`phases/PHASE-06-notifications.md`): the outbox rows already exist for every order event (`order_placed` proven end-to-end; `skipped` while unconfigured, per D33). The phase adds the `Notifier` interface, the WAHA adapter, the cron route, DB templates and the admin notifications page.
5. **PHASE 07–11** in order (page builder, cards, image search, security, production QA). Do not start 7–9 before the MVP admin pass is done.
6. **Optional, immediately runnable, no app code:** the local WAHA spike in `specs/whatsapp-waha-spec.md` §8 (pull the image, generate credentials, run with a session volume, scan the QR, send one `curl` test). Do not pair the live shop number to a throwaway local container with no session backup.
7. **Awaiting owner input (non-blocking):** spec §11 answers (shop email V1, opening hours V2, D12 checkout fields, D11/D13), approval of `specs/whatsapp-waha-spec.md` + `specs/product-image-pipeline-spec.md`, and the new `docs/DECISIONS.md` entries D34 (server-side stock counts) + D35 (the settings seed is part of "set up").
