# Waseem Sports — Handoff Package

Architecture + build plan for the Waseem Sports e-commerce platform
(storefront + CMS + inventory + orders). Written to be handed to a coding
agent (Freebuff) that builds it phase by phase.

## How to use this (2 minutes)
1. Create a new empty repo / folder for the project.
2. Copy this whole package into it (keep the folder names).
3. The design already lives in `design/` — canonical file is `design/waseem-sports-video.html` (see `design/README.md`; superseded designs are archived under `design/unwanted-designs/`).
4. Open Freebuff in that folder and paste `prompts/00-FIRST-PROMPT.md`.
5. When a phase finishes and you've checked it, paste the next prompt from `prompts/PHASE-PROMPTS.md`.

## What's inside
| File | Purpose |
|---|---|
| `CLAUDE.md` / `AGENTS.md` | Rules the agent must follow every session (same content) |
| `HANDOFF.md` | Start here: context, what's decided, what's not, risks |
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
| `supabase/migrations/0001_init.sql` | Real starting schema, RLS, stock functions |
| `supabase/seed.sql` | Technical defaults only |
| `phases/PHASE-00..11.md` | One file per build phase with acceptance tests |
| `.env.example` | Env var names (no secrets) |

## The one rule everything depends on
Code deploy != data deploy. Products, orders, images and pages live in
Supabase (Postgres + Storage). GitHub only holds source code.

## Hosting split
App runs on **GoDaddy Node.js Hosting** (persistent Node 22 process);
**Supabase is the database/auth/storage, reached only over HTTPS** (GoDaddy
blocks direct Postgres ports and outbound SMTP). GoDaddy is not just DNS.
Details: `docs/ARCHITECTURE.md`, `docs/DEPLOYMENT.md`.
