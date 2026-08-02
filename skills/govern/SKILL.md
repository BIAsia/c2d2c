---
name: govern
description: c2d2c governance pipeline — the standard workflow for converging and freezing a component/style system. Use when the user wants to unify, converge, standardize, or govern a visual dimension (radius, shadows, color, spacing, motion, a component API), asks to add a lint/CI gate for a style rule, wants hardcoded values migrated onto tokens, or complains the same style is hand-written differently across the codebase. Covers census → spec → convergence → full migration → gate → dead-code removal → write-back.
---

# c2d2c:govern — converge + freeze

## Project parameters

Resolve parameters from `C2D2C.md` at the repo root (fallback: `.claude/c2d2c.md`); if absent, offer to bootstrap one from the template at `../../templates/C2D2C.template.md` (plugin root; standalone installs without that file fetch https://raw.githubusercontent.com/BIAsia/c2d2c/main/templates/C2D2C.template.md). This skill uses `TOKEN_HOME`, `SPEC_HOME`, `GATE_HOME`, `LAW_HOME`, `DS_ROUTE`, `TOKEN_EXPORT`, `GATES`.

Core mental model: **governance = convergence + freezing**. Convergence without freezing drifts back within months; freezing without cleanup leaves two systems that mislead everyone who comes later. One governance pass must complete all five moves: single source, full migration, gate, dead-code removal, written rule.

## 0. Decide to govern

Trigger signals: the third hand-written variant of the same style; reviews correcting the same class of mistake repeatedly; a restore job discovering "this value exists five ways in the codebase".
Scope first: which dimension (radius/shadow/color/spacing/a component API), which directories, which areas are exempt (demos/marketing pages/vendored code, usually).

## 1. Full-repo census

- `rg` every current spelling of the dimension into a list: each form × occurrence count × representative file.
- Derive the "rungs actually in use" from the list. The ladder grows out of usage, not out of thin air.
- Separate the exceptions: legitimate special cases (future exemption areas) vs. drift (to migrate).

## 2. Write the spec (STOP: user review)

Write the system doc in `SPEC_HOME`, covering:

- **The ladder/recipe**: fixed token table (e.g. a px-value radius ladder, a three-tier shadow recipe) and when each rung applies.
- **Single source**: where values live (tokens) and where logic lives (single-source modules like `field-shell.ts`, `tone.ts`).
- **The ban list**: which spellings become illegal (raw literals, raw palette classes, inline beziers…).
- **Exemptions**: directory-level exemptions plus allowlist semantics (**the allowlist is a frozen baseline, not a door**: existing debt may sit in it; new code may not enter).

Get the user's sign-off before touching code.

## 3. Converge the implementation

- Tokens go into `TOKEN_HOME` (one value often registers in several places: CSS variable + theme alias + class ladder + design-side export; put the "adding a rung = N edits" list in the spec).
- Absorb component APIs: geometry/color become **component-owned** (driven by size/variant; matching classes stripped from caller `className`), ending caller overrides.
- For heavy coupling use **restyle-in-place**: when the behavior layer can't move (blocked by a lynchpin component), swap only the visual shell, leave behavior in place, and record the blocker.

## 4. Migrate every caller

- Migrate all call sites in one pass; **no dual-track period**. If volume forces batching, each batch must be internally complete (that batch's components, callers, and tests move together).
- Anything the new API can't express flows back into step 2 as a spec fix, never as a caller-side loophole.

## 5. Freeze with a gate

- Write `check:<system>` into `GATE_HOME`: scan for banned spellings, skip exempt areas, match the allowlist exactly (file + pattern), fail everything else with a fix hint in the error message ("use X instead").
- Wire it into the CI aggregate so local `GATES` runs it too.
- The allowlist holds existing debt only: baseline what can't migrate today, then only ever shrink it.

## 6. Remove the dead code

- Delete old tokens, old classes, old components, barrel exports, types, i18n keys, unreferenced styles. **Delete completely; keep nothing "just in case".**
- Run `GATES` to confirm nothing dangles.

## 7. Write it back

- Add/update a rule in `LAW_HOME`: one-sentence rule + pointer to the spec + gate name, so future agents get it right without reading the spec.
- Create/update the `DS_ROUTE` preview page for the new ladder (token visualization + component state matrix).
- Run `TOKEN_EXPORT` to sync the token changes to the design side (the token flow described in c2d2c:c2d).

## Reporting rhythm

- Steps 1-2 merge into one message: census findings + spec draft (STOP).
- After steps 3-7, close out: migration volume, gate list, deletion list, rules diff, MR link.
