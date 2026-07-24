---
name: export
description: c2d2c c2d pipeline — the rules and process for exporting anything from code INTO Figma (code-to-design), UI components, state matrices, and design tokens/variables alike, and for keeping the token snapshot and its CI gate honest when tokens change. Use whenever the user wants code state reflected in Figma — "export/write/sync this component (or these tokens) to Figma", "update the Figma variables", "I changed a token, regenerate the snapshot", "the figma-variables gate is red". Not for implementing code from Figma designs (that is c2d2c:restore).
---

# c2d2c:export — code to design, every state

## Pre-flight: verify the token bridge

Before drawing anything, check that the target file actually has the project's synced tokens — rule 2 below binds against them, and binding into a file where they're missing or stale silently produces raw values or wrong colors.

1. Probe the file (`get_variable_defs` or a small `use_figma` query) for the `VAR_COLLECTIONS` collections; spot-check a few variables' values and `$codeSyntax.WEB` entries against `VAR_SNAPSHOT`.
2. Missing → sync them in first: the companion plugin's Pull if the project adopted it, otherwise create the collections via `use_figma` following the snapshot's layout (see the Tokens section).
3. Present but diverged from the snapshot → refresh them the same way before binding, and mention the drift to the user (it usually means someone skipped the snapshot discipline).

Only then start the export; from here on, binding is automatic — every value the code expresses as a token lands bound to its variable, per rule 2.

## Project parameters

Resolve parameters from `C2D2C.md` at the repo root (fallback: `.claude/c2d2c.md`); if absent, offer to bootstrap one from the template at `../../templates/C2D2C.template.md` (relative to this SKILL.md — it sits at the plugin root). This skill uses `EXPORT_FILE` (if the user gives a link, the link wins), `VAR_COLLECTIONS`, `VAR_SNAPSHOT`, `ICON_SOURCE`, `DS_ROUTE`, and for token work `TOKEN_HOME`, `TOKEN_EXPORT`.

## Three hard rules

### 1. Enumerate every state first (code census before drawing)

Before drawing anything, enumerate from source **every piece of information, content, field, and state** the element can show, and put each one on the canvas:

- Every variant axis: tone/size/kind/interactive etc., read from `tv()`/cx branches and type unions, never guessed from screenshots.
- Every data shape: value/empty/fallback (e.g. favicon fails → initial letter → globe icon), truncation/long text, loading, error.
- Every interaction state: rest/hover/focus/selected/disabled, plus hover popovers (tooltips/hover cards).
- The `DS_ROUTE` regression pages are a ready-made state checklist; read them first, then patch gaps from render source.
- Put a small gray annotation next to each state (state name + key class/token) for the designers.

### 2. Bind everything to tokens; no raw styles left behind

- Bind every color, radius, and text style to the already-synced variables and styles in `VAR_COLLECTIONS`; the inventory of record is `VAR_SNAPSHOT`.
- CSS var name → Figma variable name resolves through `$codeSyntax.WEB` (e.g. `var(--primary)` → `Product primary/default`).
- Spread paints with alpha become paint opacity or layer opacity bound to the same variable; never fork a new raw color.
- Values Figma cannot express (color-mix/oklch): bind the closest existing variable; if none exists, use the computed literal and record the derivation in the layer name/annotation. Never leave a silent raw color.
- If Figma already has the component/style (from earlier exports, Core/radius/* etc.), bind or instance it; don't redraw.
- Brand assets (third-party logos, favicon bitmaps) are exempt; placeholders are fine.

### 3. Ask before componentizing

Ask once before exporting: create Figma components (component/variant set) or flat frames? Follow the answer; don't decide unilaterally.

## Known gotchas (use_figma, earned over 4+ export jobs)

- Read the /figma-use skill before calling `use_figma`.
- The code must explicitly `return` a result or you get nothing back.
- resize flips auto-layout to FIXED along the primary axis and collapses it: resize first, then set sizing back to AUTO (do one recursive fix-up pass at the end).
- Wrap grids need a fixed-width container.
- `get_metadata` times out on large frames; prefer `get_design_context` or query in small chunks.
- Switching pages requires `await figma.setCurrentPageAsync(page)`.
- Inter's weight name is "Semi Bold" (with the space).
- Local fonts are invisible to the MCP session: leave a FONT TODO annotation on title layers.
- Split long jobs into multiple small idempotent calls (find-or-create, then mutate) so failures can re-run.
- **Never rely on `figma.currentPage`**: the user switching pages mid-run sends later calls to the wrong page. Re-resolve with `getNodeByIdAsync(targetPageId)` + `setCurrentPageAsync` on every call, and check for strays at the end.
- `setBoundVariableForPaint` discards any preset paint opacity, and variables that carry their own alpha get that alpha converted into paint opacity on bind. Correct order: bind first, then set opacity on the returned paint; for alpha-carrying variables the final opacity = variable alpha × CSS multiplier (e.g. `/80` → 0.05×0.8=0.04), don't overwrite with 0.8.
- Instance root fills snapshot the master's values at creation time: changing master fills later may not flow into existing instances. Fix: copy master.fills back onto the instance, or delete and recreate it.

## Tokens: the same pipeline, different payload

Design tokens are exported state too; the difference is they carry a generated snapshot and a CI gate that keeps the two sides honest.

- **Code is the source of truth.** When tokens change in `TOKEN_HOME` (mind every registration point: CSS variable + theme alias + class ladder), run `TOKEN_EXPORT` to regenerate `VAR_SNAPSHOT`, and commit the CSS change and the snapshot **together**. A red `check:figma-variables` gate means exactly "one side moved without the other" — that is the gate doing its job, not an error to silence. Never hand-edit the snapshot; it is generated output.
- **Getting variables into Figma**: if the project adopted the companion Token Sync plugin (`../../figma-plugin/`), designers Pull and everything — including bound foundation posters — updates in place. Without the plugin, create/update the variable collections yourself via `use_figma`, following the same collection/mode/`$codeSyntax.WEB` layout that `VAR_SNAPSHOT` records.
- **Renames start from the code side**: a Figma-side rename arrives as delete + add and orphans every binding.
- **Designer-side edits**: with the plugin adopted, designer pushes arrive as `figma-sync/*` MRs, red by design, with safe literal values already written back into the CSS and everything ambiguous itemized for a human. The engineer-side review flow lives in `../../ADAPTING.md` (Token sync section).

## After exporting

- Self-check with `get_screenshot`: alignment, lost variable bindings (scan for raw colors), clipped text.
- Reply with the Figma node link.
