# Case C: the radius system (ui-governance in the field)

**Pipeline**: component/style governance · **Output**: one MR (!2351) shipping ladder + gate + Figma export together
**Sources**: `materials/memory/radius-system-governance.md`, `materials/docs/workspace-figma-reskin/radius-tokens.md`, `materials/gates/check-radius-usage.mjs`

## Storyline

1. **Census**: scan the repo for `rounded-*` / `border-radius`; find the named scale remapped in this repo, px spellings all over, and the same visual rung written several ways.
2. **Spec**: a fixed px-value ladder `--sem-radius-*` (2..36/card/full), the named scale demoted to aliases; "adding a rung = 4 edits" written down (CSS variable + @theme alias + cn.ts ladder + figma:variables re-export).
3. **Convergence**: corner radius became component-owned (Button/Select/Input radii derive from size; caller `rounded-*` is stripped); concentric corners derive via `calc(var() - var())` formulas instead of magic numbers (the overlay-item mechanism).
4. **Gate**: `check:radius-usage` freezes it — bans `rounded-[Npx]`, rem/%, raw `border-radius:`; demo/website/ds/vendored directories exempt.
5. **Write-back**: a rules section in CLAUDE.md, and the full ladder exported to Figma as `Core/radius/*` variables so the design side draws from the same ladder.

## Why it's worth telling

- **The most complete "governance = convergence + freezing" sample**: all five moves (single source / migration / gate / dead-code removal / write-back) closed inside one MR.
- **"The allowlist is a frozen baseline, not a door"**: the gate's allowlist holds existing debt only and only ever shrinks. That design is what keeps the win from drifting back within a quarter.
- **One pass feeds both sides**: the same governance produced the code ladder and the Figma variables, so design and code reference identical values; figma-restore step 3's "map to the system" exists because of passes like this.
- The same playbook then repeated for shadows (three-tier recipe), color (two-axis model), motion (spring ladder), and input/select geometry: **the process is reusable, which is exactly why it became a skill**.

## Transfer notes

Count how many places one token registers in your project first and put the list in the spec. Write the replacement spelling directly into the gate's error message so humans and agents self-serve the fix.
