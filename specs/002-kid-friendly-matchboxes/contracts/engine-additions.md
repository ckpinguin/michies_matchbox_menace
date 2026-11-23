# Contract: engine additions (`MenaceEngine`)

These are additions to the engine in `<script id="menace-engine">` (feature 001's [engine API](../../001-simulator-quality-improvements/contracts/engine-api.md)). The engine rules still apply: no DOM, no timers, no `Math.random` and no `Date`. Every function is pure and never throws on normal input. Nothing existing changes.

## Constants

| Name | Value / shape |
| --- | --- |
| `PICTURE_MATRICES` | 8 arrays `[a, b, c, d]`, one per transform. CSS `matrix(a, b, c, d, 0, 0)` applied to the box picture (centre at the origin, y pointing down) moves box square `i` onto real square `TRANSFORMS[t][i]`. Values: [research K5](../research.md#k5-turning-the-box-picture-to-match-the-board-fr-009). |
| `BEAD_MARKS` | 9 frozen entries `{ colorIdx, colourName, shape }`, in the order of [research K4](../research.md#k4-a-second-mark-that-isnt-the-colour-fr-003-sc-003). |
| `BEAD_DISPLAY_LIMIT` | `12` |

## Functions

```text
beadLayout(beads, groups, limit = BEAD_DISPLAY_LIMIT) → TrayGroup[]
beadChanges(beforeBeads, afterBeads, groups) → { gained: {colorIdx, by} | null, lost: {colorIdx, by} | null }
```

### `beadLayout`

- Returns one `TrayGroup` per group whose representative has more than 0 beads, ordered by representative (see [data-model.md](../data-model.md)).
- `display` is `"beads"` when `count ≤ limit`, otherwise `"heap"`.
- **Guarantee**: the sum of `count` equals the sum of `beads` over the representatives. Non-representatives always hold 0 (feature 001).

### `beadChanges`

- Compares the representatives' beads.
- `gained` is the representative with the largest positive change. `lost` is the one with the largest negative change.
- Ties go to the lower `colorIdx`. Either is `null` when no representative changed in that direction.

## Tests (`tests/engine/kid.test.mjs`)

1. For every `t` and every `i`, `PICTURE_MATRICES[t]` maps the centre of box square `i` onto the centre of `TRANSFORMS[t][i]`.
2. `BEAD_MARKS` has 9 entries, with unique colour names and unique shapes, and no shape named like ◯ or ✕.
3. For random boxes under both bead rules, `beadLayout`:
   - preserves the total
   - switches to a heap at exactly `limit + 1`
   - lists only representatives with beads
4. `beadChanges` handles a gain only, a loss only, both, neither, and ties.
