# Contract: Saved MENACE file (format `menace-drawer`, version 1)

A saved MENACE is a UTF-8 JSON file that the visitor saves to their own device and can load back later. It is the only data that leaves the page's memory, and it never leaves the visitor's device unless they send it on themselves.

- **Filename**: `menace-<rule>-<games>-games-<YYYY-MM-DD>.json`, e.g. `menace-michie1963-1000-games-2026-11-22.json`.
- **Formatting**: two-space indentation, so the file is readable in a text editor.
- **Media type on save**: `application/json`.
- **Structure**: defined by [save-file.schema.json](./save-file.schema.json). The semantic rules below are checked in addition to it.

## Example

```json
{
  "format": "menace-drawer",
  "version": 1,
  "savedAt": "2026-11-22T14:03:11.000Z",
  "beadRule": "michie1963",
  "record": {
    "gamesPlayed": 3,
    "win": 1,
    "draw": 1,
    "loss": 1,
    "outcomes": "LDW"
  },
  "boxes": [
    { "position": ".........", "moveNumber": 1, "discoveryIndex": 1, "beads": [5, 4, 0, 0, 3, 0, 0, 0, 0] },
    { "position": "....O...X", "moveNumber": 3, "discoveryIndex": 2, "beads": [3, 3, 3, 0, 0, 3, 0, 0, 0] }
  ]
}
```

*The bead values are illustrative, but the example is valid.*

- Under `michie1963` the empty board's groups are corner {0,2,6,8}, edge {1,3,5,7} and centre {4}, so only canonical squares 0, 1 and 4 can hold beads.
- `....O...X` is the canonical form of "MENACE in a corner, opponent in the centre" (for example, `X...O....` from the real board). Its groups are {0}, {1,3}, {2,6} and {5,7}, so beads sit on representatives 0, 1, 2 and 5.
- The validator tests should use this example as their valid fixture.

## Fields

| Field | Type | Meaning |
| --- | --- | --- |
| `format` | `"menace-drawer"` | Identifies the file type |
| `version` | `1` | Format version |
| `savedAt` | ISO 8601 UTC string | When the file was saved. Shown in the load confirmation. |
| `beadRule` | `"michie1963" \| "perSquare"` | The drawer's bead rule |
| `record.gamesPlayed` | integer ≥ 0 | Games played |
| `record.win`, `record.draw`, `record.loss` | integers ≥ 0 | MENACE's results |
| `record.outcomes` | string matching `^[WDL]*$` | Outcomes in order, for the learning curve |
| `boxes[]` | array, length ≤ 304 | One entry per discovered box, in any order |
| `boxes[].position` | 9-char string over `X`, `O`, `.` | Canonical position, read row by row. `X` = MENACE, `O` = opponent. |
| `boxes[].moveNumber` | `1 \| 3 \| 5 \| 7` | MENACE's move number at this box |
| `boxes[].discoveryIndex` | integer ≥ 1 | The order in which the box was opened |
| `boxes[].beads` | 9 integers ≥ 0 | Beads per canonical square |

## Semantic rules (in addition to the schema)

A file is accepted only if **all** of these hold. Otherwise it is rejected as a whole and nothing changes (FR-037).

1. **File size**: the text is at most 5 MB (`too-large`).
2. **Record consistency**: `win + draw + loss === gamesPlayed === outcomes.length`, and the counts of `W`, `D` and `L` in `outcomes` equal `win`, `draw` and `loss` (`bad-record`).
3. **Valid positions**: each `position` is in `reachablePositions()` and equals `canonicalize(position).key`. No position appears twice (`bad-position`).
4. **Move numbers**: `moveNumber === (number of X and O in position) + 1` (`bad-move-number`).
5. **Beads**:
   - Integers ≥ 0, and 0 on every occupied square.
   - Under `michie1963`, 0 on every square that is not a group representative.
   - Each value ≤ `START_BEADS[moveNumber] + 3 × gamesPlayed`, a bound no real game history can exceed.

   Any violation is `bad-beads`.
6. **Discovery order**: the `discoveryIndex` values are exactly 1…`boxes.length`, with no gaps or repeats (`bad-discovery`).

## Compatibility

- **Older pages**: files from before this feature don't exist, because the page had no save function.
- **Version mismatch**: a file with `version > 1` is rejected as "saved by a newer version of this page". `version < 1` or a non-integer is `unsupported-version`.
- **Future versions**: they may add optional fields. A version-1 reader rejects only unknown *required* changes. Unknown extra top-level fields are ignored (the schema sets `additionalProperties: true` at the top level and `false` inside `record` and the box entries).

## Privacy

Saving creates a local download, and loading reads a file the visitor picks. The page makes no network request at any point (FR-039).
