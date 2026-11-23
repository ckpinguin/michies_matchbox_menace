# Research: Matchboxes a Kid Can Follow

**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Date**: 2026-11-22

The Technical Context had no open NEEDS CLARIFICATION items. The one scope question was settled in the spec's clarification: matchboxes are always shown, alongside today's panel, and the two helps are optional. This document records the design decisions. Each gives the decision, the reason, and the alternatives rejected.

The decisions build on feature 001 ([plan](../001-simulator-quality-improvements/plan.md), [research](../001-simulator-quality-improvements/research.md)). Its engine, game controller, tests and constitution v1.1.0 are the starting point.

---

## K1. Pausing a move for the step-by-step help, without touching the engine

**Finding**: the engine already gives the UI full control of timing. `playGame` calls the UI's `pause("menace-move", signal)` after MENACE's move and waits for it. The UI's `onEvent({type: "menace", choice})` arrives just before that pause, and `choice` already holds everything the steps need:

- the box and its `positionKey`
- `transformIndex`, `colorIdx`, `groupSquares` and `realIdx`
- whether the box is new (`provisional`)

**Decision**:

- **Step sequence.** With the step-by-step help on, the UI's `pause` for `"menace-move"` returns a promise that settles only when the five steps have finished. Steps run one at a time (Next) or automatically, at least 2 s each. The promise also settles at once if the game's signal aborts, which is the same abandonment contract as feature 001 (FR-011).
- **Board reveal.** The UI holds back drawing MENACE's new mark until step 5, by rendering the board with that one square still empty. This is purely presentational, because the engine's board already contains the mark.
- **Engine.** `playGame`, `chooseMove` and `commit` do not change. FR-021 then holds by construction.

**Alternatives considered**:

- **Split `chooseMove` into "pick box" and "draw bead" calls driven by the UI.** Rejected. It changes the engine contract and its tests for a presentation feature.
- **Replay the steps after the move has already been drawn on the board.** Rejected. Step 5 would then show a mark that was already there, which defeats the point.

## K2. Keeping outcomes identical with the help on or off (FR-021, SC-008)

**Finding**: the page passes `Math.random` to the engine as `rng`. If any animation also called `Math.random` (for example to jiggle beads while shaking), the help would consume random numbers and change MENACE's later choices.

**Decision**:

- **No randomness in animations.** Animations and layouts never call `Math.random`. Shaking, rolling and bead placement are fixed patterns, computed from the box and the bead counts only.
- **Training.** Training skips all step and bead animations (FR-012). It renders the final state once, as feature 001 does.
- **Browser check.** A check seeds `Math.random`, plays the same games with the help on and off, and compares the record and every box's beads.

**Alternative considered**: a separate seeded generator for animations. Rejected as unnecessary, because fixed patterns read better for children anyway.

## K3. The matchbox picture (FR-001, FR-002)

**Decision**: one picture component, drawn by the page as inline SVG, used in three places:

