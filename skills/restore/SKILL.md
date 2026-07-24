---
name: restore
description: c2d2c d2c pipeline — the standard eight-step workflow for implementing or updating UI from Figma designs. Use EVERY time the user provides figma.com/design/... links asking to build, update, restyle, or restore a UI to match a design. Covers survey → plan review → spec extraction → 1:1 build → regression page → motion review → screenshot acceptance → cleanup + MR. Not for exporting code INTO Figma (that is c2d2c:export).
---

# c2d2c:restore — design to code, 1:1

## Project parameters

Resolve parameters from `C2D2C.md` at the repo root (fallback: `.claude/c2d2c.md`). If neither exists, offer to bootstrap one from the template at `../../templates/C2D2C.template.md` (relative to this SKILL.md — it sits at the plugin root): fill what the repo itself reveals (token files, gate scripts, regression routes, git host), ask for the rest. This skill uses `DESIGN_FILE`, `TOKEN_DOCS`, `DS_ROUTE`, `GATES`, `MR_TOOL`, `DEPLOY_ORDER`.

Core principles: **agree on the plan before building, implement 1:1, every component gets a regression surface, finish with no loose ends.**
Three points where you MUST stop and wait for user confirmation: step 2 (plan), step 3 (off-system styles), step 7 (acceptance).

## 1. Skim + survey the current state + reuse audit

- Skim the design with Figma MCP (`get_design_context` + screenshots): structure first, no parameter-digging yet. `get_metadata` tends to time out on large frames; prefer design context.
- In parallel, map the existing implementation: related components, data flow, animation approach (an Explore agent works well).
- **Proactively enumerate reuse** (don't wait to be asked): for **every** UI element in the design, look for an existing implementation and produce a reuse matrix (element → component → coupling → reuse strategy):
  - What the design shows is usually the design frame of a real component. Assume it already exists, then try to disprove it, not the other way around.
  - Coupling tiers: pure presentation (use directly) / light context (does it degrade gracefully without providers?) / heavy data coupling (data layer, runtime, store).
  - A `DS_ROUTE` page or demo page rendering the component with mock props is direct evidence the presentation surface is already isolated.
  - **Heavy coupling ≠ no reuse**: the default move is to extract the pure presentation core so the live caller, the regression page, and the new surface share it. A visual replica is the last resort, unless the user explicitly wants isolation.
- Produce a **diff list**: structural differences between design and current state, the heavy-rework areas, and anything worth extracting as shared.

## 2. Plan review (STOP)

Present the plan for review: scope, component split/abstraction, animation handling, risks. Lead with a recommendation, not a menu. **Wait for confirmation before step 3.**

## 3. Extract detailed specs, block by block (conditional STOP)

Read each section with `get_design_context` + `get_variable_defs`, **down to every gap, font size, and color token**:

- Map whatever fits the project's token/component system directly (consult `TOKEN_DOCS`).
- **Report every off-system style to the user, one by one** (absorb as a new token? one-off hardcode? change the design?). If everything maps into the system, say so and continue without stopping.
- Figma variable names ≠ code token names. Verify against the project's token files; never guess.

## 4. Full 1:1 implementation

- Build to the confirmed plan. The target is pixel-level fidelity, not "roughly similar".
- Respect the project gates; UI changes usually touch i18n keys, so handle them in the same pass.
- Run a dev server and compare against screenshots as you go (multi-worktree port contention: read the actual port from your own server log; headless screenshots may render CSS fallbacks instead of WebGL/shaders, verify headed when needed).

## 5. Regression page (mandatory for component work)

When the change involves a **reusable component** (new, or visual/state changes to an existing one), create or update its `DS_ROUTE/<component>` page:

- State enumeration follows the same standard as c2d2c:export: every variant axis (read from `tv()`/type unions, don't guess), every data shape (value/empty/fallback/truncation/loading/error), every interaction state (rest/hover/focus/selected/disabled + hover popovers).
- The page renders from mock props, no live data. It is both the proof that the presentation surface is isolated and the state checklist for a future c2d2c:export run.
- For heavily coupled components, extract the pure presentation core first (see step 1) so the live caller and the regression page share it: this kills hand-copied replicas that drift.
- Pure page-level changes (no reusable component) may skip this step; say why.

## 6. Motion and state review

Walk every animation, transition, and hover/active/loading/empty state in the module:

- Motion tokens compliant? (Projects usually have a motion ladder; inline springs/beziers are banned.)
- Entrances/exits, scroll-linked behavior, reduced-motion fallbacks complete?
- Fix what you find; report the motion inventory and verdict.

## 7. Screenshot acceptance (STOP)

- What to capture: the regression page, full plus close-ups of key states; if there's no regression page, capture the real route. Use `../../scripts/ds-shot.mjs` (plugin root; `node ds-shot.mjs <route> [--port N] [--dark]`) or manual browser capture.
- Present them **side by side** with the Figma `get_screenshot` output; call out known deviations and why.
- **Wait for the user to pass acceptance before step 8.** Requested changes loop back to step 4.

## 8. Cleanup + MR

Cleanup (**no loose ends, no patches on top**):

- Delete every replaced implementation completely: component files, barrel exports, types, i18n source keys, unreferenced styles/tokens, portal mount points, dead constants. Leftover dead code misleads the next investigation.
- Run `GATES` to confirm nothing dangles.

MR (runs automatically once acceptance passed and gates are green; do not stop to ask again):

1. Rebase onto the latest default branch.
2. Open the MR with `MR_TOOL`. Description template: Figma node link / acceptance screenshots / change summary / deletion list / gate results / `DEPLOY_ORDER` dependencies (e.g. "backend first").
3. Merge per project convention (e.g. GitLab: `glab mr merge --auto-merge --yes` with server-side rebase; queue auto-merge immediately on fast-moving mains).

## Reporting rhythm

- Steps 1-2 merge into one plan-review message (diff list + recommended plan).
- Step 3 stops only for off-system styles; otherwise one line.
- Step 7 is one acceptance message (side-by-side screenshots + deviation notes).
- After step 8, close out: MR link, deletion list, gate results.
