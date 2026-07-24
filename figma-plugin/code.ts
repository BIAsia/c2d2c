// Token Sync — plugin main thread.
// Owns everything that touches the Figma document (variables, styles) and
// clientStorage. All network I/O happens in ui.html; the two sides talk via
// postMessage. The JSON formats are produced by
// frontend/scripts/export-figma-variables.mjs — code is the source of truth.

const COLLECTION_NAMES = ["Offloop · Core", "Offloop · Ramps", "Offloop · Product"]
const LEGACY_COLLECTION = "Offloop | Semantic" // pre-split single collection
const MODE_NAMES = ["Light", "Dark"] as const
const STYLE_PREFIX = "offloop"

figma.showUI(__html__, { width: 440, height: 620, themeColors: true })

// --- JSON shapes (produced by export-figma-variables.mjs) -------------------

interface Leaf {
  $value: string | number
  $type?: string
  $scopes?: string[]
  $description?: string
  $codeSyntax?: { WEB?: string }
  $hiddenFromPublishing?: boolean
  $collectionName?: string
  $libraryName?: string
}
type Tree = { [key: string]: Tree | Leaf }
interface CollectionDoc {
  [collName: string]: { modes: { Light: Tree; Dark: Tree } }
}
type VariablesDoc = CollectionDoc[]

interface GradientStopJson {
  color: string
  position: number
}
interface GradientJson {
  angle: number
  stops: GradientStopJson[]
}
interface EffectLayerJson {
  color: string
  x: number
  y: number
  blur: number
  spread: number
  inset?: boolean
}
interface TextStyleJson {
  family: string
  weight: number
  size: number
  lineHeight?: number | null
  letterSpacingPercent?: number | null
  letterSpacingPx?: number | null
  codeSyntax?: string
}
interface StylesDoc {
  paints: Record<string, Record<string, GradientJson>>
  effects: Record<string, Record<string, EffectLayerJson[]>>
  text: Record<string, TextStyleJson>
}

const isLeaf = (node: Tree | Leaf): node is Leaf =>
  node != null && typeof node === "object" && "$value" in node

// --- color helpers (must mirror scripts/export-figma-variables.mjs) ---------

interface RGBAColor {
  r: number
  g: number
  b: number
  a: number
}

function parseColor(str: string): RGBAColor | null {
  const s = String(str).trim()
  let m = s.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/i)
  if (m) {
    const hex = m[1]
    const alpha = m[2]
    const n = (o: number) => parseInt(hex.slice(o, o + 2), 16) / 255
    return { r: n(0), g: n(2), b: n(4), a: alpha ? parseInt(alpha, 16) / 255 : 1 }
  }
  m = s.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/)
  if (m) return { r: +m[1] / 255, g: +m[2] / 255, b: +m[3] / 255, a: m[4] == null ? 1 : +m[4] }
  return null
}

// Figma stores floats as 32-bit; reading them back re-expands to 64-bit noise
// (0.8 → 0.800000011920929). Collapse that so serialized values match the repo
// and don't show up as spurious diffs on Push.
function cleanFloat(n: number): number {
  return Number(n.toFixed(6))
}

// Style numbers (font size, line-height, shadow offsets, gradient stops) come
// off Figma as 32-bit floats — 17.72 reads back as 17.7199993. The repo styles
// snapshot uses at most 3 decimals, so rounding to 3 both collapses that noise
// and matches the export's precision exactly (no spurious "17.72 → 17.72" diff).
function round3(n: number): number {
  return Number(n.toFixed(3))
}

function serializeColor(c: RGBAColor): string {
  const to255 = (x: number) => Math.round(Math.min(1, Math.max(0, x)) * 255)
  if (c.a == null || c.a >= 1) {
    const hex = [c.r, c.g, c.b].map((x) => to255(x).toString(16).padStart(2, "0")).join("")
    return `#${hex}`
  }
  return `rgba(${to255(c.r)}, ${to255(c.g)}, ${to255(c.b)}, ${+c.a.toFixed(4)})`
}

// CSS gradient angle (0deg = to top, 90deg = to right) → Figma gradientTransform.
function gradientTransform(angleDeg: number): Transform {
  const rad = (angleDeg * Math.PI) / 180
  const ux = Math.sin(rad)
  const uy = -Math.cos(rad)
  const round = (x: number) => +x.toFixed(6)
  return [
    [round(ux), round(uy), round(0.5 - 0.5 * (ux + uy))],
    [round(-uy), round(ux), round(0.5 - 0.5 * (ux - uy))],
  ]
}

const FONT_STYLES: Record<number, string[]> = {
  100: ["Thin"],
  200: ["ExtraLight", "Extra Light"],
  300: ["Light"],
  400: ["Regular"],
  500: ["Medium"],
  600: ["SemiBold", "Semi Bold"],
  700: ["Bold"],
  800: ["ExtraBold", "Extra Bold"],
  900: ["Black"],
}

// --- variables: apply (code → Figma) ----------------------------------------

function walkLeaves(
  tree: Tree,
  pathParts: string[],
  visit: (path: string[], leaf: Leaf) => void
): void {
  for (const key of Object.keys(tree)) {
    const node = tree[key]
    if (isLeaf(node)) visit([...pathParts, key], node)
    else if (node && typeof node === "object") walkLeaves(node, [...pathParts, key], visit)
  }
}

function lookupPath(tree: Tree, pathParts: string[]): Leaf | null {
  let node: Tree | Leaf = tree
  for (const part of pathParts) {
    if (node == null || typeof node !== "object" || isLeaf(node)) return null
    node = node[part]
  }
  return node && isLeaf(node) ? node : null
}

interface EnsuredCollection {
  collection: VariableCollection
  modeIds: Record<string, string>
}

async function ensureCollection(name: string): Promise<EnsuredCollection> {
  const collections = await figma.variables.getLocalVariableCollectionsAsync()
  let collection = collections.find((c) => c.name === name)
  if (!collection) collection = figma.variables.createVariableCollection(name)
  const modeIds: Record<string, string> = {}
  for (const wanted of MODE_NAMES) {
    const existing = collection.modes.find((m) => m.name === wanted)
    if (existing) {
      modeIds[wanted] = existing.modeId
    } else if (Object.keys(modeIds).length === 0 && collection.modes.length === 1) {
      collection.renameMode(collection.modes[0].modeId, wanted)
      modeIds[wanted] = collection.modes[0].modeId
    } else {
      modeIds[wanted] = collection.addMode(wanted) // throws when the plan's mode limit is hit
    }
  }
  return { collection, modeIds }
}

