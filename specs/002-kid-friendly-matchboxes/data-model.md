# Data Model: Matchboxes a Kid Can Follow

**Feature**: [spec.md](./spec.md) · **Research**: [research.md](./research.md)

This feature adds presentation data only. Feature 001's entities are unchanged:

- Menace, Matchbox, Game, BeadChange and Record ([feature 001 data model](../001-simulator-quality-improvements/data-model.md))
- the save format

Nothing here is saved or stored (Constitution II). Square numbering, marks and `TRANSFORMS` are as in feature 001.

---

## BeadMark

The fixed second mark for each bead colour (FR-003; research K4). Constant data in the engine (`BEAD_MARKS`).

| Field | Type | Rules |
| --- | --- | --- |
| `colorIdx` | integer 0–8 | The box square whose colour this is (`--cat-(colorIdx+1)`). |
| `colourName` | string | The simple-words name: blue, teal, yellow, green, brown, purple, red, pink, orange. Unique across the 9 colours. |
| `shape` | `"star" \| "heart" \| "triangle" \| "square" \| "diamond" \| "moon" \| "plus" \| "flower" \| "arrow"` | Unique across the 9. Never ◯ or ✕. |

## MatchboxPicture

How one Matchbox is drawn (FR-001, FR-002; research K3). It is derived from a Matchbox at render time and never stored.

| Field | Type | Rules |
| --- | --- | --- |
| `positionKey` | string | The Matchbox it shows. |
| `face` | 9 cells | Each cell is ◯, ✕, or a free square. A free square shows the dot (colour and shape) of its group's representative. |
| `tray` | `TrayGroup[]` | One entry per group whose representative holds ≥ 1 bead, ordered by representative. Comes from `beadLayout`. |
| `drawn` | `colorIdx \| null` | The bead shown leaving the box, if any. |
| `label` | string | Text equivalent: the box number, the face in words, and each group's colour, shape and count. |

**TrayGroup** (from `beadLayout(beads, groups, limit = 12)`):

| Field | Type | Rules |
| --- | --- | --- |
| `colorIdx` | integer | The group's representative. |
| `count` | integer ≥ 1 | Equals `beads[colorIdx]`. |
| `display` | `"beads" \| "heap"` | `"beads"` when `count ≤ 12`, otherwise `"heap"`. |
| `shown` | integer | `count` when `display` is `"beads"`; 1 (the heap) when it is `"heap"`. |

**Invariant (SC-004)**: the sum of `count` over the tray equals the sum of the box's beads.

## MoveStep

One step of a MENACE move in the step-by-step help (FR-006; research K1).

| Field | Type | Rules |
| --- | --- | --- |
| `id` | `"find" \| "shake" \| "tilt" \| "lookup" \| "play"` | Always in this order. |
| `index` | 1–5 | Shown as "Step n of 5". |
| `caption` | string | From the copy deck: simple words when that help is on, otherwise the standard words. Placeholders are filled from the move. |
| `highlight` | `"board" \| "box" \| "bead" \| "squares" \| "square"` | What is emphasised: `squares` means all group squares (K7); `square` means `realIdx`. |
| `variant` | `"new-box" \| "turned" \| "shared" \| null` | Changes the caption or the extra animation. |

**Special cases**:

- A forced move (one free square) gets no steps, only one caption.
- A resignation shows `find` and then an empty-box caption.

**Sequence state**: `idle → running(step k) → done`, or `→ cancelled` when the game's signal aborts (FR-011). `running` advances on **Next** (`pacing = "manual"`) or after at least 2 s (`pacing = "auto"`, unless paused).

## LearningStep

The end-of-game bead change shown for one box (FR-008; research K10).

| Field | Type | Rules |
| --- | --- | --- |
| `positionKey` | string | A box used in the game. |
| `result` | `"win" \| "draw" \| "loss"` | The game's `outcome`. |
| `colorIdx` | integer | The bead drawn from this box. |
| `before`, `after` | integers ≥ 0 | Taken from the game's `BeadChange` (feature 001). |
| `caption` | string | From the copy deck, by result. |

**Rule**: `after − before` is +3, +1 or −1 (floor 0), exactly as committed. The animation shows that many beads moving.

## Tip

A first-time explanation (FR-014; research K9).

| Field | Type | Rules |
| --- | --- | --- |
| `event` | `"new-box" \| "first-win" \| "first-draw" \| "first-loss" \| "turned-box" \| "empty-box"` | One tip per event. |
| `title`, `text` | strings | From the copy deck. Text is at most 2 sentences. |
| `shown` | boolean | Kept in memory (`ui.tipsShown`). Once true, never shown again this visit. |

Tips appear only while the simple-words help is on.

## PictureStory

The "How MENACE learns" story (FR-015).

| Field | Type | Rules |
| --- | --- | --- |
| `panels` | `StoryPanel[]` | 1–6 panels, in order. |

**StoryPanel**: `picture` (a scene id drawn by the page), `sentences` (1–2 strings from the copy deck) and `alt` (text equivalent).

## HelpSettings (`ui.help`)

| Field | Type | Default | Rules |
| --- | --- | --- | --- |
| `stepByStep` | boolean | `false` | Turns on steps and bead movements. |
| `pacing` | `"manual" \| "auto"` | `"auto"` | Only applies while `stepByStep` is on. |
| `simpleWords` | boolean | `false` | Turns on the simple-words copy, tips and story wording. |

The settings live in memory and reset on reload. They are not part of a Menace and are not saved.

## TrainingSnapshot (`ui.snapshot`)

What a box looked like before a training run (FR-016; research K11).

| Field | Type | Rules |
| --- | --- | --- |
| `gamesBefore` | integer | `record.gamesPlayed` when the run started. |
| `beads` | `Map<positionKey, number[9]>` | Copies of every existing box's beads at the start. |
| `newBoxes` | `Set<positionKey>` | Filled at the end: boxes opened during the run. Their "before" is their starting beads. |

There is one snapshot at a time; each run replaces it. It is cleared on reset, rule change and load.

**BeadChangeSummary** (from `beadChanges(before, after, groups)`): `{ gained: { colorIdx, by } | null, lost: { colorIdx, by } | null }`. These are the largest gain and the largest loss among representatives; ties go to the lower `colorIdx`, and `null` when nothing went up or nothing went down.
