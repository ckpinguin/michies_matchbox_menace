# Data Model: MENACE Simulator Quality Improvements

**Feature**: [spec.md](./spec.md) · **Research**: [research.md](./research.md)

Everything lives in memory in one page. The only data that leaves memory is a **Saved MENACE** file, which the visitor writes to their own device (see [contracts/save-file.md](./contracts/save-file.md)).

Engine marks: `"X"` is MENACE, which always moves first, and `"O"` is the opponent. A board is an array of 9 cells (`"X" | "O" | null`), indexed 0–8 row by row. Squares are shown to users numbered 1–9. Display symbols come from `glyph()` (research R4).

---

## Menace

One trained MENACE: its drawer and its record. This is the unit that is saved, loaded, reset, and replaced when the rule changes.

| Field | Type | Rules |
| --- | --- | --- |
| `beadRule` | `"michie1963" \| "perSquare"` | Fixed for the life of this Menace. The default is `"michie1963"` (FR-022). |
| `boxes` | `Map<positionKey, Matchbox>` | Holds only committed boxes. Size ≤ 304. |
| `discoveryCount` | integer ≥ 0 | Equals `boxes.size`, which is also the highest `discoveryIndex`. |
| `record` | `Record` | Changed only by `commit`. |

**Lifecycle** (states of the page's *current* Menace):

```text
            create(rule)                 commit(game)
  (none) ───────────────▶ Fresh ─────────────────────▶ Trained ──┐
                           ▲  ▲                          │  ▲     │ commit(game)
                           │  │ confirmed reset          │  └─────┘
                           │  └──────────────────────────┤
                           │ confirmed rule change       │
                           └─────────────────────────────┤
                                                         │ confirmed load(file)
                    Loaded (= Trained with restored data) ◀┘
```

- **Fresh** means `boxes` is empty and `record.gamesPlayed` is 0. A rule change or a load from Fresh needs no confirmation (research R10).
- **Reset** keeps `beadRule`. A **rule change** creates a Fresh Menace with the other rule. A **load** replaces the whole Menace, including `beadRule`.
- Any of these three transitions first **abandons** the current Game.

## Matchbox

One position MENACE may face on its turn, stored in its standard (canonical) orientation.

| Field | Type | Rules |
| --- | --- | --- |
| `positionKey` | 9-char string over `X`, `O`, `.` | Canonical: the lexicographically smallest key among the 8 symmetries. It must be one of the 304 reachable positions. |
| `canonicalBoard` | board | Equal to `positionKey`, as an array. |
| `moveNumber` | `1 \| 3 \| 5 \| 7` | Equals (number of marks) + 1. Positions with one free square never get a box, because the move is forced. |
| `groups` | `number[][]` | Move groups (research R3). Each group lists equivalent free canonical squares with the representative first. Under `perSquare` every group has one square. Derived from the position and the rule, not stored in saves. |
| `beads` | `number[9]` | Integers ≥ 0. Always 0 on occupied squares. Under `michie1963`, always 0 on non-representatives. |
| `discoveryIndex` | integer 1…304 | Unique within a Menace. Assigned at commit, in discovery order. |

**Derived values**:

- `totalBeads = Σ beads`.
- `isEmpty = totalBeads === 0`. MENACE resigns when it meets an empty box.
- Starting beads per representative: 4 / 3 / 2 / 1 for move 1 / 3 / 5 / 7.

**Provisional box**: a Matchbox created during a Game for a position that has no box yet. It holds starting beads and a *tentative* `discoveryIndex` (`discoveryCount + k`). It joins `Menace.boxes` only at commit (research R1).

## Game (session)

One game between MENACE and an opponent. Its working state is local to the game until it is committed.

| Field | Type | Rules |
| --- | --- | --- |
| `id` | integer | Increases by one per game started. |
| `opponent` | `"human" \| "random" \| "perfect"` | Fixed for the game. |
| `board` | board | Game-local, never shared. |
| `steps` | `TrajectoryStep[]` | One entry per bead draw. Forced moves add none. |
| `provisional` | `Map<positionKey, Matchbox>` | Boxes first met in this game. |
| `signal` | `AbortSignal` | Aborted when the game is abandoned. |
| `status` | see the state diagram below | |
| `outcome` | `"win" \| "draw" \| "loss"` (MENACE's view) | Set when the game finishes. A resignation counts as a loss. |
| `winLine` | `[a, b, c] \| null` | Board squares of the winning line, if any (FR-019). |
| `resignedAt` | `{ positionKey, moveNumber } \| null` | `moveNumber === 1` means the opening box is empty (FR-006). |

**TrajectoryStep**:

```text
{ positionKey, transformIndex, colorIdx, groupSquares, realIdx }
```

- `colorIdx` is the representative's canonical square.
- `groupSquares` are the canonical squares the bead stands for.
- `realIdx = T[colorIdx]` is the square played on the real board.
- `transformIndex` is 0–7 (research R4 table) and drives the orientation notice.

**State transitions**:

```text
             start                       game over (win/draw/loss/resign)
  ────────▶ InProgress ──────────────────────────────────▶ Finished ──▶ commit(menace)
                │
                │ abandon (New game · opponent switch · confirmed reset ·
                │          start training · confirmed rule change · confirmed load)
                ▼
            Abandoned   (no commit: drawer, beads and record untouched; pending
                         human-move promise resolved; pending pauses cancelled)
```

**Invariant**: at most one Game is InProgress per page (FR-001).

**commit(game) → BeadChange[]** is one synchronous step that:

1. Inserts the provisional boxes into `menace.boxes` in discovery order and fixes their `discoveryIndex`.
2. For each step, changes `beads[colorIdx]` by +3 for a win, +1 for a draw, or −1 for a loss, with a floor of 0.
3. Appends the outcome to `record`.

It returns the bead changes so the panel can show the ± badges.

## BeadChange

| Field | Type |
| --- | --- |
| `positionKey` | string |
| `colorIdx` | canonical square |
| `before`, `after` | integers ≥ 0 |

It is shown in the box panel (the ± badges) and is not saved.

## Record

| Field | Type | Rules |
| --- | --- | --- |
| `gamesPlayed` | integer ≥ 0 | Equals `win + draw + loss`, which equals `outcomes.length`. |
| `win`, `draw`, `loss` | integers ≥ 0 | |
| `outcomes` | string over `W`, `D`, `L` | In order. It is the source of the rolling 20-game series. |

**Derived values**:

- `rollingSeries(outcomes, 20)` gives `{ game, win, draw, loss }` per game.
- The table rows group the series in tens, with each row showing the rate as at the last game of its range (FR-020).

## Opponent

| Value | Display name | Behaviour |
| --- | --- | --- |
| `human` | "You" | Waits for a board click or a keyboard choice. The wait is cancellable. |
| `random` | "Random mover" | Uniform over free squares, using the injected `rng`. |
| `perfect` | "Perfect player" | Depth-aware minimax. Only scores are memoised. Picks uniformly among the best replies (research R5). |

The opponent selection is a page setting. It is not part of a Menace and is not saved.

## BeadRule

| Value | Display | Effect on `groups` |
| --- | --- | --- |
| `michie1963` | "Michie 1963" | Free squares that are equivalent under the position's stabiliser share one group (and one bead colour). 56 of the 304 boxes are affected, and the opening box has 3 groups. |
| `perSquare` | "One per square" | Every free square is its own group. This was the page's behaviour before this feature. |

## Saved MENACE (file)

This is the external representation of a Menace. Its format and validation are defined in [contracts/save-file.md](./contracts/save-file.md) and [contracts/save-file.schema.json](./contracts/save-file.schema.json).

**Round-trip rule**: `parseSave(serialize(m))` yields a Menace equal to `m` in `beadRule`, every box (`positionKey`, `moveNumber`, `beads`, `discoveryIndex`) and `record` (SC-009).

## UI-only state (not part of a Menace, not saved)

| Field | Purpose |
| --- | --- |
| `ui.tableOpen` | Whether the learning-curve table stays open across re-renders (FR-020). |
| `ui.drawer` | `{ open, move: "all" \| 1 \| 3 \| 5 \| 7, emptyOnly, sort: "discovery" \| "most" \| "fewest" }` (FR-029, FR-030). |
| `ui.lastGame` | `{ steps, deltas, outcome, winLine, resignedAt }`. Drives the box panel and the "Used last game" marks. Cleared on reset, rule change and load. |
| `ui.training` | `{ running, stopRequested, target, done }`. |
| `ui.focusSquare` | The square currently in the board's tab order (roving tabindex). |
