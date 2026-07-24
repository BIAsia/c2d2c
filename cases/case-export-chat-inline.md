# Case B: chat inline elements, exported wholesale (figma-export in the field)

**Pipeline**: code → Figma (code-to-design) · **Output**: the "inline" page component set (favicon links / mentions / references / inline code, every state)
**Sources**: `materials/memory/chat-inline-elements-figma-export.md` (see also the mention-popover / task-ui / member-drawer exports)

## Storyline

1. **Code census first**: enumerate every shape of every inline element from render source — the favicon fallback chain (favicon → initial letter → globe/mail icon), seven mention kinds, truncation and long-text forms. The `/ds` regression pages served as a ready-made state checklist.
2. **Everything bound to tokens**: colors, radii, and text bound to the three collections token sync had already established (Light/Dark modes), with CSS var names resolved through `$codeSyntax.WEB`. Designers change a token in Figma and these components follow.
3. **Componentization by explicit answer**: asked "components or flat frames?" before drawing; followed the answer.
4. **Post-export self-check**: screenshot review for alignment, raw colors (= lost bindings), clipped text.

## Why it's worth telling

- **The code-to-design value proposition**: design files always lag the code. Instead of hand-tracing the current state, an agent generates design assets with the real state matrix, freeing designers from "catching up on what shipped" to design what's next.
- **State enumeration is one mental model shared by two pipelines**: the checklist enumerated at export time is the same checklist a regression page holds at restore time. The /ds surface is that model made physical.
- **Exports feed quality back into the app**: the member-drawer export aligned the design file on a 40px avatar slot, which exposed a real 32/40 avatar mix-up in production.
- **Gotchas as an asset**: four export jobs banked twelve use_figma pitfalls (currentPage drift, bind-drops-opacity, instance fill snapshots…), all codified into the skill. The fifth export ran like an assembly line.

## Transfer notes

Get token sync running before exporting, or everything lands as literals. Keep the export target file separate from the product design file.