const isAliasRef = (v: unknown): v is string =>
  typeof v === "string" && v.startsWith("{") && v.endsWith("}")

interface VarSummary {
  created: number
  updated: number
  removed: number
  failed: string[]
  notice: string | null
}

interface DeferredAlias {
  variable: Variable
  modeId: string
  targetCollection: string | undefined
  targetName: string
  display: string
}

interface CollState {
  collection: VariableCollection
  modeIds: Record<string, string>
  byName: Map<string, Variable>
  visited: Set<string>
}

async function applyVariables(doc: VariablesDoc, removeOrphans: boolean): Promise<VarSummary> {
  const summary: VarSummary = { created: 0, updated: 0, removed: 0, failed: [], notice: null }
  const allLocals = await figma.variables.getLocalVariablesAsync()
  // pass 1: ensure collections and variables, set literal values; aliases are
  // deferred so their targets exist regardless of collection order.
  const colls = new Map<string, CollState>()
  const deferred: DeferredAlias[] = []
  for (const entry of doc) {
    const collName = Object.keys(entry)[0]
    const root = entry[collName]
    const { collection, modeIds } = await ensureCollection(collName)
    const byName = new Map<string, Variable>(
      allLocals.filter((v) => v.variableCollectionId === collection.id).map((v) => [v.name, v])
    )
    const visited = new Set<string>()
    colls.set(collName, { collection, modeIds, byName, visited })

    walkLeaves(root.modes.Light, [], (pathParts, lightLeaf) => {
      const name = pathParts.join("/")
      visited.add(name)
      const wantedType: VariableResolvedDataType = lightLeaf.$type === "color" ? "COLOR" : "FLOAT"
      try {
        let variable = byName.get(name)
        if (variable && variable.resolvedType !== wantedType) {
          variable.remove()
          variable = undefined
        }
        if (!variable) {
          variable = figma.variables.createVariable(name, collection, wantedType)
          byName.set(name, variable)
          summary.created += 1
        } else {
          summary.updated += 1
        }
        const darkLeaf = lookupPath(root.modes.Dark, pathParts) || lightLeaf
        for (const [modeName, leaf] of [
          ["Light", lightLeaf],
          ["Dark", darkLeaf],
        ] as const) {
          if (isAliasRef(leaf.$value)) {
            deferred.push({
              variable,
              modeId: modeIds[modeName],
              targetCollection: leaf.$collectionName,
              targetName: leaf.$value.slice(1, -1).split(".").join("/"),
              display: `${collName} ${name}`,
            })
            continue
          }
          const value =
            wantedType === "COLOR" ? parseColor(String(leaf.$value)) : Number(leaf.$value)
          if (value == null || (wantedType === "FLOAT" && Number.isNaN(value))) {
            throw new Error(`bad value ${leaf.$value}`)
          }
          variable.setValueForMode(modeIds[modeName], value)
        }
        // Don't restrict where a token can be applied: the export scopes color
        // roles to ALL_FILLS / STROKE_COLOR, but icons drawn with strokes (and
        // other surfaces) need every token usable everywhere. ALL_SCOPES keeps
        // each variable available for fill, stroke, effect, etc.
        variable.scopes = ["ALL_SCOPES"]
        variable.hiddenFromPublishing = !!lightLeaf.$hiddenFromPublishing
        if (lightLeaf.$description) variable.description = lightLeaf.$description
        if (lightLeaf.$codeSyntax?.WEB) {
          variable.setVariableCodeSyntax("WEB", lightLeaf.$codeSyntax.WEB)
        }
      } catch (e) {
        summary.failed.push(`${collName} ${name}: ${(e as Error).message}`)
      }
    })
  }

  // pass 2: aliases (targets all exist now)
  for (const d of deferred) {
    try {
      const target = d.targetCollection
        ? colls.get(d.targetCollection)?.byName.get(d.targetName)
        : undefined
      if (!target) throw new Error(`alias target ${d.targetCollection} ${d.targetName} not found`)
      d.variable.setValueForMode(d.modeId, figma.variables.createVariableAlias(target))
    } catch (e) {
      summary.failed.push(`${d.display}: ${(e as Error).message}`)
    }
  }

  if (removeOrphans) {
    for (const { byName, visited } of colls.values()) {
      for (const [name, variable] of byName) {
        if (!visited.has(name)) {
          try {
            variable.remove()
            summary.removed += 1
          } catch (e) {
            summary.failed.push(`remove ${name}: ${(e as Error).message}`)
          }
        }
      }
    }
  }

  const collections = await figma.variables.getLocalVariableCollectionsAsync()
  if (collections.some((c) => c.name === LEGACY_COLLECTION)) {
    summary.notice = `Legacy collection "${LEGACY_COLLECTION}" still exists. Once you've confirmed nothing references it, delete it manually in the Figma variables panel (the plugin won't delete it, to avoid breaking references).`
  }
  return summary
}

// --- styles: apply (code → Figma) -------------------------------------------

interface StyleSummary {
  paints: number
  effects: number
  texts: number
  failed: string[]
}

// A shadow layer → Figma Effect. `showShadowBehindNode` is only valid on
// DROP_SHADOW; adding it to an INNER_SHADOW fails validation.
function toEffect(l: EffectLayerJson): Effect {
  const c = parseColor(l.color) || { r: 0, g: 0, b: 0, a: 1 }
  const base = {
    color: { r: c.r, g: c.g, b: c.b, a: c.a },
    offset: { x: l.x, y: l.y },
    radius: l.blur,
    spread: l.spread,
    visible: true,
    blendMode: "NORMAL" as BlendMode,
  }
  return l.inset
    ? { type: "INNER_SHADOW", ...base }
    : { type: "DROP_SHADOW", ...base, showShadowBehindNode: false }
}

