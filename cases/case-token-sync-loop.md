# Case D: Token Sync, the two-way circuit (script + plugin)

**Pipeline**: token sync · **Output**: export script + CI gate + the "Token Sync" Figma plugin
**Sources**: `materials/plugin/` (full plugin source), `materials/token-sync/` (script + snapshots), `materials/memory/figma-variables-sync.md`

## The mechanism

**Code is the source of truth**; Figma is a consumer. Three parts interlock:

1. **The export script** (`export-figma-variables.mjs`): builds Variable Pro JSON from `globals.css` — three collections (Core = semantic roles / Ramps = color scales / Product = product layer), Light/Dark modes, cross-collection aliases (change a scale once, both sides follow), scopes, and `$codeSyntax.WEB` (the CSS var ↔ Figma variable mapping that export and restore both rely on).
2. **The CI gate** (`check:figma-variables` = the script's `--check`): red whenever snapshot ≠ CSS. Change a token and forget to re-export, CI catches it.
3. **The plugin** (Token Sync, a local development plugin):
   - **Pull**: fetch the snapshots from the repo's main and write variables/styles into Figma (create/update/orphan cleanup).
   - **Preview**: a superset of Pull — renders Foundations posters on canvas (color grids / type rows / shadow cards / radius cards), everything **bound to live variables**, grouped automatically from the real token tree so posters never go stale.
   - **Push**: diffs designer edits against the snapshot and opens an MR — one commit updating the snapshots plus **safe values written directly back into `globals.css`** (only tokens whose CSS is already a literal; oklch/color-mix/var() compositions are flagged for a human, never overwritten). Safe-subset write-backs turn the gate green on arrival; the rest is itemized in the MR description.

## Why it's worth telling

- **Designers get controlled write access**: pushes go through MR + gate, so design-side edits enter engineering review instead of "changed in Figma, code never knew".
- **A red gate is a designed state**: red `check:figma-variables` on an MR means "snapshot ≠ CSS: apply this or reject it". The CI status itself is the collaboration signal.
- **This is the foundation under the other pipelines**: figma-export's "bind everything to tokens" and figma-restore's "map to the system" both bind to and map into these variables.
- **The evolution path**: v1 (inside the monorepo, plain JS, snapshot-only pushes) → v2 (standalone TypeScript project, + preview posters + style pushes + safe CSS write-back). The "safe subset" boundary (only literals get written back) is the trade-off that made two-way sync trustworthy.

## Transfer notes

Point the manifest's allowedDomains at your Git host; GitHub needs the GitLab API calls in ui.html swapped for the contents/pulls APIs; adjust the collection mapping to your token layering. Dual mode needs Figma Professional.
