# Case A: ⌘K global search rebuild (figma-restore in the field)

**Pipeline**: Figma design → code restore · **Scale**: 4 rounds of iteration (Round 1 → 4d), 6 MRs all merged to main
**Sources**: `materials/memory/global-search-figma-reskin.md`, `global-search-virtual-focus.md`

## Storyline

1. **Round 1** (structure): rebuild the dialog structure to Figma 3311-7203; one MR merged.
2. **Rounds 3 + 3b/3c** (detail and full stack): the Search-more link, the ↩ chip, footer rework; the Connector group queries PII, which pushed a "self-only results" constraint into the backend; the double-layer panel (frosted outer frame + white card) became two nested components.
3. **Rounds 4 + 4b/c/d** (motion polish): row-height jump fixes, mirrored enter/exit scaling, spring height transitions, a shared-layoutId sliding highlight, a "Searching" loading row. Every round ran the same acceptance loop: user reviews screenshots/live build → requests changes → back to the build step.
4. In parallel, one **interaction rewrite** (virtual focus: caret stays in the input, arrow keys move the highlight) shipped as its own MR.

## Why it's worth telling

- **Restore is not a one-shot**: the real rhythm is structure → detail → motion in layered rounds, each closing its own build-accept-merge loop while main stays shippable.
- **Designs push constraints into the backend** (the PII grouping): this pipeline is not a frontend-only affair.
- **Gotchas compound**: the pitfalls banked in this one case (temporary height:auto for measurement, isolate on the list not the item, Tailwind font-size groups overriding each other, worktree port coexistence) went straight into the skill and never got re-tripped.

## Transfer notes

The multi-round acceptance loop IS figma-restore step 7 working as designed. "Acceptance sends you back to step 4" is the mechanism, not a failure.