async function applyStyles(stylesDoc: StylesDoc): Promise<StyleSummary> {
  const summary: StyleSummary = { paints: 0, effects: 0, texts: 0, failed: [] }

  const paintStyles = await figma.getLocalPaintStylesAsync()
  for (const mode of MODE_NAMES) {
    for (const key of Object.keys(stylesDoc.paints[mode] || {})) {
      const grad = stylesDoc.paints[mode][key]
      const name = `${STYLE_PREFIX}/${mode.toLowerCase()}/${key}`
      try {
        let style = paintStyles.find((s) => s.name === name)
        if (!style) {
          style = figma.createPaintStyle()
          style.name = name
        }
        style.paints = [
          {
            type: "GRADIENT_LINEAR",
            gradientTransform: gradientTransform(grad.angle),
            gradientStops: grad.stops.map((s) => {
              const c = parseColor(s.color) as RGBAColor
              return { position: s.position, color: { r: c.r, g: c.g, b: c.b, a: c.a } }
            }),
          },
        ]
        summary.paints += 1
      } catch (e) {
        summary.failed.push(`${name}: ${(e as Error).message}`)
      }
    }
  }

  const effectStyles = await figma.getLocalEffectStylesAsync()
  for (const mode of MODE_NAMES) {
    for (const key of Object.keys(stylesDoc.effects[mode] || {})) {
      const layers = stylesDoc.effects[mode][key]
      const name = `${STYLE_PREFIX}/${mode.toLowerCase()}/${key}`
      try {
        let style = effectStyles.find((s) => s.name === name)
        if (!style) {
          style = figma.createEffectStyle()
          style.name = name
        }
        style.effects = layers.map(toEffect)
        summary.effects += 1
      } catch (e) {
        summary.failed.push(`${name}: ${(e as Error).message}`)
      }
    }
  }

  const textStyles = await figma.getLocalTextStylesAsync()
  for (const key of Object.keys(stylesDoc.text || {})) {
    const t = stylesDoc.text[key]
    const name = `${STYLE_PREFIX}/type/${key}`
    try {
      const candidates = FONT_STYLES[t.weight] || ["Regular"]
      let font: FontName | null = null
      for (const styleName of candidates) {
        try {
          await figma.loadFontAsync({ family: t.family, style: styleName })
          font = { family: t.family, style: styleName }
          break
        } catch (_) {
          // try the next weight-name spelling
        }
      }
      if (!font) throw new Error(`font ${t.family} weight ${t.weight} unavailable`)
      let style = textStyles.find((s) => s.name === name)
      if (!style) {
        style = figma.createTextStyle()
        style.name = name
      }
      style.fontName = font
      style.fontSize = t.size
      if (t.lineHeight != null) style.lineHeight = { unit: "PIXELS", value: t.lineHeight }
      if (t.letterSpacingPercent != null)
        style.letterSpacing = { unit: "PERCENT", value: t.letterSpacingPercent }
      else if (t.letterSpacingPx != null)
        style.letterSpacing = { unit: "PIXELS", value: t.letterSpacingPx }
      if (t.codeSyntax) style.description = t.codeSyntax
      summary.texts += 1
    } catch (e) {
      summary.failed.push(`${name}: ${(e as Error).message}`)
    }
  }
  return summary
}

// --- variables: serialize (Figma → code) ------------------------------------

interface SerializedEntry {
  name: string
  type: "color" | "float"
  scopes: VariableScope[]
  description: string | null
  codeSyntax: string | null
  values: Record<string, string | number | { alias: string; collection: string }>
}
interface SerializedCollection {
  name: string
  entries: SerializedEntry[]
}
interface Snapshot {
  collections: SerializedCollection[]
}

async function serializeVariables(): Promise<Snapshot> {
  const allCollections = await figma.variables.getLocalVariableCollectionsAsync()
  const allLocals = await figma.variables.getLocalVariablesAsync()
  const collById = new Map(allCollections.map((c) => [c.id, c]))
  const varById = new Map(allLocals.map((v) => [v.id, v]))
  const collections: SerializedCollection[] = []
  for (const collName of COLLECTION_NAMES) {
    const collection = allCollections.find((c) => c.name === collName)
    if (!collection) continue
    const modeIds: Record<string, string> = {}
    for (const m of collection.modes) modeIds[m.name] = m.modeId
    for (const wanted of MODE_NAMES) {
      if (!modeIds[wanted]) throw new Error(`mode "${wanted}" missing on "${collName}"`)
    }
    const entries: SerializedEntry[] = []
    for (const variable of allLocals.filter((v) => v.variableCollectionId === collection.id)) {
      const entry: SerializedEntry = {
        name: variable.name,
        type: variable.resolvedType === "COLOR" ? "color" : "float",
        scopes: variable.scopes,
        description: variable.description || null,
        codeSyntax: variable.codeSyntax?.WEB || null,
        values: {},
      }
      for (const modeName of MODE_NAMES) {
        const raw = variable.valuesByMode[modeIds[modeName]]
        if (raw == null) continue
        if (typeof raw === "object" && "type" in raw && raw.type === "VARIABLE_ALIAS") {
          const target = varById.get(raw.id) || (await figma.variables.getVariableByIdAsync(raw.id))
          entry.values[modeName] = {
            alias: target ? target.name : raw.id,
            collection: target ? (collById.get(target.variableCollectionId)?.name ?? "") : "",
          }
        } else if (variable.resolvedType === "COLOR") {
          entry.values[modeName] = serializeColor(raw as RGBAColor)
        } else {
          entry.values[modeName] = cleanFloat(raw as number)
        }
      }
      entries.push(entry)
    }
    collections.push({ name: collName, entries })
  }
  if (collections.length === 0) {
    throw new Error(`This file has none of the ${COLLECTION_NAMES.join(" / ")} collections — Pull once first.`)
  }
  return { collections }
}

// --- styles: serialize (Figma → code) ---------------------------------------
// Reverse of applyStyles: read the offloop/<mode>/<key> paint + effect styles
// and offloop/type/<key> text styles back into the figma-styles.json shape, so
// Push can diff gradient / shadow / typography edits.

interface SerializedStyles {
  paints: { Light: Record<string, GradientJson>; Dark: Record<string, GradientJson> }
  effects: { Light: Record<string, EffectLayerJson[]>; Dark: Record<string, EffectLayerJson[]> }
  text: Record<string, TextStyleJson>
}

// Inverse of the export's gradientTransform(angleDeg): recover the CSS angle.
function transformToAngle(t: Transform): number {
  const ux = t[0][0]
  const uy = t[0][1]
  let deg = (Math.atan2(ux, -uy) * 180) / Math.PI
  deg = ((deg % 360) + 360) % 360
  return +deg.toFixed(2)
}

