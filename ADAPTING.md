# Adoption checklist: running c2d2c on your project

Every project-specific assumption resolves through one file: **`C2D2C.md` at your repo root** (copy `templates/C2D2C.template.md` and fill it in; any c2d2c skill offers to bootstrap it on first run). This checklist covers what must exist first and how to map each parameter.

## 1. Prerequisites (missing one degrades the matching pipeline)

| Prerequisite | Without it |
| --- | --- |
| Claude Code on Fable 5 | every pipeline degrades: earlier models drop steps mid-run and need re-prompting; the loop stops feeling smooth |
| Figma Dev Mode MCP connector (read access) | c2d2c:d2c steps 1/3 can't extract specs; degrades to eyeballing screenshots |
| Figma MCP write access (use_figma) | c2d2c:c2d is unavailable entirely |
| A token system in the codebase (CSS variables as single source) | token sync has no subject; c2d2c:govern must first build the target |
| A component regression surface (/ds or equivalent) | state enumeration has nowhere to land; acceptance degrades to screenshotting business pages |
| CI that accepts custom script gates | c2d2c:govern converges but never freezes, so it drifts back |
| GitLab/GitHub CLI (glab/gh) | the MR steps degrade to manual MR creation |

## 2. Parameter by parameter

### For c2d2c:d2c
- `DESIGN_FILE`: your product design file's fileKey.
- `TOKEN_DOCS`: where your token/component system is documented; if nowhere, run one c2d2c:govern pass first.
- `DS_ROUTE`: your regression-page route. Page routes like `/ds/<name>` work; Storybook/Ladle are equivalent. What matters: renderable with mock props + a stable URL to screenshot.
- `GATES`: your aggregate of typecheck + lint + custom check:* scripts.
- `MR_TOOL` and merge convention: e.g. GitLab FF-only with server-side rebase + `glab mr merge --auto-merge --yes`; on GitHub, `gh pr create` + `gh pr merge --auto`.

### For c2d2c:c2d
- `EXPORT_FILE`: the export target. Keep it separate from the product design file (a dedicated component-archive file works well).
- `VAR_COLLECTIONS` / `VAR_SNAPSHOT`: bootstrap token sync first (next section) or there is nothing to bind; without a variable system, exports fall back to literals. Still usable, but you lose "change a token, the whole file follows".
- `ICON_SOURCE`: how your icon library's SVGs are obtained.

### Token sync (export script + optional figma-plugin/; the skill-side rules live in c2d2c:c2d)
- **The export script** (the reference implementation ships with the source project as `export-figma-variables.mjs`) needs adapting to your token structure: it assumes CSS variables in `globals.css` (`:root`/`@theme` = Light, `.dark` = Dark) split by prefix into three collections. Different layering = rewrite the collection mapping; the core machinery (Variable Pro JSON, `$codeSyntax.WEB`, cross-collection aliases, `--check` diff gate, `--apply` write-back) carries over as-is.
- **The plugin** (`figma-plugin/`, Token Sync):
  - Change `networkAccess.allowedDomains` in `manifest.json` to your Git host (Figma requires a static declaration).
  - The GitLab API calls in `ui.html` (raw file fetch / branch+commit / MR creation) need swapping to GitHub REST (contents API + pulls API) for GitHub.
  - In `code.ts`, adjust collection names, style prefixes, and font priorities to your project.
  - Light/Dark dual mode requires Figma Professional or above.
- **The gate**: `check:figma-variables` = the export script's `--check`; red when snapshot ≠ CSS. This enforces "code is the source of truth" and must run in CI.
- **Operating with the plugin (engineer side)**: a designer push arrives as a `figma-sync/*` MR, red by design — safe literal values are already written back into the CSS, everything ambiguous (oklch/color-mix/var() compositions, missing dark declarations, unit mismatches) is itemized as manual work in the MR description. Translate or reject each manual item with the user, rerun the export command until the gate turns green, then merge. Reject Figma-side renames (they arrive as delete + add) and redo them from code.

### For c2d2c:govern
- `TOKEN_HOME`: count how many places one token registers in your project (commonly: CSS variable + theme alias + class ladder + design-side export) and put that list in the spec.
- `GATE_HOME`: gate scripts share one structure: banned-pattern regex scan + directory exemptions + exact allowlist + fix-hint messages. (The source project ships nine production examples.)
- `LAW_HOME`: your agent-rules file (CLAUDE.md / AGENTS.md / cursor rules). **Do not skip the write-back step**: the rules section is the mechanism that stops future AI from reoffending.

## 3. Source-project conventions that are optional elsewhere

- Multiple parallel worktree sessions (and the port/path discipline they force). Single-checkout solo work can ignore those gotchas.
- Team conventions like "the MR flow includes merging". Adjust skill wording to your team.
- The backend-deploys-first convention (GraphQL field dependencies). Frontend-only projects can drop `DEPLOY_ORDER`.
