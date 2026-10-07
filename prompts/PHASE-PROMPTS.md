# Copy-paste prompts (one per phase)
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