const WEIGHT_FROM_STYLE: Record<string, number> = {
  Thin: 100,
  ExtraLight: 200,
  "Extra Light": 200,
  Light: 300,
  Regular: 400,
  Medium: 500,
  SemiBold: 600,
  "Semi Bold": 600,
  Bold: 700,
  ExtraBold: 800,
  "Extra Bold": 800,
  Black: 900,
}

async function serializeStyles(): Promise<SerializedStyles> {
  const out: SerializedStyles = { paints: { Light: {}, Dark: {} }, effects: { Light: {}, Dark: {} }, text: {} }
  const modeRe = new RegExp(`^${STYLE_PREFIX}/(light|dark)/(.+)$`)

  for (const style of await figma.getLocalPaintStylesAsync()) {
    const m = style.name.match(modeRe)
    if (!m) continue
    const p = style.paints[0]
    if (!p || p.type !== "GRADIENT_LINEAR") continue
    out.paints[m[1] === "dark" ? "Dark" : "Light"][m[2]] = {
      angle: transformToAngle(p.gradientTransform),
      stops: p.gradientStops.map((s) => ({
        color: serializeColor({ r: s.color.r, g: s.color.g, b: s.color.b, a: s.color.a }),
        position: round3(s.position),
      })),
    }
  }

  for (const style of await figma.getLocalEffectStylesAsync()) {
    const m = style.name.match(modeRe)
    if (!m) continue
    const layers: EffectLayerJson[] = []
    for (const e of style.effects) {
      if (e.type !== "DROP_SHADOW" && e.type !== "INNER_SHADOW") continue
      const s = e as DropShadowEffect | InnerShadowEffect
      const c = s.color
      layers.push({
        inset: e.type === "INNER_SHADOW",
        x: round3(s.offset.x),
        y: round3(s.offset.y),
        blur: round3(s.radius),
        spread: round3(s.spread ?? 0),
        color: serializeColor({ r: c.r, g: c.g, b: c.b, a: c.a }),
      })
    }
    out.effects[m[1] === "dark" ? "Dark" : "Light"][m[2]] = layers
  }

  const typeRe = new RegExp(`^${STYLE_PREFIX}/type/(.+)$`)
  for (const style of await figma.getLocalTextStylesAsync()) {
    const m = style.name.match(typeRe)
    if (!m) continue
    const key = m[1]
    const size = round3(style.fontSize)
    let lineHeight: number | null = null
    if (style.lineHeight.unit === "PIXELS") lineHeight = round3(style.lineHeight.value)
    else if (style.lineHeight.unit === "PERCENT") lineHeight = round3((style.lineHeight.value / 100) * size)
    // Figma text styles default to {PERCENT, 0} letter-spacing; the repo snapshot
    // stores "no letter-spacing" as null. Treat 0 as null so unchanged styles
    // round-trip cleanly instead of showing a spurious 0-vs-null diff.
    let letterSpacingPercent: number | null = null
    let letterSpacingPx: number | null = null
    if (style.letterSpacing.unit === "PERCENT" && style.letterSpacing.value !== 0)
      letterSpacingPercent = round3(style.letterSpacing.value)
    else if (style.letterSpacing.unit === "PIXELS" && style.letterSpacing.value !== 0)
      letterSpacingPx = round3(style.letterSpacing.value)
    out.text[key] = {
      family: style.fontName.family,
      size,
      lineHeight,
      letterSpacingPercent,
      letterSpacingPx,
      weight: WEIGHT_FROM_STYLE[style.fontName.style.replace(/ Italic$/, "")] ?? 400,
      codeSyntax: `text-${key}`,
    }
  }
  return out
}

// --- preview: draw poster frames on canvas (code → canvas) ------------------
// Reproduces the Foundations poster format (breadcrumb + big title + sectioned
// swatch grid) from the reference Test file, auto-populated from the token /
// style JSON. Content is grouped by the real token tree, not the reference's
// hand-curated sections — so it always mirrors what's actually in the file.

const PV = {
  frameW: 1126,
  padX: 64,
  breadcrumbTop: 47,
  titleTop: 111,
  contentTop: 305,
  contentBottom: 64,
  sectionGap: 128,
  rowGap: 65,
  leftColW: 304,
  rightColW: 629,
  swatchW: 140,
  swatchH: 74,
  cellGap: 23,
  cardRadius: 12,
  titleSize: 100,
  titleTracking: -3,
}

interface Chrome {
  bg: string
  text: string
  sub: string
  frameBorder: string
  swatchBorder: string
  demoFill: string
}
const CHROME: Record<"Light" | "Dark", Chrome> = {
  Light: {
    bg: "#ffffff",
    text: "#000000",
    sub: "#8d8d8d",
    frameBorder: "rgba(0, 0, 0, 0.12)",
    swatchBorder: "rgba(0, 0, 0, 0.09)",
    demoFill: "#f5f5f5",
  },
  Dark: {
    bg: "#1a1a1a",
    text: "#ffffff",
    sub: "#8d8d8d",
    frameBorder: "rgba(255, 255, 255, 0.12)",
    swatchBorder: "rgba(255, 255, 255, 0.14)",
    demoFill: "#262626",
  },
}

const INTER_STYLE: Record<number, string> = {
  100: "Thin",
  200: "Extra Light",
  300: "Light",
  400: "Regular",
  500: "Medium",
  600: "Semi Bold",
  700: "Bold",
  800: "Extra Bold",
  900: "Black",
}
const WEIGHT_LABEL: Record<number, string> = {
  100: "Thin",
  200: "ExtraLight",
  300: "Light",
  400: "Regular",
  500: "Medium",
  600: "Semibold",
  700: "Bold",
  800: "ExtraBold",
  900: "Black",
}

