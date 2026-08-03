# c2d2c

**Code-to-design-to-code.** Three skills that close the loop between Figma and a production codebase, plus an optional Token Sync Figma plugin. The name is the shape: `c2d` and `d2c` are the two arcs; `ds-govern` is the outer ring that keeps the loop from drifting apart.

## Use

```bash
npx skills add BIAsia/c2d2c
```

Then just say what you want — each skill triggers on intent:

- **code → Figma** (`c2d`): *"Map out the search module — components and states — and export it to Figma: \<figma link\>"*
- **Figma → code** (`d2c`): *"Implement this design 1:1: \<figma link\>"*
- **converge the system** (`ds-govern`): *"Unify how radius is used across the project — one ladder, migrate everything, gate it."*

That's the whole workflow. No upfront configuration: on first run a skill reads what it can from your repo (tokens, gates, regression pages, git host), asks about the rest, and saves the answers to `C2D2C.md` at the repo root so it never asks again. The one hard prerequisite is the Figma MCP connector — read access for `d2c`, write access (`use_figma`) for `c2d`. Everything else is optional and degrades gracefully.

## Model

Run the skills with **Claude Fable 5**. Each pipeline is a long multi-stop agent run (Figma tool orchestration, regression screenshots, MR automation); earlier models tend to drop steps and need re-prompting partway through — Fable 5 is what makes the loop run smoothly end to end.

## What each skill enforces

| Skill | Pipeline | One line |
| --- | --- | --- |
| `c2d2c:d2c` | Figma → code | Eight steps from design link to merged MR: survey/reuse audit, plan review (stop), spec extraction (conditional stop), 1:1 build, regression page, motion review, screenshot acceptance (stop), cleanup + auto-MR |
| `c2d2c:c2d` | code → Figma | Everything that moves code state into Figma — components AND tokens. Three hard rules (enumerate every state from source, bind everything to tokens, ask before componentizing), 12 field-tested use_figma gotchas, plus the token-snapshot/gate discipline |
| `c2d2c:ds-govern` | code → code | Converge + freeze a style system: census, spec (stop), single source, full migration, CI gate, dead-code removal, write-back |

The optional Token Sync Figma plugin gives designers a push lane back into code — its engineering-side flow is covered by `c2d2c:c2d` + ADAPTING.md.

## Tuning (all optional)

- `C2D2C.md` is bootstrapped on first run; pre-create it from `templates/C2D2C.template.md` if you want to control the answers up front. Per-parameter guidance: [ADAPTING.md](ADAPTING.md).
- The skills get better with more surface to work with — a token system, a `/ds`-style regression route, CI gates, `glab`/`gh` — but a missing piece only degrades that step, it never blocks the run ([ADAPTING.md](ADAPTING.md) lists what degrades to what).
- Prefer the plugin form? Add this repo as a local Claude Code marketplace/plugin; the skills then resolve as `c2d2c:d2c` etc., with all plugin-root resources available locally.

## Contents

- `skills/` — the three skills (d2c / c2d / ds-govern); `skills/d2c/scripts/ds-shot.mjs` is the bundled regression-page screenshot tool for the acceptance step (playwright; full page + per-`[data-ds-section]` close-ups, `--dark`)
- `figma-plugin/` — Token Sync, the local Figma plugin (TypeScript source; Pull variables/styles + bound foundation posters, Push designer edits as MRs with safe CSS write-back). See its README for build/install; generalization notes in ADAPTING.md.
- `templates/C2D2C.template.md` — the project parameter file
- `cases/` — four worked cases from production, one per pipeline
- `ADAPTING.md` — adoption checklist for new projects

The introduction site lives in [BIAsia/c2d2c-site](https://github.com/BIAsia/c2d2c-site).