- the box panel (next to each box's existing detail, per clarification C)
- the step-by-step area
- the before-and-after comparison

What the picture shows:

- **The box.** A matchbox seen from slightly above, with the drawer (tray) slid out. Its face (the sleeve) shows a drawing of the box's position in the board's symbols, ◯ and ✕. Michie 1963: each box's "face … bears a drawing of the position".
- **Colour key on the face.** Each free square of the face drawing carries a small dot in its bead colour with the bead's mark (K4). The face then doubles as the colour key for that box. Under Michie's 1963 rule, every member of a group shows the representative's colour.
- **The tray.** Loose beads, grouped by colour, as in a real box. There are no compartments: Michie's boxes had none.
  - A colour with 12 or fewer beads is drawn as that many individual beads, in a compact cluster.
  - A colour with more than 12 beads is drawn as a heap, with "× n" written next to it.
  - Groups are ordered by box square. The tray grows in height when needed, rather than shrinking the beads.
- **Empty box.** The tray is drawn empty, with the caption from the copy deck (K8).
- **Text equivalent.** The picture has `role="img"` and a label giving the same facts in words, for example "Matchbox 3: board with ◯ in the centre and ✕ in the top-left corner. Beads: 4 blue star, 4 teal heart, 3 yellow triangle…". The panel's existing ledger is kept as it is.

**Sizing**: the picture is about 200 × 150 CSS px, and scales down to fit 288 px of content width at a 320 px screen. Beads are 10 px across, the minimum that still shows a mark clearly. A heap counts as one cluster.

**Alternatives considered**:

- **Arrange the tray as a 3×3 map of the board.** Rejected. It misrepresents the real box, and the face drawing already provides the key.
- **Photographs or bitmap illustrations.** Rejected. Constitution I allows no external resources, and inline bitmaps would be large and wouldn't recolour for dark mode.

## K4. A second mark that isn't the colour (FR-003, SC-003)

**Finding**: a number can't be the second mark. A bead's colour belongs to a *box* square, while the square MENACE plays is a *board* square. When the box is shown turned (feature 001 R4), "box square 3" may be board square 9, and putting numbers on beads would revive the confusion feature 001 removed.

**Decision**: each of the 9 bead colours gets a fixed shape, drawn in that colour's ink token (`--cat-N-ink`, already AA on its bead). The shapes avoid ◯ and ✕, which mean MENACE and the opponent.

| Colour token | Name in simple words | Shape |
| --- | --- | --- |
| `--cat-1` | blue | star |
| `--cat-2` | teal | heart |
| `--cat-3` | yellow | triangle |
| `--cat-4` | green | square |
| `--cat-5` | brown | diamond |
| `--cat-6` | purple | moon |
| `--cat-7` | red | plus |
| `--cat-8` | pink | flower |
| `--cat-9` | orange | arrow |

At step 4, and whenever a bead is drawn (FR-004), the real board square `realIdx` shows a marker with the bead's colour and shape until MENACE's ◯ is placed. Under Michie's 1963 rule, every square in `T[groupSquares]` shows it (K7).

**Alternatives considered**:

- **Letters A–I.** Children would read them as words or grades, and they mean nothing in the history.
- **Shapes only, with no colours.** Rejected. Beads are coloured, and the colours are part of the history.

## K5. Turning the box picture to match the board (FR-009)

**Finding**: for each transform `t`, a 2D matrix maps the box picture onto the real board, so that box square `i` lands on real square `TRANSFORMS[t][i]` (screen coordinates, y pointing down, centre at the origin, CSS `matrix(a, b, c, d, 0, 0)`):

| t | name (feature 001) | matrix (a, b, c, d) | meaning |
| --- | --- | --- | --- |
| 0 | same orientation | (1, 0, 0, 1) | none |
| 1 | rotated 90° clockwise | (0, −1, 1, 0) | turn back 90° anticlockwise |
| 2 | rotated 180° | (−1, 0, 0, −1) | turn half way round |
| 3 | rotated 90° anticlockwise | (0, 1, −1, 0) | turn back 90° clockwise |
| 4 | mirrored left–right | (−1, 0, 0, 1) | flip left–right |
| 5 | mirrored top–bottom | (1, 0, 0, −1) | flip top–bottom |
| 6 | mirrored along ↘ | (0, 1, 1, 0) | flip along ↘ |
| 7 | mirrored along ↙ | (0, −1, −1, 0) | flip along ↙ |

The table was checked against the engine's `TRANSFORMS` for all 72 square and transform pairs during planning (2026-11-22). A unit test will assert the same: every matrix maps the centre of every box square `i` onto the centre of `TRANSFORMS[t][i]`.

**Decision**:

- **Engine data.** Add the table to the engine as `PICTURE_MATRICES` (pure data, tested).
- **Animation.** The step area animates the face drawing from the identity to the matrix (about 1.2 s), then keeps it in place. "Replay" runs it again.
- **Reduced motion.** The picture jumps straight to the turned state, and the caption says what happened.
- **Shared-colour boxes.** The drawn bead's group squares are highlighted after the turn (K7).

**Alternative considered**: animating the board instead of the box. Rejected. The board must stay where the child is playing.

## K6. Where the helps and the step area live (FR-005–FR-007; 320 px)

**Decision**:

- **Controls.** A new "Helps" group in the controls card with two independent switches: **Step by step** and **Simple words**. Each is a button with `aria-pressed`, styled like the existing segmented buttons.
  - With **Step by step** on, a pacing choice appears: **One step at a time** / **Play by itself**.
  - The settings live in `ui.help` in memory only (Constitution II: nothing stored). They reset on reload (spec Assumptions).
- **Step area.** A new region inside the board card, below the status line, shown only while steps or bead movements run. It holds:
  - the current matchbox picture, so the board and box are visible together on a phone, where the box panel sits far below
  - a step indicator ("Step 3 of 5")
  - the caption
  - **Next**, or **Pause** / **Play**, depending on the pacing choice
  - **Replay turn** for turned boxes
- **Focus.** Keyboard focus moves to **Next** only when the visitor started the step with Next. Otherwise it stays on the board, so the feature 001 keyboard contract holds.
- **Captions.** Each step's caption is announced once through the page's existing live-region discipline (`setStatus`/`announce`). Captions are meaningful events (Constitution IV), so they are announced.
- **Visitor's own turn.** No step area is shown. With simple words on, the status line gives the kid-friendly "Your turn" text.

**Alternatives considered**:

- **A modal overlay for the steps.** Rejected. It hides the board and blocks the page.
- **Running the steps only in the box panel.** Rejected. On phones the panel is far below the board.

## K7. Shared colours under Michie's 1963 rule (FR-010)

**Decision**:

- **Board markers.** At step 4 the board shows the bead marker on every square in `T[g]` for `g` in `groupSquares`, all in the same colour and shape.
- **Caption** (copy deck): "These squares are really the same move. MENACE puts its ◯ on this one." At step 5 the marker stays only on `realIdx`, and the others fade.
- **Accuracy.** This matches feature 001 R3: the engine plays the representative, mapped to the real board.

## K8. Simple words: a testable copy deck (FR-013–FR-015, SC-006)

**Finding**: SC-006 is checked against every sentence shown in simple-words mode. If those sentences were scattered string literals in the UI code, they couldn't be checked automatically.

**Decision**:

- **Copy block.** All simple-words text lives in one inline `<script type="application/json" id="menace-copy">` block in `index.html`. It is data, not code: it works from `file://` (Constitution I), and the UI reads it with `JSON.parse`. It holds:
  - the step captions
  - the learning captions
  - the status messages in their simple form
  - the tips
  - the picture-story panels
  - the colour and shape names
- **Placeholders.** Entries use `{colour}`, `{shape}`, `{n}`, `{box}` and `{board}`. The contract ([copy-deck.md](./contracts/copy-deck.md)) defines what each one expands to and counts each as one word.
- **Tests.** A Node test (`tests/engine/copy.test.mjs`) loads the block the way `load-engine.mjs` loads the engine. It checks:
  - every sentence, with placeholders expanded, is at most 15 words
  - no term from the word list appears unless the same entry contains its one-sentence explanation (`explains` field)
  - the story has 6 or fewer panels, each with 2 or fewer sentences and a picture id
  - every tip event in FR-014 has a tip
- **Word list**: `reinforcement`, `reinforce`, `symmetry`, `symmetric`, `canonical`, `orientation`, `transform`, `rolling`, `rate`, `resign`, `resigns`, `resigned`, `stabiliser`, `algorithm`, `probability`, `representative`.
- **Mode switch.** With simple words off, the page shows feature 001's text, unchanged.

**Alternatives considered**:

- **A separate `.json` file.** Rejected. It can't be fetched from `file://` (Constitution I).
- **Checking reading level with an external readability library.** Rejected. It adds a dependency, and the two concrete rules in FR-013 are what the spec requires.

## K9. Tips and the picture story (FR-014, FR-015)

**Decision**:

- **Tips.**
  - A tip is a small callout above the step area or the status line. It is not modal; it is a region with a heading and a **Got it** button.
  - It appears the first time, on this visit, that its event happens, and only while simple words is on. Its text is also announced once.
  - Shown tips are remembered in memory (`ui.tipsShown`), not in storage.
  - Events: `new-box`, `first-win`, `first-draw`, `first-loss`, `turned-box`, `empty-box`.
  - The events are detected from engine events the UI already receives:
    - `choice.provisional` means a new box
    - `choice.transformIndex ≠ 0` means a turned box
    - `game.outcome` gives the first win, draw or loss
    - `resignedAt` means an empty box
- **Picture story.** A collapsible section titled "How MENACE learns: the picture story", placed before "How MENACE works". It is always available. It has 6 panels, each an inline SVG scene reusing the matchbox and bead components, plus up to 2 sentences from the copy deck:
  1. a drawer of matchboxes
  2. find the box that matches the board
  3. shake and tilt; the first bead to roll to the front
  4. its colour and shape show the square
  5. win: 3 more beads of that colour; draw: 1 more
  6. lose: that bead is taken out
- **Accessibility.** Each panel's picture has a text equivalent. The section uses the same disclosure pattern as the drawer view.

## K10. Beads going in and out (FR-008)

**Decision**: with step by step on, the `end` event starts a learning sequence. For each box used, in the order played:

- **Win**: three beads of the drawn colour drop into the tray.
- **Draw**: one bead drops in.
- **Loss**: the drawn bead lifts out and goes to a small "put aside" spot beside the box.

How it runs:

- **Data.** It uses the `deltas` from `commit` (feature 001), so the counts shown always match the box (SC-004).
- **Timing.** About 1 s per box. With **One step at a time**, it waits for **Next**.
- **Interruption.** The sequence never blocks the game controller. A new game, reset or other interruption cancels it at once, and the boxes show their committed counts.
- **Caption.** The copy deck's one- or two-sentence caption for win, draw or loss.

## K11. Before and after a training run (FR-016)

**Decision**:

- **Snapshot.** When a training run starts, the UI records a snapshot: a copy of every existing box's beads, plus the game count. It is held in memory and replaced by the next run.
- **Panel.** After the run, a "What changed?" panel offers a box picker, with the opening box first and then the boxes in discovery order. It shows the box *before* and *after* as two matchbox pictures.
- **Summary sentence.** A pure engine helper, `beadChanges(beforeBeads, afterBeads, groups)`, returns the representative square with the largest gain and the one with the largest loss (ties go to the lower square). The UI turns it into one sentence from the copy deck, for example "MENACE now likes the yellow triangle move much more."
- **New boxes.** A box first opened during the run shows its starting beads as "before" and says so.

**Alternative considered**: an animated time-lapse over the whole run. Rejected. It is costly to record, and a side-by-side comparison answers the question directly.

## K12. Testing

**Decision**: extend feature 001's harness. No new tools or dependencies.

| Layer | New tests |
| --- | --- |
| Engine (`node --test`) | `kid.test.mjs`: `PICTURE_MATRICES` map every box square onto `T[i]`; `beadLayout` (individual beads up to 12, heap above, totals preserved); `beadChanges` picks the largest gain and loss with ties broken. `copy.test.mjs`: the reading-level rules, the word list, story limits and tip coverage (K8). |
| Browser (`check.mjs`) | `matchbox-counts`: every matchbox in the panel shows exactly the box's beads, before and after games (SC-004). `steps-order`: the five steps appear in order in manual mode, and MENACE's ◯ appears only at step 5. `steps-auto`: each step is shown at least 2 s. `steps-interrupt`: New game during step 3 cancels the steps, and nothing is recorded. `learning-beads`: the bead changes match the deltas. `turned-box`: the face matrix ends at `PICTURE_MATRICES[t]`. `tips-once`: each tip shows once. `help-identical`: a seeded run with the help on gives the same record and beads as with it off (SC-008). `help-perf`: training with the help on is at most 10% slower (SC-005). `reduced-motion`: no running animations. The contrast, keyboard and 320 px checks are re-run with both helps on. |
| Manual | SC-001–SC-003 with at least 5 children (quickstart §4), and a screen-reader pass of one game with both helps on. |

## K13. Historical statements used by the help (FR-020)

Every factual statement in the copy deck is checked against the sources in feature 001 R14:

| Statement in the help | Source |
| --- | --- |
| Each matchbox has a drawing of its board on the front. | Michie 1963 ("the face of which bears a drawing of the position") |
| Shake the box, then tilt it; the first bead to roll to the front is the one used. | Michie 1963 ("shake it and tilt it forwards. The beads … run to the front, where a V-shaped partition selects the first to arrive") |
| Each colour stands for a square MENACE could play. | Michie 1963 ("The different colours correspond to the different unoccupied squares") |
| Win: 3 more beads. Draw: 1 more. Loss: the bead is taken away. | Michie 1963 (Table 2 text: "three extra beads"; draw "unit bonus"; defeat: "confiscation of the selected bead") |
| A box with no beads left means MENACE gives up. | M. Scroggs, MENACE blog ("If one of these boxes is to be used, then MENACE resigns.") |
| Boxes for the first move start with 4 beads of each colour, then 3, 2, 1. | Michie 1963 (Table 2) |

The colour and shape names, and the moon, star and other marks, belong to this page, not to history. Michie's own colour names (white, lilac, gold …) are not used, and the help never presents its colours as his.