// Offloop app-icon mark, exported from the reference Test file (node 9:787).
const LOGO_PATH =
  "M37.2142 27.7478C37.2142 28.5651 37.2142 28.9737 37.0535 29.2115C36.8871 29.4578 36.6139 29.6105 36.317 29.6233C36.0303 29.6357 35.6821 29.4217 34.9858 28.9937L29.7443 25.7721C29.0826 25.3654 28.7518 25.1621 28.5062 24.89C28.2497 24.6057 28.0604 24.2672 27.9526 23.8998C27.8493 23.5481 27.8493 23.1598 27.8493 22.3832V17.262C27.8493 15.9266 27.8493 15.2589 27.5873 14.8113C27.3153 14.3467 26.86 14.0182 26.3333 13.9066C25.8259 13.7991 25.1923 14.0097 23.925 14.4309L17.2052 16.6642C16.0341 17.0535 15.4485 17.2481 15.0071 17.5984C14.5465 17.964 14.196 18.4498 13.9943 19.0022C13.8011 19.5316 13.8011 20.1486 13.8011 21.3828V27.667C13.8011 29.0025 13.8011 29.6702 14.0632 30.1178C14.3352 30.5824 14.7904 30.9108 15.3171 31.0224C15.8245 31.13 16.4582 30.9194 17.7255 30.4982L24.3059 28.3112C24.9247 28.1055 25.2341 28.0027 25.546 27.9787C25.8721 27.9536 26.2001 27.9916 26.5119 28.0904C26.8101 28.1849 27.0879 28.3556 27.6434 28.6971L32.6628 31.7821C33.4779 32.2831 33.8855 32.5336 34.0011 32.8195C34.1206 33.115 34.0817 33.4509 33.898 33.7114C33.7202 33.9633 33.2662 34.1142 32.3582 34.416L25.8186 36.5894C20.7495 38.2742 18.2149 39.1166 16.1853 38.6865C14.0785 38.2401 12.2575 36.9264 11.1694 35.0679C10.1212 33.2776 10.1212 30.6067 10.1212 25.2649V21.9677C10.1212 19.4994 10.1212 18.2652 10.5077 17.2065C10.9109 16.1017 11.6119 15.13 12.5331 14.3989C13.4159 13.6983 14.5871 13.3091 16.9294 12.5306L21.5167 11.006C26.5859 9.32123 29.1205 8.47885 31.1501 8.90889C33.2568 9.35529 35.0779 10.669 36.166 12.5275C37.2142 14.3179 37.2142 16.9888 37.2142 22.3305V27.7478Z"
function logoSvg(fill: string): string {
  return `<svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="${LOGO_PATH}" fill="${fill}"/></svg>`
}

interface Fonts {
  regular: FontName
  medium: FontName
  semibold: FontName
  bold: FontName
  mono: FontName
}

async function loadFirst(candidates: FontName[]): Promise<FontName> {
  for (const f of candidates) {
    try {
      await figma.loadFontAsync(f)
      return f
    } catch (_) {
      // try next
    }
  }
  const fb: FontName = { family: "Roboto", style: "Regular" }
  await figma.loadFontAsync(fb)
  return fb
}

async function loadFonts(): Promise<Fonts> {
  return {
    regular: await loadFirst([{ family: "Inter", style: "Regular" }]),
    medium: await loadFirst([
      { family: "Inter", style: "Medium" },
      { family: "Inter", style: "Regular" },
    ]),
    semibold: await loadFirst([
      { family: "Inter", style: "Semi Bold" },
      { family: "Inter", style: "Bold" },
    ]),
    bold: await loadFirst([{ family: "Inter", style: "Bold" }]),
    mono: await loadFirst([
      { family: "Fragment Mono", style: "Regular" },
      { family: "JetBrains Mono", style: "Regular" },
      { family: "Roboto Mono", style: "Regular" },
    ]),
  }
}

function paintFrom(str: string): SolidPaint {
  const c = parseColor(str) || { r: 0, g: 0, b: 0, a: 1 }
  return { type: "SOLID", color: { r: c.r, g: c.g, b: c.b }, opacity: c.a }
}

interface TextOpts {
  lineHeight?: number
  letterSpacing?: number
  width?: number
  opacity?: number
}
function makeText(chars: string, font: FontName, size: number, color: string, opts: TextOpts = {}): TextNode {
  const t = figma.createText()
  t.fontName = font
  t.characters = chars
  t.fontSize = size
  const c = parseColor(color) || { r: 0, g: 0, b: 0, a: 1 }
  t.fills = [{ type: "SOLID", color: { r: c.r, g: c.g, b: c.b }, opacity: c.a * (opts.opacity ?? 1) }]
  if (opts.lineHeight != null) t.lineHeight = { unit: "PIXELS", value: opts.lineHeight }
  if (opts.letterSpacing != null) t.letterSpacing = { unit: "PIXELS", value: opts.letterSpacing }
  if (opts.width != null) {
    t.textAutoResize = "HEIGHT"
    t.resize(opts.width, t.height)
  } else {
    t.textAutoResize = "WIDTH_AND_HEIGHT"
  }
  return t
}

type Dir = "HORIZONTAL" | "VERTICAL"
interface FrameOpts {
  gap?: number
  counterGap?: number
  padX?: number
  padY?: number
  wrap?: boolean
  align?: "MIN" | "CENTER" | "MAX"
  fixedW?: number
}
function autoFrame(name: string, dir: Dir, opts: FrameOpts = {}): FrameNode {
  const f = figma.createFrame()
  f.name = name
  f.layoutMode = dir
  f.fills = []
  f.clipsContent = false
  f.primaryAxisSizingMode = "AUTO"
  f.counterAxisSizingMode = "AUTO"
  if (opts.gap != null) f.itemSpacing = opts.gap
  if (opts.counterGap != null) f.counterAxisSpacing = opts.counterGap
  if (opts.padX != null) {
    f.paddingLeft = opts.padX
    f.paddingRight = opts.padX
  }
  if (opts.padY != null) {
    f.paddingTop = opts.padY
    f.paddingBottom = opts.padY
  }
  if (opts.align) f.counterAxisAlignItems = opts.align
  if (opts.wrap) f.layoutWrap = "WRAP"
  if (opts.fixedW != null) {
    if (dir === "HORIZONTAL") f.primaryAxisSizingMode = "FIXED"
    else f.counterAxisSizingMode = "FIXED"
    f.resize(opts.fixedW, f.height || 1)
  }
  return f
}

