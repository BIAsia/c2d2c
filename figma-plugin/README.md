# Token Sync (Figma plugin)

Two-way sync between `frontend/design/figma-variables.json` / `figma-styles.json`
(generated from `globals.css` by `pnpm figma:variables`) and Figma.
**Code is the source of truth**; Figma is the consumer. The reverse direction
(Push) only produces MR snapshots — it never edits code directly.

## Build

```bash
npm install
npm run build      # tsc: code.ts → code.js
npm run watch      # auto-recompile during development
npm run lint       # optional
```

`code.js` is a build artifact (gitignored). To change logic, edit **`code.ts`**
(main thread — touches the Figma document / clientStorage) and **`ui.html`**
(UI + GitLab network I/O).

## Install (local development plugin, no publishing needed)

1. Run `npm run build` first to generate `code.js`.
2. Figma desktop app → Plugins → Development → **Import plugin from manifest…**
3. Select `manifest.json` in this directory.
4. If your GitLab host is not `https://gitlab.example.com`, first edit
   `networkAccess.allowedDomains` in `manifest.json` (Figma requires domains to
   be statically declared in the manifest).

## Configuration (plugin "Settings" page)

| Field | Default |
| --- | --- |
| GitLab host | `https://gitlab.example.com` |
| Project path | `your-group/your-repo` (the group/project segment of the URL) |
| Access Token | Project Access Token, scope `api` (needed to open MRs; read is not enough) |
| Target branch | `main` |
| File paths | Pre-filled, monorepo-root-relative paths |

Everything except the Token is pre-filled — works out of the box. The Token is
stored in Figma clientStorage (local machine, visible to this plugin only) and
never committed. After filling in, click "Save" and you should see "✓ Saved.".

## Pull (code → Figma)

Pulls both JSON files from `main` and writes them into the current file.
Variables are split into three collections by audience (each with Light/Dark
modes):

| Collection | Contents | Usage |
| --- | --- | --- |
| `Offloop · Core` | sem roles (bg/text/stroke/state/surface/radius) + tone semantics | The only surface designers pull from day to day |
| `Offloop · Ramps` | full Radix palette ramps | alias targets; used for colorful/categorical scenarios |
| `Offloop · Product` | app product layer in active use (chat/chart/…) | transitional layer, gradually converging into Core |

Tokens whose raw CSS value is already `var(--palette-…)` — tone, chart, etc. —
are written as **cross-collection aliases** (pointing into Ramps), so changing a
ramp in one place updates both sides. Creates/updates/(optionally) deletes
orphans; scopes, `$codeSyntax.WEB`, descriptions, and hidden flags are all
written too.

Styles: paint (gradient) / effect (shadow) styles under the
`offloop/light|dark/…` prefix, and text styles under the `offloop/type/…`
prefix (Inter / JetBrains Mono must be installed or enabled).

## Preview (code → canvas)

Click the buttons on the "Preview" page to pull a snapshot from GitLab and
generate Foundations-poster-style preview frames on the canvas (layout modeled
on the Test file):

| Button | Output |
| --- | --- |
| Color | Two posters (Light / Dark), swatch grids grouped by the token tree |
| Typography | One row per text style: `family / weight / size` + live sample + codeSyntax |
| Shadow | One card per effect, with the real shadow applied |
| Radius | One corner-radius sample card per radius token |
| Generate all | All of the above, tiled horizontally at the viewport center |

Content is **auto-grouped by the real structure of your token tree** (section =
top-level group, labels = `Collection · Group` / `group / leaf name`) — not the
hand-curated naming in the reference file. So it always reflects the tokens
that actually exist in the file: change a token, regenerate, and it's in sync.
Fonts prefer Inter + Fragment Mono, falling back automatically when missing
(JetBrains Mono / Roboto Mono / Roboto).

**Preview is a superset of Pull**: clicking a button first applies variables /
styles into the current file (create if missing, update if present), then
draws. Everything in the posters is **bound to real Figma objects** — swatch
fills bind variables, font sizes bind text styles, shadows bind effect styles,
corner radii bind radius variables. So the posters follow variable changes;
the Light / Dark Color posters are each pinned to the corresponding mode, so
values are correct.

## Push (Figma → MR)

1. "Read changes": serializes this file's variables **and all styles (paint /
   effect / text)**, diffs them against the repo's `figma-variables.json` /
   `figma-styles.json` snapshots, and lists every entry (changed / added /
   deleted); it also pulls `globals.css` and **writes back** the changed
   values.
2. "Create MR": opens a `figma-sync/<date>-<random>` branch, one commit that
   **updates together** (as needed) the `figma-variables.json` +
   `figma-styles.json` snapshots + `globals.css`, and opens an MR to `main`.

Style write-back mapping (`offloop/<mode>/<key>` → CSS):
- **effect (shadow)** → the `box-shadow` of `--<key>` (multi-layer rebuilt layer
  by layer; single- or multi-line declarations both work)
- **paint (gradient)** → the `linear-gradient` of `--<key>` (angle solved back
  from `gradientTransform`, stops rebuilt one by one)
- **text (type)** → `--text-<key>` (size) + `--text-<key>--line-height` /
  `--letter-spacing` / `--font-weight` companion variables; only fields that
  **actually changed** are written back, with units (px/rem/em/unitless
  line-height multiplier) matched to the current declaration.

Likewise, only values that are **literals** in the CSS are written back;
`var()` compositions, missing declarations, and unit mismatches are flagged
for manual handling and never overwritten. Font family changes have no
corresponding CSS variable and cannot be reverse-mapped (they show in the diff
but are not written back).

**Write-back to globals.css (the source of truth)**: Push no longer only
updates snapshots. Using each token's `$codeSyntax.WEB` (`var(--x)`) plus its
Light/Dark scope (`:root`/`@theme` = Light, `.dark` = Dark), it precisely
replaces values inside `globals.css`, preserving end-of-line comments. Only the
**safe subset** is written back — tokens whose CSS value is already a literal
(hex/rgba/number+unit); alias→alias is also supported. Anything involving
`oklch()`/`color-mix()`, a `var()` alias changed to a literal, or a missing
`.dark` declaration is **skipped and listed in the MR description as needing
manual handling** — never overwritten. After a safe-subset write-back,
`check:figma-variables` goes green directly. All styles (paint / effect / text)
are written back the same way (see above).

> The repo side has an equivalent `pnpm apply:figma-variables`
> (`export-figma-variables.mjs --apply`) as a CLI fallback with identical
> logic.

## Known limitations

- Light/Dark dual modes require Figma Professional or above (addMode errors on
  the free plan).
- Renaming a variable inside Figma is treated as "delete old + add new" —
  initiate renames from the code side.
