# AGENTS.md — Waseem Sports (agent rules)

Read `HANDOFF.md` first, then the doc for the phase you're on (`phases/`).
This is a real business's store. Not a toy.

## Non-negotiables
1. Code != data. Products, orders, pages, images live in Supabase. Never in Git, never in TS files.
2. Nothing business-specific is hardcoded: no sport, category, brand, attribute, shipping country, payment provider, or shop name in logic. Those are DB rows/settings.
3. Never trust the client for price, totals, stock, shipping fee, payment status. Recompute server-side from DB.
4. Stock changes ONLY via the SQL functions in `supabase/migrations` (`place_order`, `adjust_order_stock`). Never `read stock -> compare -> write` in TS.
5. Authorize on the server for every admin action (server actions / route handlers) AND keep RLS on. Hiding a button is not authorization.
6. Service-role key is server-only. `NEXT_PUBLIC_` only for genuinely public values.
7. Real auth is Supabase Auth + `admin_users` roles, and there is **no universal/master password** — with one recorded, deliberate exception: `/admin` currently opens with the single shared `ADMIN_PASSCODE` because the owner asked for it (D42, 2026-10-07). It is temporary by definition — the password is the whole admin surface, so before the site is public it must be a long random value or removed (`docs/SECURITY.md`, `docs/DEPLOYMENT.md` pre-launch checklist). Never add a second such shortcut; unset the variable to go back to the account login.
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
- After each task: run `npm run typecheck`, `npm run lint` and `npm run build`, and list what you verified and what you didn't. **There is no test runner installed** — "tests" here means the purpose-built headless-Chrome harnesses and the SQL/RPC suites (`supabase/tests/*.sql`, plus the gitignored `.tmp/`). Do not write "tests pass" for a runner that does not exist.
- Stop and ask the user at every `DECISION REQUIRED` or `VERIFY`.
- When the owner says a value must be customizable in the admin, record it in the owning phase file as a dated amendment the same session — never leave it as a chat-only promise.

## Definition of done (per feature)
Works; can't be abused; can't corrupt data; owner can understand it; stays fast;
degrades gracefully when externals fail; has tests incl. failure/abuse paths.