// The frame chrome shared by every poster: outer card + breadcrumb + title.
function buildPosterShell(title: string, subtitle: string | null, chrome: Chrome, fonts: Fonts, content: FrameNode): FrameNode {
  const frame = figma.createFrame()
  frame.name = `${title}${subtitle ? " " + subtitle : ""}`
  frame.fills = [paintFrom(chrome.bg)]
  frame.cornerRadius = 48
  frame.strokes = [paintFrom(chrome.frameBorder)]
  frame.strokeWeight = 1
  frame.clipsContent = true

  // breadcrumb
  const crumb = autoFrame("Breadcrumbs", "HORIZONTAL", { gap: 24, align: "CENTER" })
  crumb.appendChild(makeText("Offloop UI", fonts.medium, 14, chrome.text, { lineHeight: 20 }))
  crumb.appendChild(makeText("Foundations", fonts.regular, 14, chrome.sub, { lineHeight: 20 }))
  frame.appendChild(crumb)
  crumb.x = PV.padX
  crumb.y = PV.breadcrumbTop

  // logo mark (Offloop app icon, exported from the reference file)
  const logo = figma.createNodeFromSvg(logoSvg(chrome.text))
  logo.name = "Logo"
  logo.resize(48, 48)
  frame.appendChild(logo)
  logo.x = PV.frameW - PV.padX - 48
  logo.y = PV.breadcrumbTop

  // title (+ optional muted subtitle inline, e.g. "(light)")
  const titleRow = autoFrame("Title", "HORIZONTAL", { gap: 8, align: "CENTER" })
  titleRow.appendChild(
    makeText(title, fonts.medium, PV.titleSize, chrome.text, { letterSpacing: PV.titleTracking })
  )
  if (subtitle) {
    titleRow.appendChild(
      makeText(subtitle, fonts.medium, PV.titleSize, chrome.text, {
        letterSpacing: PV.titleTracking,
        opacity: 0.1,
      })
    )
  }
  frame.appendChild(titleRow)
  titleRow.x = PV.padX - 8
  titleRow.y = PV.titleTop

  // content
  frame.appendChild(content)
  content.x = PV.padX
  content.y = PV.contentTop

  frame.resize(PV.frameW, PV.contentTop + content.height + PV.contentBottom)
  return frame
}

// A swatch cell: color chip + "group / leaf" mono label below. The chip fill is
// bound to the real Figma variable so it tracks edits and the frame's mode; the
// literal fallback fill is only used if the variable is somehow missing.
function swatchCell(
  group: string,
  leaf: string,
  variable: Variable | null,
  fallback: string | null,
  chrome: Chrome,
  fonts: Fonts
): FrameNode {
  const cell = autoFrame("Swatch", "VERTICAL", { gap: 12, fixedW: PV.swatchW })
  const rect = figma.createRectangle()
  rect.resize(PV.swatchW, PV.swatchH)
  rect.cornerRadius = PV.cardRadius
  if (variable) {
    const base: SolidPaint = { type: "SOLID", color: { r: 0, g: 0, b: 0 }, opacity: 1 }
    rect.fills = [figma.variables.setBoundVariableForPaint(base, "color", variable)]
  } else {
    rect.fills = fallback ? [paintFrom(fallback)] : []
  }
  rect.strokes = [paintFrom(chrome.swatchBorder)]
  rect.strokeWeight = 1
  cell.appendChild(rect)

  const label = makeText(`${group} / ${leaf}`, fonts.mono, 14, chrome.text, {
    lineHeight: 16,
    width: PV.swatchW - 2,
  })
  const prefix = group.length + 3 // "group / "
  label.setRangeFills(0, Math.min(prefix, label.characters.length), [paintFrom(chrome.sub)])
  cell.appendChild(label)
  return cell
}

