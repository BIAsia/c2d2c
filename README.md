# c2d2c

**Code-to-design-to-code.** Four pipelines closing the loop between Figma and a production codebase, packaged as a Claude Code plugin (a skill series) plus a Figma plugin.

| Skill | Pipeline | One line |
| --- | --- | --- |
| `c2d2c:restore` | Figma → code | Eight steps from design link to merged MR: survey/reuse audit, plan review (stop), spec extraction (conditional stop), 1:1 build, regression page, motion review, screenshot acceptance (stop), cleanup + auto-MR |
| `c2d2c:export` | code → Figma | Everything that moves code state into Figma — components AND tokens. Three hard rules (enumerate every state from source, bind everything to tokens, ask before componentizing), 12 field-tested use_figma gotchas, plus the token-snapshot/gate discipline |
| `c2d2c:govern` | code → code | Converge + freeze a style system: census, spec (stop), single source, full migration, CI gate, dead-code removal, write-back |

The name is the shape: `c2d` (export, tokens included) and `d2c` (restore) are the two arcs; `govern` is the outer ring that keeps the loop from drifting apart. The optional Token Sync Figma plugin gives designers a push lane back into code — its engineering-side flow is covered by `c2d2c:export` + ADAPTING.md.

## Model

Run the skills with **Claude Fable 5**. Each pipeline is a long multi-stop agent run (Figma tool orchestration, regression screenshots, MR automation); earlier models tend to drop steps and need re-prompting partway through — Fable 5 is what makes the loop run smoothly end to end.

## Install

As a Claude Code plugin (recommended): add this directory as a local marketplace/plugin, or copy it into your plugin location. The skills then resolve as `c2d2c:restore` etc.

Standalone fallback: copy each `skills/<name>/` directory into `~/.claude/skills/`, updating the frontmatter `name:` if you rename the directory (they must match). Note the standalone form loses the `../../` plugin-root paths (scripts, templates, figma-plugin) — copy those alongside or adjust the paths.

## Configure

All skills read one config file: **`C2D2C.md` at your repo root** (fallback `.claude/c2d2c.md`). Copy `templates/C2D2C.template.md` there and fill it in; any skill will offer to bootstrap it on first run, discovering what it can from the repo. Prerequisites and per-parameter guidance: [ADAPTING.md](ADAPTING.md).

## Contents

- `skills/` — the three SKILL.md files (restore / export / govern)
- `figma-plugin/` — Token Sync, the local Figma plugin (TypeScript source; Pull variables/styles + bound foundation posters, Push designer edits as MRs with safe CSS write-back). See its README for build/install; generalization notes in ADAPTING.md.
- `scripts/ds-shot.mjs` — regression-page screenshot tool for the acceptance step (playwright; full page + per-`[data-ds-section]` close-ups, `--dark`)
- `templates/C2D2C.template.md` — the project parameter file
- `cases/` — four worked cases from production, one per pipeline
- `ADAPTING.md` — adoption checklist for new projects
