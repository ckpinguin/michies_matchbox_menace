# Contract: `MenaceEngine` (pure game logic)

The engine lives in `<script id="menace-engine">` in [index.html](../../../index.html). It defines one global, `MenaceEngine`, which the page's UI script uses and the Node tests load through `node:vm` ([research R13](../research.md#r13-testing-without-dependencies)).

**Rules for engine code**:

- No DOM access, timers, `Math.random` or `Date` inside the engine. Randomness comes in through `rng` (a function returning a float in [0, 1)) and time through `now`.
- Every function is deterministic for a given `rng` sequence.
- It must not throw on any input that can happen in normal use. `parseSave` returns errors rather than throwing them.

## Constants

| Name | Value / shape |
| --- | --- |
| `TOTAL_BOXES` | `304` |
| `BEAD_RULES` | `["michie1963", "perSquare"]` |
| `DEFAULT_BEAD_RULE` | `"michie1963"` |
| `START_BEADS` | `{ 1: 4, 3: 3, 5: 2, 7: 1 }` |
| `REINFORCE` | `{ win: +3, draw: +1, loss: -1 }` (floor at 0) |
| `TRANSFORMS` | 8 index maps, where `out[i] = in[T[i]]`; index 0 is the identity |
| `TRANSFORM_NAMES` | 8 strings, matching the [research R4 table](../research.md#r4-box-panel-orientation-and-symbols-fr-007fr-009-us2) |
| `SAVE_FORMAT` | `"menace-drawer"` |
| `SAVE_VERSION` | `1` |
| `MAX_SAVE_BYTES` | `5 * 1024 * 1024` *(added in implementation)* |

## Board helpers

```text
checkWinner(board) → { winner: "X" | "O" | "draw" | null, line: [a,b,c] | null }
canonicalize(board) → { key, transformIndex, T, board }
moveGroups(canonicalBoard, beadRule) → number[][]
reachablePositions() → ReadonlySet<positionKey>
```

- `canonicalize` picks the lexicographically smallest key and, on a tie, the lowest transform index.
- `moveGroups` puts the representative first in each group and sorts groups by their representative.
- `reachablePositions` returns the 304 keys. It is computed once and cached.
- Also exported, for the UI and tests: `LINES`, `applyTransform(board, T)`, `boardKey(board)` and `keyToBoard(key)`.

## Menace

```text
createMenace({ beadRule = DEFAULT_BEAD_RULE }) → Menace
newGame({ opponent, signal }) → Game          // added in implementation: a fresh InProgress game
startingBeads(positionKey, moveNumber, beadRule) → number[9]
drawBead(counts, rng) → square | null
chooseMove(menace, game, rng) → MoveChoice
commit(menace, game) → BeadChange[]
```

- `chooseMove` reads committed boxes from `menace.boxes`. When none exists it creates a provisional box in `game.provisional`. It never mutates `menace`.
- `commit` is the only function that mutates `menace`, and it fails (throws) unless `game.status === "finished"`.

`MoveChoice` takes one of three forms:

```text
| { kind: "forced",   realIdx }                                  // one free square left; no bead drawn
| { kind: "resigned", positionKey, moveNumber, box }             // box has 0 beads
| { kind: "bead",     positionKey, transformIndex, colorIdx, groupSquares, realIdx, box, provisional: boolean }
```

## Opponents

```text
randomMove(board, rng) → square
perfectMove(board, rng) → square
```

`perfectMove` plays for whichever side is to move (the side with fewer marks). It uses depth-aware scores and a memo holding scores only. It chooses uniformly among the best replies, takes an immediate win when one exists, and prefers the faster of two wins.

## Playing a game

```text
playGame({ menace, opponent, opponentKind, rng, signal, pause, onEvent }) → Promise<GameResult>
```

| Param | Contract |
| --- | --- |
| `opponentKind` | *(added in implementation)* `"human" \| "random" \| "perfect"`, recorded as `game.opponent`. Optional. |
| `opponent(board, signal)` | `→ Promise<square \| null>`. It resolves to `null` if the signal aborts, which is how a pending human move is cancelled. |
| `pause(kind, signal)` | `→ Promise<void>`. The UI passes animated delays that resolve as soon as the signal aborts. Tests and training pass `() => Promise.resolve()`. `kind` is one of `"menace-move"` or `"opponent-move"`. |
| `onEvent(event)` | A synchronous callback used for rendering. Events: `{type: "start", game}`, `{type: "menace", choice, board}` (also sent for a `resigned` choice), `{type: "opponent", square, board}`, `{type: "end", game, deltas}`. `end` is sent after `commit`. |
| `signal` | An `AbortSignal`. It is checked after every `await`. |

`GameResult` takes one of two forms:

```text
| { status: "finished", game, deltas: BeadChange[] }   // commit(menace, game) already applied
| { status: "abandoned", game }                        // menace untouched
```

**Guarantees** (tested in `tests/engine/session.test.mjs`):

1. An abandoned game never changes `menace`: no boxes, beads or record entries.
2. A finished game changes `menace` exactly once, through `commit`.
3. Aborting while `opponent` or `pause` is pending settles the returned promise within one microtask turn after the pending promise resolves.

## Record helpers

```text
rollingSeries(outcomes, window = 20) → { game, win, draw, loss }[]
extendRollingSeries(series, outcomes, window = 20) → series          // appends the points for new games, in place (added in Convergence, T078)
tableRows(series, bucket = 10, fromRow = 0) → { from, to, win, draw, loss }[]   // as at the last game in each range; fromRow skips rows already shown
```

## Persistence

```text
serialize(menace, { now }) → string                                     // pretty-printed JSON, see save-file.md; `now` is an ISO 8601 string
parseSave(text) → { ok: true, menace, savedAt } | { ok: false, code, message }
rejectionMessage(code) → string                                         // the plain message for a code (used for files rejected before reading)
```

`message` is plain language for visitors. `code` is one of:

| `code` | Meaning |
| --- | --- |
| `too-large` | Text over 5 MB |
| `not-json` | The text is not valid JSON |
| `not-menace` | `format` is missing or wrong |
| `unsupported-version` | `version` is not 1. The message tells newer and older files apart. |
| `bad-structure` | A field is missing or has the wrong type or value (schema-level) |
| `bad-record` | The win/draw/loss totals, `gamesPlayed` and `outcomes` disagree |
| `bad-position` | The position is not canonical, not reachable, or duplicated |
| `bad-move-number` | `moveNumber` doesn't match the number of pieces |
| `bad-beads` | Beads that are negative, non-integer, on an occupied square, on a non-representative under `michie1963`, or above the bound |
| `bad-discovery` | Discovery indexes are not unique or not 1…n |
