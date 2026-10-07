# Waseem Sports — Handoff Package

Architecture + build plan for the Waseem Sports e-commerce platform
(storefront + CMS + inventory + orders). Written to be handed to a coding
agent (Freebuff) that builds it phase by phase.

## How to use this (2 minutes)

> **Status 2026-10-07 — the onboarding below has already happened; this file is the package description, not a to-do list.** The package was copied into its own repo (`https://github.com/isahzn/waseem-sports`, branch `main`), `prompts/00-FIRST-PROMPT.md` was executed on 2026-10-06, and the build has since run through **Phases 00–05 plus PHASE 07's front end and landing-page CMS builder**. The live state, the open items and the next phase are in **[`SESSION-HANDOFF.md`](SESSION-HANDOFF.md)** — read that and the status section of [`HANDOFF.md`](HANDOFF.md) first, not this file.

The original onboarding, for the record: drop this package in an empty repo, paste `prompts/00-FIRST-PROMPT.md`, then paste the next prompt from `prompts/PHASE-PROMPTS.md` after each phase is checked and approved. That loop is still how work proceeds; the next phase is **PHASE 06 (notifications)**.

## What's inside
| File | Purpose |
|---|---|
| `SESSION-HANDOFF.md` | **Start here:** where the project actually stands, the last sessions, failed attempts, next steps |
| `CLAUDE.md` / `AGENTS.md` | Rules the agent must follow every session (same content) |
| `HANDOFF.md` | The client's original brief: context, what's decided, what's not, risks |
| `docs/ARCHITECTURE.md` | System design, data flow, payment/notification abstractions |
| `docs/DATABASE.md` | Schema explained + inventory/order design |
| `docs/SECURITY.md` | Threat model + checklist |
| `docs/DECISIONS.md` | Unresolved business decisions (DECISION REQUIRED) |
| `docs/FOLDER_STRUCTURE.md` | Repo layout |
| `docs/DEPLOYMENT.md` | GoDaddy Node.js Hosting + Supabase setup, backups, recovery |
| `docs/DESIGN.md` | Brand + how to convert the HTML into components |
| `docs/AUDIT.md` | Phase 00 audit: design inventory, measured contrast, conflicts (file + line) |
| `docs/DESIGN-TOKENS.md` | Extracted tokens: Tailwind v4 `@theme` block + raw table |
| `specs/` | Pre-implementation specs (plan of record for each non-trivial task) |
| `docs/RLS-MATRIX.md` | Measured RLS/stock results from the live dev project |
| `src/` | The Next.js app: storefront, `/admin` area, CMS builder, API routes |
| `scripts/seed-demo.mjs` | Idempotent demo seed (11 products, pages, landing sections) |
| `supabase/migrations/0001..0003_*.sql` | Applied schema: RLS, stock/order functions, rate limits, `publish_page` |
| `supabase/seed.sql` | Technical defaults + business settings — part of "set up", not optional (D35) |
| `supabase/tests/01_rls_matrix.sql` | SQL suite: the RLS matrix and the last-unit race |
| `phases/PHASE-00..11.md` | One file per build phase with acceptance tests (00–05 built, 06 next; 07's front end built) |
| `.env.example` | Env var names (no secrets) |

## The one rule everything depends on
Code deploy != data deploy. Products, orders, images and pages live in
Supabase (Postgres + Storage). GitHub only holds source code.

## Hosting split
App runs on **GoDaddy Node.js Hosting** (persistent Node 22 process);
**Supabase is the database/auth/storage, reached only over HTTPS** (GoDaddy
blocks direct Postgres ports and outbound SMTP). GoDaddy is not just DNS.
Details: `docs/ARCHITECTURE.md`, `docs/DEPLOYMENT.md`.