// One section = left column (title + count) + right wrap-grid of cells.
function section(title: string, desc: string, cells: FrameNode[], chrome: Chrome, fonts: Fonts): FrameNode {
  const row = autoFrame("Section", "HORIZONTAL", { gap: PV.rowGap, align: "MIN" })
  const left = autoFrame("Section info", "VERTICAL", { gap: 5, fixedW: PV.leftColW })
  left.appendChild(makeText(title, fonts.medium, 14, chrome.text, { lineHeight: 20, width: PV.leftColW }))
  if (desc) left.appendChild(makeText(desc, fonts.regular, 14, chrome.sub, { lineHeight: 20, width: PV.leftColW }))
  row.appendChild(left)

  const grid = autoFrame("Grid", "HORIZONTAL", {
    gap: PV.cellGap,
    counterGap: PV.cellGap,
    wrap: true,
    fixedW: PV.rightColW,
  })
  for (const c of cells) grid.appendChild(c)
  row.appendChild(grid)
  return row
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// Flatten every collection's leaves (per mode) into collection → path → leaf,
// so cross-collection aliases can be resolved to a literal color.
function buildLookup(doc: VariablesDoc, mode: "Light" | "Dark"): Map<string, Map<string, Leaf>> {
  const m = new Map<string, Map<string, Leaf>>()
  for (const entry of doc) {
    const cn = Object.keys(entry)[0]
    const map = new Map<string, Leaf>()
    walkLeaves(entry[cn].modes[mode], [], (p, l) => map.set(p.join("/"), l))
    m.set(cn, map)
  }
  return m
}
function resolveColor(
  lookup: Map<string, Map<string, Leaf>>,
  collName: string,
  leaf: Leaf,
  depth = 0
): string | null {
  const v = leaf.$value
  if (typeof v === "number") return null
  if (isAliasRef(v)) {
    if (depth > 8) return null
    const targetColl = leaf.$collectionName || collName
    const name = v.slice(1, -1).split(".").join("/")
    const t = lookup.get(targetColl)?.get(name)
    if (!t) return null
    return resolveColor(lookup, targetColl, t, depth + 1)
  }
  return v
}

// Real Figma variables/styles created by applyVariables/applyStyles, indexed so
// the poster can bind to them instead of drawing dead literals.
interface VarIndex {
  varByColl: Map<string, Map<string, Variable>>
  collections: VariableCollection[]
  modeId: (collName: string, mode: "Light" | "Dark") => string | undefined
  find: (name: string) => Variable | null
}
async function indexVariables(): Promise<VarIndex> {
  const cols = await figma.variables.getLocalVariableCollectionsAsync()
  const vars = await figma.variables.getLocalVariablesAsync()
  const colById = new Map(cols.map((c) => [c.id, c]))
  const varByColl = new Map<string, Map<string, Variable>>()
  const modeMap = new Map<string, Record<string, string>>()
  for (const c of cols) {
    varByColl.set(c.name, new Map())
    const mm: Record<string, string> = {}
    for (const m of c.modes) mm[m.name] = m.modeId
    modeMap.set(c.name, mm)
  }
  for (const v of vars) {
    const c = colById.get(v.variableCollectionId)
    if (c) varByColl.get(c.name)?.set(v.name, v)
  }
  return {
    varByColl,
    collections: cols,
    modeId: (cn, mode) => modeMap.get(cn)?.[mode],
    find: (name) => {
      for (const m of varByColl.values()) {
        const v = m.get(name)
        if (v) return v
      }
      return null
    },
  }
}

interface StyleIndex {
  effectByName: Map<string, EffectStyle>
  textByName: Map<string, TextStyle>
}
async function indexStyles(): Promise<StyleIndex> {
  const effects = await figma.getLocalEffectStylesAsync()
  const texts = await figma.getLocalTextStylesAsync()
  return {
    effectByName: new Map(effects.map((s) => [s.name, s])),
    textByName: new Map(texts.map((s) => [s.name, s])),
  }
}

// Pin every collection's mode on a poster frame so bound values resolve to the
// intended Light / Dark column.
function pinModes(frame: FrameNode, vindex: VarIndex, mode: "Light" | "Dark"): void {
  for (const c of vindex.collections) {
    const mid = vindex.modeId(c.name, mode)
    if (!mid) continue
    try {
      frame.setExplicitVariableModeForCollection(c, mid)
    } catch (_) {
      // collection not resolvable on this node; ignore
    }
  }
}

function colorPoster(doc: VariablesDoc, mode: "Light" | "Dark", fonts: Fonts, vindex: VarIndex): FrameNode {
  const chrome = CHROME[mode]
  const lookup = buildLookup(doc, mode)
  const container = autoFrame("Container", "VERTICAL", { gap: PV.sectionGap })
  for (const entry of doc) {
    const collName = Object.keys(entry)[0]
    const root = entry[collName].modes[mode]
    const vmap = vindex.varByColl.get(collName)
    for (const group of Object.keys(root)) {
      const node = root[group]
      const leaves: { path: string; leaf: Leaf }[] = []
      if (isLeaf(node)) leaves.push({ path: group, leaf: node })
      else walkLeaves(node, [group], (p, l) => leaves.push({ path: p.join("/"), leaf: l }))
      const cells: FrameNode[] = []
      for (const { path, leaf } of leaves) {
        if ((leaf.$type ?? "color") !== "color") continue
        const variable = vmap?.get(path) ?? null
        const fallback = resolveColor(lookup, collName, leaf)
        const parts = path.split("/")
        cells.push(swatchCell(parts[0], parts.slice(1).join("/") || parts[0], variable, fallback, chrome, fonts))
      }
      if (cells.length === 0) continue
      const label = `${collName.replace(/^Offloop · /, "")} · ${capitalize(group)}`
      container.appendChild(section(label, `${cells.length} tokens`, cells, chrome, fonts))
    }
  }
  const frame = buildPosterShell("Color", `(${mode.toLowerCase()})`, chrome, fonts, container)
  pinModes(frame, vindex, mode)
  return frame
}

async function typographyPoster(styles: StylesDoc, fonts: Fonts, sindex: StyleIndex): Promise<FrameNode> {
  const chrome = CHROME.Light
  const list = autoFrame("Text Styles", "VERTICAL", { gap: 64 })
  for (const key of Object.keys(styles.text)) {
    const t = styles.text[key]
    const styleName = t.family === "Inter" ? INTER_STYLE[t.weight] || "Regular" : t.weight >= 600 ? "Bold" : t.weight >= 500 ? "Medium" : "Regular"
    const sampleFont = await loadFirst([
      { family: t.family, style: styleName },
      { family: t.family, style: "Regular" },
      fonts.regular,
    ])

    const row = autoFrame("Row", "HORIZONTAL", { gap: PV.rowGap, align: "CENTER" })

    const info = autoFrame("Info", "HORIZONTAL", { gap: 6, fixedW: 180 })
    info.appendChild(makeText(t.family, fonts.mono, 14, chrome.sub, { lineHeight: 16 }))
    info.appendChild(makeText("/", fonts.mono, 14, chrome.sub, { lineHeight: 16 }))
    info.appendChild(makeText(WEIGHT_LABEL[t.weight] || String(t.weight), fonts.mono, 14, chrome.text, { lineHeight: 16 }))
    info.appendChild(makeText("/", fonts.mono, 14, chrome.sub, { lineHeight: 16 }))
    info.appendChild(makeText(String(t.size), fonts.mono, 14, chrome.text, { lineHeight: 16 }))
    row.appendChild(info)

    const name = makeText(key, sampleFont, t.size, chrome.text, {
      lineHeight: t.lineHeight ?? undefined,
      width: 304,
    })
    // bind the sample to the real text style so it tracks the style definition
    const textStyle = sindex.textByName.get(`${STYLE_PREFIX}/type/${key}`)
    if (textStyle) {
      try {
        await name.setTextStyleIdAsync(textStyle.id)
      } catch (_) {
        // keep the literal font if the style can't be applied
      }
    }
    row.appendChild(name)

    row.appendChild(
      makeText(t.codeSyntax || "", fonts.regular, 14, chrome.sub, { lineHeight: 20, width: 384 })
    )
    list.appendChild(row)
  }
  return buildPosterShell("Typography", null, chrome, fonts, list)
}

async function shadowPoster(styles: StylesDoc, mode: "Light" | "Dark", fonts: Fonts, sindex: StyleIndex): Promise<FrameNode> {
  const chrome = CHROME[mode]
  const effects = styles.effects[mode] || {}
  const grid = autoFrame("Container", "HORIZONTAL", { gap: 32, counterGap: 40, wrap: true, fixedW: 998 })
  const cardW = (998 - 32) / 2
  for (const key of Object.keys(effects)) {
    const layers = effects[key]
    const card = autoFrame("Shadow card", "VERTICAL", { gap: 18, fixedW: cardW })
    const demo = figma.createFrame()
    demo.name = key
    demo.resize(cardW, 140)
    demo.layoutMode = "HORIZONTAL"
    demo.primaryAxisAlignItems = "CENTER"
    demo.counterAxisAlignItems = "CENTER"
    demo.primaryAxisSizingMode = "FIXED"
    demo.counterAxisSizingMode = "FIXED"
    demo.fills = [paintFrom(chrome.bg)]
    demo.cornerRadius = 16
    demo.strokes = [paintFrom(chrome.swatchBorder)]
    demo.strokeWeight = 1
    demo.clipsContent = false
    // bind to the real effect style; fall back to literal layers if missing
    const effectStyle = sindex.effectByName.get(`${STYLE_PREFIX}/${mode.toLowerCase()}/${key}`)
    if (effectStyle) {
      try {
        await demo.setEffectStyleIdAsync(effectStyle.id)
      } catch (_) {
        demo.effects = layers.map(toEffect)
      }
    } else {
      demo.effects = layers.map(toEffect)
    }
    demo.appendChild(makeText(key, fonts.mono, 14, chrome.sub, { lineHeight: 16 }))
    card.appendChild(demo)
    card.appendChild(makeText(key, fonts.medium, 15, chrome.text, { lineHeight: 20, width: cardW }))
    grid.appendChild(card)
  }
  return buildPosterShell("Shadow", mode === "Dark" ? "(dark)" : null, chrome, fonts, grid)
}

const RADIUS_FIELDS: VariableBindableNodeField[] = [
  "topLeftRadius",
  "topRightRadius",
  "bottomLeftRadius",
  "bottomRightRadius",
]
function radiusPoster(doc: VariablesDoc, fonts: Fonts, vindex: VarIndex): FrameNode {
  const chrome = CHROME.Light
  const grid = autoFrame("Container", "HORIZONTAL", { gap: 29, counterGap: 40, wrap: true, fixedW: 998 })
  const cellW = (998 - 29 * 2) / 3
  const radii: { name: string; value: number }[] = []
  for (const entry of doc) {
    const root = entry[Object.keys(entry)[0]].modes.Light
    const group = root.radius
    if (!group || isLeaf(group)) continue
    walkLeaves(group, ["radius"], (p, l) => {
      const v = Number(l.$value)
      if (!Number.isNaN(v)) radii.push({ name: p.join("/"), value: v })
    })
  }
  for (const r of radii) {
    const cell = autoFrame("Radius cell", "VERTICAL", { gap: 12, fixedW: cellW })
    const demo = figma.createRectangle()
    demo.resize(cellW, 130)
    demo.cornerRadius = r.value
    demo.fills = [paintFrom(chrome.demoFill)]
    demo.strokes = [paintFrom(chrome.swatchBorder)]
    demo.strokeWeight = 1
    // bind the corner radius to the real radius variable
    const variable = vindex.find(r.name)
    if (variable) {
      for (const field of RADIUS_FIELDS) demo.setBoundVariable(field, variable)
    }
    cell.appendChild(demo)
    const label = makeText(`${r.name}  ${r.value}`, fonts.mono, 14, chrome.text, { lineHeight: 16, width: cellW })
    label.setRangeFills(0, r.name.length, [paintFrom(chrome.sub)])
    cell.appendChild(label)
    grid.appendChild(cell)
  }
  const frame = buildPosterShell("Radius", null, chrome, fonts, grid)
  pinModes(frame, vindex, "Light")
  return frame
}

interface PreviewResult {
  count: number
  varSummary: VarSummary
  styleSummary: StyleSummary | null
}
async function runPreview(kind: string, variables: VariablesDoc, styles: StylesDoc | null): Promise<PreviewResult> {
  const fonts = await loadFonts()
  // Superset of Pull: create / update the real variables + styles first, so the
  // poster can bind to them rather than draw dead literals.
  const varSummary = await applyVariables(variables, false)
  const styleSummary = styles ? await applyStyles(styles) : null
  const vindex = await indexVariables()
  const sindex = await indexStyles()

  const posters: FrameNode[] = []
  const want = (k: string) => kind === "all" || kind === k
  if (want("color")) {
    posters.push(colorPoster(variables, "Light", fonts, vindex))
    posters.push(colorPoster(variables, "Dark", fonts, vindex))
  }
  if (want("typography") && styles) posters.push(await typographyPoster(styles, fonts, sindex))
  if (want("shadow") && styles) posters.push(await shadowPoster(styles, "Light", fonts, sindex))
  if (want("radius")) posters.push(radiusPoster(variables, fonts, vindex))

  // lay posters out left-to-right near the viewport center
  const gap = 120
  let x = figma.viewport.center.x - posters.reduce((n, p) => n + p.width, 0) / 2
  const y = figma.viewport.center.y - 400
  for (const p of posters) {
    p.x = x
    p.y = y
    figma.currentPage.appendChild(p)
    x += p.width + gap
  }
  if (posters.length) {
    figma.currentPage.selection = posters
    figma.viewport.scrollAndZoomIntoView(posters)
  }
  return { count: posters.length, varSummary, styleSummary }
}

// --- message loop ------------------------------------------------------------

type PluginMessage =
  | { type: "init" }
  | { type: "save-settings"; settings: Record<string, unknown> }
  | { type: "apply"; variables: VariablesDoc; styles: StylesDoc | null; removeOrphans?: boolean }
  | { type: "serialize" }
  | { type: "preview"; kind: string; variables: VariablesDoc; styles: StylesDoc | null }
  | { type: "notify"; message: string }
  | { type: "open-url"; url: string }

figma.ui.onmessage = async (msg: PluginMessage) => {
  try {
    switch (msg.type) {
      case "init": {
        const settings = (await figma.clientStorage.getAsync("settings")) || {}
        figma.ui.postMessage({ type: "settings", settings })
        break
      }
      case "save-settings": {
        await figma.clientStorage.setAsync("settings", msg.settings)
        figma.ui.postMessage({ type: "saved" })
        break
      }
      case "apply": {
        const varSummary = await applyVariables(msg.variables, !!msg.removeOrphans)
        const styleSummary = msg.styles ? await applyStyles(msg.styles) : null
        figma.ui.postMessage({ type: "apply-result", varSummary, styleSummary })
        break
      }
      case "serialize": {
        const snapshot = await serializeVariables()
        const styles = await serializeStyles()
        figma.ui.postMessage({ type: "serialized", snapshot, styles })
        break
      }
      case "preview": {
        const res = await runPreview(msg.kind, msg.variables, msg.styles)
        figma.ui.postMessage({
          type: "preview-result",
          count: res.count,
          varSummary: res.varSummary,
          styleSummary: res.styleSummary,
        })
        break
      }
      case "notify": {
        figma.notify(msg.message)
        break
      }
      case "open-url": {
        figma.openExternal(msg.url)
        break
      }
      default:
        break
    }
  } catch (e) {
    figma.ui.postMessage({ type: "error", message: (e as Error).message || String(e) })
  }
}
