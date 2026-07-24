# C2D2C project parameters

<!-- Copy this file to your repo root as C2D2C.md (or .claude/c2d2c.md) and fill it in.
     Every c2d2c:* skill resolves its parameters from here. Delete comments once filled. -->

## Figma

- `DESIGN_FILE`: <fileKey of the product design file — the restore source>
- `EXPORT_FILE`: <fileKey of the component-archive file — the export target; keep separate from DESIGN_FILE>
- `VAR_COLLECTIONS`: <synced variable collections, e.g. "Acme · Core / Ramps / Product", Light+Dark modes>
- `ICON_SOURCE`: <where icon SVGs come from, e.g. "hugeicons via pnpm store, createNodeFromSvg">

## Tokens

- `TOKEN_HOME`: <where tokens are defined, and every place one token registers, e.g. "globals.css + @theme alias + utils/cn.ts ladder">
- `TOKEN_DOCS`: <where the token/component system is documented, e.g. "docs/ui/*.md">
- `VAR_SNAPSHOT`: <generated snapshot paths, e.g. "design/figma-variables.json + design/figma-styles.json">
- `TOKEN_EXPORT`: <regeneration command, e.g. "pnpm figma:variables">

## Surfaces & gates

- `DS_ROUTE`: <regression-page route prefix, e.g. "/ds" — needs mock-props rendering + a stable URL; Storybook/Ladle equivalents fine>
- `GATES`: <aggregate gate command, e.g. "pnpm typecheck && pnpm check">
- `GATE_HOME`: <gate scripts directory + CI hook-in, e.g. "scripts/check-*.mjs, wired into pnpm check">
- `SPEC_HOME`: <spec docs directory, e.g. "docs/ui/">
- `LAW_HOME`: <agent-rules file, e.g. "CLAUDE.md, Development Guardrails section">

## Delivery

- `MR_TOOL`: <"glab" or "gh" + merge convention, e.g. "glab, server-side rebase, mr merge --auto-merge --yes">
- `DEPLOY_ORDER`: <cross-service conventions, e.g. "backend deploys before frontend for GraphQL field dependencies"; delete if N/A>
