# Copy-paste prompts (one per phase)

> **Record, not an instruction.** These are the prompts the owner pasted phase by phase. Phases 00–05 are built and verified, and PHASE 07's front end plus CMS builder are too, so most of them are already spent — `SESSION-HANDOFF.md` is where the project actually stands.
>
> Two corrections if one of these is ever reused:
> - the generic prompt below says "run typecheck/lint/tests"; this project has **no test runner installed**. Its gates are `npm run typecheck`, `npm run lint` and `npm run build`, plus the purpose-built headless-Chrome harnesses and the SQL/RPC suites kept in the gitignored `.tmp/`.
> - PHASE 07's section types come from the canonical design, not from the phase file's original list.

Use after the previous phase is checked and approved. Replace NN and the file name.

## Generic
```
Read CLAUDE.md, HANDOFF.md, and phases/PHASE-NN-<name>.md (plus any docs it references and docs/AUDIT.md).
Do PHASE NN only. Read existing code before changing it. Work in small vertical slices and run typecheck/lint/tests after each.
Follow every acceptance criterion; write tests including failure and abuse cases. Do not invent APIs or business rules - mark DECISION REQUIRED / VERIFY and ask me.
When finished: list what you built, what you tested (with results), what you did NOT test, and any risks. Then wait for approval.
```

## Phase notes to append
- **01:** "Ask me before choosing the rate-limit store (D8)."
- **02:** "Apply 0001_init.sql to a local Supabase first and fix problems in a new migration. Prove the concurrent-stock test."
- **03:** "Build one entity at a time in the listed order and stop after products so I can try it."
- **04:** "Use the HTML in design/ as the visual reference; keep its look."
- **05:** "Ask me about D1, D2, D5, D12 before finalizing checkout."
- **06/08/09:** "Do not start unless I have told you the provider and you have verified its current official docs. Otherwise stop and tell me what to research (I'll use Perplexity)."
- **10:** "Be adversarial. Try to break it; report honestly."
