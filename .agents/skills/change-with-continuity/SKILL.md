---
name: change-with-continuity
description: Make a change in a long-lived, multi-session project so a later session with no context can continue it. Use when editing plans, specs, code, or docs across sessions: amend the plan alongside the edit, record untestable items with their proof point, and leave a verifiable trail.
---

# Change with Continuity

## Overview

In a project built across many sessions — and cleared contexts — the change itself is only half the work. The other half is leaving the project in a state where the next agent, who has never seen this conversation, can pick up exactly where you left off without re-discovering everything.

Use this skill for any non-trivial change: a requirement, a plan file, source code, a migration, or docs. Skip it only for typo-level fixes (and even then, leave the working tree clean).

## The loop

```
1. Understand   → read the plan file, the spec, the handoff, the code. No edits yet.
2. Amend first  → write the requirement into the plan (dated amendment block), not just into code.
3. Edit         → smallest diff that does the job, in the project's conventions.
4. Verify       → typecheck/lint/tests where they exist; evidence, not vibes.
5. Record       → update the handoff, the spec changelog, and the untestable list.
```

Steps 2 and 5 are what make this skill different from just editing. Do not skip them.

## Rules

### 1. Plans are append-only history

Received plan files (phase plans, handoffs, briefs) are never rewritten in place and never deleted. Add dated amendment sections at the end, clearly marked with the date (e.g. `## Amendments — 2026-10-06`), that say what changed, why, and where the full design lives. The original text above stays byte-identical so the diff is reviewable as a pure addition.

- Never overwrite a document that has a different job (e.g. a client's brief is not a session log; on a case-insensitive filesystem `handoff.md` and `HANDOFF.md` may be the same file — check before writing).

### 2. Every change carries its pointers

An edit without a pointer is a trap for the next session. When you change behaviour, also update (at minimum): the spec or plan file that describes it, the resume/handoff note, and the changelog of the spec that owns it. Several places, one truth.

### 3. Record what cannot be tested — and where it must be proven

Some things cannot be proven in the phase where they are built (needs a live database, a paired device, a deployed host, real files). Write that down at the point of the change, not later:

- In the phase/plan file: a "Cannot be tested in this phase — prove later" list naming the exact phase, environment, or event that will prove it.
- Never let "cannot be tested now" become "never tested". Each deferred item names its proof.

Example: "The last-unit race must be proven with actual parallel sessions against a real database (PHASE 02) — single-threaded scripts are not proof."

### 4. Read before editing; smallest diff that works

Open the file, read the surrounding code, match existing conventions. Reuse what exists. One vertical slice at a time. Do not reformat, rename, or "clean up" unrelated code in the same change.

### 5. Never invent what the plan must supply

No invented APIs, prices, providers, credentials, or business rules. Unknowns go into the decisions log as `VERIFY` / `DECISION REQUIRED` and stop there — the next session asks the owner. A guessed value in code is a landmine; a marked unknown in the plan is a task.

### 6. Verify with evidence, then report honestly

Run typecheck/lint/tests after each slice. Report: what changed, what was verified (with results), what was NOT verified, and what cannot be verified yet (with where it will be). If a check failed or could not run, say so — never weaken an assertion, skip a test, or add a suppression to make verification pass.

### 7. Keep the blast radius explicit

Work inside the project's folder only. Stage/commit explicit paths — never blanket-add. Check `git status` scoped to the project before and after. Leave unrelated files untouched.

## Worked example (Waseem Sports)

Owner decisions (GoDaddy hosting, WAHA notifications, product-photo pipeline, canonical design) arrived after the plan files were written. Instead of rewriting the twelve phase files, each got an appended `## Amendments — 2026-10-06` block: what was decided, where the full spec lives (`specs/whatsapp-waha-spec.md`, `specs/product-image-pipeline-spec.md`), what supersedes what (e.g. GoDaddy hosting supersedes "Deploy to Vercel"), and what cannot be tested until a later phase. A session opening any phase file cold can continue from that block alone.

## Failure modes

1. Editing code without updating the plan — the next session re-discovers the requirement by accident.
2. Rewriting history in plan files — diffs become unreadable and decisions get lost.
3. Leaving deferred tests in chat instead of in the file that owns the work.
4. Claiming verification that hasn't happened ("works" without a test, a run, or a measurement).
5. Touching files outside the project's scope in the same change.
