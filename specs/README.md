# specs/ — specifications written before implementation

One file per task, written and approved **before** code is touched — the plan of record for
the work it describes. A spec states the
request, the context, the findings, the decisions taken, the exact deliverables with
acceptance criteria, how each will be verified, what is explicitly out of scope, and the
VERIFY / DECISION REQUIRED items still open.

Specs are plans, never code. They are the record of *why* something was built a certain
way, so a later reader does not have to reconstruct it from the diff.

## Status key

- **draft** — written, awaiting owner approval. Nothing may be executed.
- **approved** — owner approved; execution may start. Only the listed deliverables.
- **executed** — deliverables produced and verified. The spec holds the plan; the results live in the owning phase file, `SESSION-HANDOFF.md` or a `docs/` record, and the spec says where.
- **superseded** — replaced by a newer spec; kept for history.

## Specs

| File | Status | Scope | Gate |
|---|---|---|---|
| `phase-00-fix-spec.md` | **executed** — §9 steps 1–13 done 2026-10-06 | Close PHASE 00: audit docs, design reorganisation, handoff-package repairs, `DATABASE.md` corrections, migration hardening, crop-feature record | Done; results recorded in `SESSION-HANDOFF.md` and `phases/PHASE-00-audit.md` rather than in the spec itself. §11 items (shop email, opening hours, shipping rules) were non-blocking and are still open |
| `whatsapp-waha-spec.md` | **draft** — awaiting approval | WhatsApp order/status notifications via self-hosted WAHA: hosting verdict, modular `Notifier` design, admin-editable numbers, failure policy, ban risk, local test setup | PHASE 06 (local spike can start now). Open items in its §10 |
| `product-image-pipeline-spec.md` | **draft** — awaiting approval | Concrete product-photo pipeline: exact output sizes/formats, crop + baked-in-text detection, opt-in cut-out, size budgets | PHASE 04. Written because the owner asked for specifics before it is built |

## Conventions

- Specs live here; the deliverables they describe live wherever the phase file says
  (`docs/`, `supabase/`, `design/`, `src/`).
- Never edit a spec silently after approval — record the change in its changelog, or
  mark the spec superseded and write a new one.
- Every new phase or non-trivial task gets its own spec file named `<short-name>-spec.md`.
