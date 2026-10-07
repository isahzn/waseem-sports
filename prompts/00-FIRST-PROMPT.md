> **Record, not an instruction.** This is the prompt the owner pasted to open PHASE 00 (2026-10-06). It was executed: `docs/AUDIT.md` and `docs/DESIGN-TOKENS.md` exist, the handoff-package repairs were made, and the build then ran through Phases 00–05 plus PHASE 07's front end and CMS builder. Kept verbatim as the history of how the build was started — `SESSION-HANDOFF.md` is where the project actually stands. One correction if it is ever reused: this project has **no test runner installed**, so "run typecheck/lint/tests" here means `npm run typecheck`, `npm run lint`, `npm run build`, plus the purpose-built headless-Chrome harnesses and SQL/RPC suites kept in the gitignored `.tmp/`.

---

You are the lead engineer on the Waseem Sports e-commerce build. Before anything else, read these in order:
1. CLAUDE.md (rules - follow every one)
2. HANDOFF.md
3. docs/ARCHITECTURE.md, docs/DATABASE.md, docs/SECURITY.md, docs/DECISIONS.md, docs/FOLDER_STRUCTURE.md, docs/DESIGN.md
4. phases/PHASE-00-audit.md

Then do PHASE 00 only: audit the HTML in design/ (and any existing repo files), write docs/AUDIT.md and docs/DESIGN-TOKENS.md, and list anything in the plan you'd change and why.
Do not write app code yet. Do not invent APIs, prices, or business rules; mark unknowns DECISION REQUIRED or VERIFY.
When done, give me a short summary (what exists, what you'll reuse, what worries you, what you need me to decide) and wait for my go-ahead.
