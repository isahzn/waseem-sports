# CLAUDE.md — Waseem Sports (agent rules)

Read `HANDOFF.md` first, then the doc for the phase you're on (`phases/`).
This is a real business's store. Not a toy.

## Non-negotiables
1. Code != data. Products, orders, pages, images live in Supabase. Never in Git, never in TS files.
2. Nothing business-specific is hardcoded: no sport, category, brand, attribute, shipping country, payment provider, or shop name in logic. Those are DB rows/settings.
3. Never trust the client for price, totals, stock, shipping fee, payment status. Recompute server-side from DB.
4. Stock changes ONLY via the SQL functions in `supabase/migrations` (`place_order`, `adjust_order_stock`). Never `read stock -> compare -> write` in TS.
5. Authorize on the server for every admin action (server actions / route handlers) AND keep RLS on. Hiding a button is not authorization.
6. Service-role key is server-only. `NEXT_PUBLIC_` only for genuinely public values.
7. No universal/master password. Real auth via Supabase Auth + `admin_users` roles.
8. Don't invent APIs, pricing, provider behavior. If it needs current docs, write `VERIFY: <what>` and stop to ask the user to research it.
9. Unknown business rule => it's in `docs/DECISIONS.md`. Build a config point, don't pick silently.
10. No n8n. No full POS. No multi-tenant. No custom payment gateway. No LLM required for core flows.

## Subagents
The owner has approved subagent use in this project. You may spawn subagents for parallel or scoped work (e.g. one slice per agent) without asking first. Keep them inside `Projects/Waseem-sports`, give each a narrow brief, and verify their output yourself before reporting done.

## Working style
- Read existing code before changing it. Preserve working things. Small diffs.
- One vertical slice at a time: UI + validation + auth + DB + storage + errors + storefront render.
- Strict TypeScript, no `any` without a comment saying why. Validate every server boundary with zod.
- Server Components by default; `"use client"` only where needed.
- Add a dependency only with a reason written in the PR/commit message.
- DB changes = new migration file, never edit applied migrations, never hand-edit prod.
- Log server-side details; show users generic errors. Never log secrets, passwords, card data.
- External services (WhatsApp/SMS/email/payment/image search) can fail: the order must still exist and stay consistent.
- After each task: run typecheck, lint, tests; list what you verified and what you didn't.
- Stop and ask the user at every `DECISION REQUIRED` or `VERIFY`.
- When the owner says a value must be customizable in the admin, record it in the owning phase file as a dated amendment the same session — never leave it as a chat-only promise.

## Definition of done (per feature)
Works; can't be abused; can't corrupt data; owner can understand it; stays fast;
degrades gracefully when externals fail; has tests incl. failure/abuse paths.
