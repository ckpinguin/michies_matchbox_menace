# Research: MENACE Simulator Quality Improvements

**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Date**: 2026-11-22

The Technical Context had no open NEEDS CLARIFICATION items. The two scope questions were settled during `/speckit-specify` (see the spec's Clarifications section). This document records the design decisions the spec needs. For each one it gives the decision, the reason, and the alternatives that were rejected.

Evidence was gathered on the current [index.html](../../index.html) with Node 26 and headless Chrome. The counting and contrast scripts are summarised inline.

---

## R1. One game at a time and clean abandonment (FR-001–FR-004, US1)

**Root cause**: `playGame()` writes straight into the shared `state.board`, `state.trajectory` and `state.tally`, and it suspends on `await delay(...)` and on the opponent's move. `startNewGame()`, opponent switching and reset start a second `playGame()` without stopping the first. When the first one resumes, it writes into the new game's board and then records its own result. This was reproduced in headless Chrome:

- "New game" pressed mid-game → 2 games recorded.
- "Reset" pressed mid-game → 2 games recorded after the reset.

**Decision**:

1. **Game-local working state.** Each game gets its own object holding its board, its trajectory and any boxes it discovers. Nothing shared is written until the game ends.
2. **One atomic commit.** When a game finishes, a single synchronous `commit` step does three things: inserts newly discovered boxes into the drawer, applies the bead changes, and appends the outcome to the record. An abandoned game never reaches `commit`, so FR-002 holds by construction.
3. **Abandonment uses `AbortController`.** The controller holds exactly one `currentGame`. Starting any of the six actions in FR-001 calls `abandonCurrentGame()`, which aborts that game's signal.
   - Every pause in the game (`pause(ms, signal)`) and the human-move promise resolve as soon as the signal aborts.
   - The game loop checks `signal.aborted` after every `await` and returns `{ status: "abandoned" }`.
   - Aborting also resolves the pending human promise, so no promise is left hanging (today an abandoned human game leaks one).
4. **Provisional boxes.** A box first met during a game is created *provisionally*: its starting beads come from the bead rule, but it is not yet in the drawer. It joins the drawer, with its discovery number, only at commit. An abandoned game therefore leaves the drawer and the "Boxes discovered" count untouched. During the game the panel can show its *tentative* number (current count + k). With only one game at a time, that number is the one it will get.

**Alternatives considered**:

- **Disable all controls while an animated game runs.** Rejected. "New game" must stop a game at once (US1 #1), and a human game would lock the page.
- **A generation counter checked after each await.** Workable, but it doesn't stop pending timers or resolve the human promise. `AbortController` does both and is standard.
- **Count abandoned games as losses.** Rejected. Michie reinforced only completed games, and the spec says abandoned games are discarded.

## R2. Training loop and the empty opening box (FR-004–FR-006)

**Decision**:

- **Engine.** Training games with a computer opponent run through the same engine `playGame`, with no pauses.
- **Time slicing.** The UI runs games in slices of at most ~12 ms of engine work, then renders the statistics, learning curve and drawer view (when it is open), then yields with `setTimeout(0)`. Progress updates once per slice.
- **Stop.** "Stop" sets a flag that is checked between games. The final message reads "Training stopped after k of N games." or "Training finished: N games.".
- **Empty opening box.** If MENACE resigns at its opening move (an empty first box), training stops automatically. The status explains that MENACE has no opening moves left and needs a reset or a load. The same message appears for an animated game.

**Spec amendment**: FR-004 originally allowed only the visitor to stop a run early. The automatic stop is an addition, so FR-004 now reads "…unless the visitor stops it early or MENACE can no longer open a game (FR-006)". The reason: hundreds of identical instant resignations teach nothing and push the learning curve to 100% loss.

**Alternatives considered**:

- **Keep the fixed "every 5 games" render cadence.** Rejected. Its cost grows with drawer size and it ignores device speed.
- **A Web Worker.** Rejected. A worker can't be loaded from a single `file://` page without a Blob-URL workaround, and engine work per slice is tiny.

## R3. Michie's 1963 bead rule (FR-021–FR-025, US6)

**Verified facts**:

- Enumerating every reachable position where MENACE is to move with 2 or more free squares gives **304** canonical boxes (1 / 12 / 108 / 183). This was computed with the page's own transforms.
- Exactly **56** of them are symmetric. Every one of the 56 has at least one pair of free squares that are equivalent under the position's symmetry, so every one of them loses at least one bead colour.
- Under Michie's rule the opening box has **3** colours: corner, edge and centre. This matches the 1963 paper's example, where seven free squares reduce to four colours.

**Decision**:

1. **Move groups.** For a canonical box position, compute its *stabiliser*: the transforms that leave the position unchanged. Free squares that the stabiliser maps onto each other form a **move group**, and the group's lowest-numbered canonical square is its **representative**.
2. **Bead placement by rule.**
   - `michie1963`: beads (4/3/2/1 by move number) go on representatives only. Other members of a group always hold 0.
   - `perSquare`: every free square is its own group. This is today's behaviour.
3. **Playing a drawn bead.** When the representative's bead is drawn, MENACE plays the representative, mapped to the real board (`realIdx = T[rep]`). This is the faithful reading: the operator reads the square off the box's picture. Because the group members are equivalent, the outcome is the same whichever member is played. The box panel lists the group: "square 1 (same as 3, 7, 9)".
4. **Changing the rule.** The rule belongs to a MENACE (its drawer). Changing it creates a fresh MENACE after confirmation (R10). Box keys don't need to encode the rule.

**Alternatives considered**:

- **Play a random member of the group.** This gives more visual variety but is not what the 1963 procedure describes. It also makes the panel's "played square" depend on a second random draw.
- **Convert a trained drawer between rules.** Rejected. You can't split or merge bead counts without inventing data.

## R4. Box panel orientation and symbols (FR-007–FR-009, US2)

**Decision**:

- **Standard orientation kept.** Boxes are still shown in their standard orientation, as Michie's box pictures were. Each trajectory step also stores `transformIndex`, `colorIdx` and `realIdx`.
- **Orientation notice.** When `transformIndex ≠ 0`, the panel shows a notice built from a fixed table of names. Here `T[i]` maps standard square *i* to real square `T[i]`; the directions were checked against the transform arrays:

  | idx | name in UI |
  |---|---|
  | 0 | (same orientation; no notice) |
  | 1 | rotated 90° clockwise |
  | 2 | rotated 180° |
  | 3 | rotated 90° anticlockwise |
  | 4 | mirrored left–right |
  | 5 | mirrored top–bottom |
  | 6 | mirrored along the ↘ diagonal |
  | 7 | mirrored along the ↙ diagonal |

  The notice reads: "This box shows the board *rotated 90° clockwise*. The bead for box square 9 was played on board square 3."
- **Symbols.** One display function, `glyph(mark)`, maps engine marks to display symbols: `X` → ◯ (MENACE), `O` → ✕ (opponent), empty → ·. It is used for the position code, the mini-boards and spoken labels. The engine keeps its internal `X`/`O`, so canonical ordering and the 304 count are unaffected.
- **Square labels.** Labels are always qualified: "board square n" in the status line and on the board, "box square n" in the box panel and the drawer view.

**Alternatives considered**:

- **Redraw each box in the real board's orientation.** Rejected. The same box would look different from game to game, which hides the lesson that one box covers several positions.
- **Rename the engine marks to M/P.** Rejected. It changes canonical ordering and forces the save format to change, for no gain to the user.

## R5. Perfect player (FR-017, FR-018, US4)

**Root cause**: `minimax()` memoises the *chosen move*, including the result of its random tie-break, for every position. It also scores all wins the same (±1) whatever their depth.

**Decision**:

- **Depth-aware scores.** Use `score = ±(10 − plies)` for wins and losses, and 0 for draws. Memoise only the **score** per `(boardKey, player)`.
- **Choosing a move.** At move time, score every legal reply from the memo and pick **uniformly at random among the best-scoring replies**, using the injected `rng`.
- **Memo lifetime.** Scores don't depend on MENACE, so the memo lasts as long as the page and doesn't need clearing on reset.

The perfect player now takes immediate wins and prefers faster wins, and its choices vary between games.

**Alternatives considered**:

- **Clear the memo every game.** That keeps the depth bug and recomputes the tree needlessly.
- **Add a "take an immediate win" special case.** It fixes depth 1 only, and the frozen choices remain.

## R6. Contrast (FR-010, SC-002)

**Method**: WCAG 2.1 relative luminance. All text tokens were checked against all three surfaces in each theme (light: `#e7e2d2`, `#f2eee1`, `#eae3cf`; dark: `#16110d`, `#201911`, `#281f14`). The target is ≥ 4.6:1, which leaves a margin for rounding.

**Decision: new and adjusted tokens.** Text tokens are kept separate from fill tokens so that colourful fills can stay.

| Token | Light (was → new) | Dark (was → new) | Used for |
| --- | --- | --- | --- |
| `--ink-muted` | `#8a7c68` (3.14) → `#6b624e` (4.65) | `#8e7f68` (4.15) → `#948771` (4.60) | small labels, chart axis text |
| `--brass-ink` *(new)* | `#9c7c3c` as text (3.02) → `#75602e` (4.67) | `#cba24d` (6.80) unchanged | eyebrows; `--brass` stays for fills |
| `--status-good-ink` *(new)* | `#0ca30c` on tint (2.39) → `#0c6e0c` (4.60) | → `#24ad24` (4.68) | "+3" badge text |
| `--status-warning-ink` *(new)* | `#c98200` on tint (2.24) → `#805400` (4.70) | → `#cf8f1e` (4.67) | "+1" badge text |
| `--status-critical-ink` *(new)* | `#d03b3b` on tint (3.25) → `#a32f2f` (4.72) | → `#df6e6e` (4.62) | "−1" badge, "resigned" eyebrow |

**Bead chips** get a per-colour text token, `--cat-N-ink`: whichever of dark ink `#1c1712` or light ink `#fbf3ea` contrasts better with that bead. Six beads are nudged slightly so that every one reaches ≥ 4.6:

| Bead | Light theme | Dark theme |
| --- | --- | --- |
| 1 | `#2a78d6` → `#3a84da`, dark ink (4.65) | `#3987e5`, dark ink (4.89) |
| 2 | `#1baf7a`, dark ink (6.32) | `#22b884`, dark ink (6.99) |
| 3 | `#eda100`, dark ink (8.21) | `#c98500`, dark ink (5.79) |
| 4 | `#008300` → `#008000`, light ink (4.68) | `#2f9c2f`, dark ink (5.01) |
| 5 | `#9c7c3c` → `#9e7f40`, dark ink (4.71) | `#cba24d`, dark ink (7.47) |
| 6 | `#4a3aa7`, light ink (7.79) | `#9085e9`, dark ink (5.69) |
| 7 | `#e34948` → `#e44d4c`, dark ink (4.63) | `#e66767`, dark ink (5.51) |
| 8 | `#e87ba4`, dark ink (6.61) | `#d55181` → `#d65484`, dark ink (4.62) |
| 9 | `#eb6834`, dark ink (5.56) | `#d95926` → `#da5c2a`, dark ink (4.70) |

The pressed segmented button already passes: light 5.86, dark 6.16. The page has both a `prefers-color-scheme` block and `[data-theme]` blocks, and every new token must be defined in all of them. The browser check (R13) audits the rendered result, not just the token table.

**Alternatives considered**:

- **Darken every bead colour.** Rejected. It changes the look much more than per-bead text colours do.
- **Put text outlines on bead numbers.** Rejected. It hurts legibility at 12 px and isn't a recognised way to meet contrast.

## R7. Keyboard focus and board semantics (FR-011–FR-013, FR-016)

**Root cause**: `renderBoard()` rebuilds all nine buttons with `innerHTML` after every move, and squares that can't be clicked are made `disabled`. Either one alone throws away keyboard focus.

**Decision**:

1. **Persistent squares.** The nine square buttons are created once and updated in place: content, `aria-label`, state.
2. **`aria-disabled` instead of `disabled`.** Squares that can't be played get `aria-disabled="true"`, which keeps them focusable, and clicks on them are ignored.
3. **Roving tabindex.** One square is in the tab order. Arrow keys move between squares (wrapping at the edges), Home/End jump to squares 1 and 9, and Enter/Space plays.
4. **Spoken square labels.** Each square is labelled "Board square 5, MENACE's nought" or "Board square 2, Random mover's cross", using the opponent's display name ("your cross" for the human).
5. **Named control groups.** The opponent and bead-rule groups get `aria-labelledby` pointing at their visible labels. The pressed option is announced through `aria-pressed`.
6. **Live-region discipline.** `setStatus(text, { announce })` controls what is spoken. Transient messages such as "MENACE is shaking a box…" and "…is thinking…" update the visible line only, with `announce: false`. Moves, results, training start/finish and load/save outcomes are spoken.

**Alternatives considered**:

- **Restore focus by index after each re-render.** Fragile. It still loses focus while squares are disabled, and screen readers re-announce the rebuilt buttons.
- **Number keys 1–9 as shortcuts.** Deferred (not required). They could clash with screen-reader shortcuts, and arrow keys plus Enter are the expected pattern for a grid.

## R8. Standards mode and language (FR-014)

**Finding**: `document.compatMode` is `"BackCompat"`. The file has no doctype and no `<html>`, `<head>` or `<body>`.

**Decision**:

- Add `<!doctype html>`, `<html lang="en">`, a `<head>` holding the existing meta tags, title and style, plus a `<meta name="description">`, and a `<body>`.
- Because the layout changes between quirks and standards mode, take screenshots before and after at 1280 and 375 px. Expect small differences in button heights and in line-height inside the flex/grid layouts.

**Alternative considered**: none. Missing declarations are simply a defect.

## R9. Learning curve: legible labels, persistent table (FR-015, FR-020)

**Finding**: the chart is drawn in a fixed 760-unit-wide coordinate space and scaled to fit. At a 500 px width its 9-unit text renders about 5 px tall, and on phones it is smaller still.

**Decision**:

- **Sizing.** Draw the chart at the container's real pixel width, read through `ResizeObserver` and debounced with `requestAnimationFrame`, so that one SVG unit is one CSS pixel. Text is 11 px. Height is 240 px, or 200 px below 480 px wide.
- **Padding.** Left and right padding are computed so that the end-point labels are never clipped.
- **Persistent table.** `ui.tableOpen` lives outside the render function. When it is true, every re-render rebuilds the table and keeps it open.
- **Table labelling.** The table gets a `<caption>`: "Rolling 20-game rates, as at the last game in each range". The headers are "Games", "Win rate", "Draw rate" and "Loss rate".

**Alternatives considered**:

- **Overlay HTML labels on the SVG.** More code and two coordinate systems to keep aligned.
- **A charting library.** Rejected. It would break the no-dependency, offline, single-file constraint.

## R10. Confirmations (FR-024, FR-035, edge cases)

**Decision**:

- **Rule change and load.** Use one reusable native `<dialog>` opened with `showModal()`, which provides a focus trap, Esc to cancel and restores focus afterwards.
  - Rule change: the dialog says "Switching the bead rule starts a fresh MENACE. Your N games of training will be lost unless you save first." Its buttons are **Save MENACE…**, **Cancel** and **Switch and start fresh**. Save keeps the dialog open.
  - Load: validation runs *before* any dialog, so a rejected file never prompts. The dialog then compares the two MENACEs: "Replace your current MENACE (N games, rule) with the saved one (M games, rule, saved date)?"
- **When to skip confirmation.** No dialog appears when the current MENACE has 0 recorded games and an empty drawer.
- **Reset.** Reset keeps its existing "click again" confirmation (FR-042: keep current controls).

**Alternatives considered**:

- **`window.confirm()`.** It blocks the page and can't be styled. Some embedded contexts also suppress it.
- **Reuse the "click again" pattern everywhere.** It can't carry the "save first" option or the comparison text.

## R11. Save file (FR-034–FR-038, US8)

**Decision**:

- **Format.** JSON (UTF-8), formatted readably so that teachers can inspect it. `format: "menace-drawer"`, `version: 1`. The full contract is in [contracts/save-file.md](./contracts/save-file.md) with a [JSON Schema](./contracts/save-file.schema.json).
- **Record encoding.** The outcomes are stored as a compact string of `W`/`D`/`L`, so 10,000 games take about 10 KB.
- **Saving.** Build the file as a `Blob`, give it an object URL, and click a temporary `<a download>`. The filename is `menace-<rule>-<games>-games-<YYYY-MM-DD>.json`. This works from `file://` and offline, with no network.
- **Loading.** A hidden `<input type="file" accept=".json,application/json">` reads the file with `file.text()`. Files over 5 MB are rejected before parsing.
- **Validation.** A pure engine function, `parseSave(text)`, checks the file in two stages:
  1. *Structure*: types, required fields and allowed values.
  2. *Meaning*: each position must be canonical and reachable, the move number must match the number of pieces, there must be no beads on occupied squares or on non-representatives under `michie1963`, the win/draw/loss totals must equal both `gamesPlayed` and the length of `outcomes`, the discovery numbers must be unique and run 1…n, and each bead count must be at most its starting count + 3 × `gamesPlayed`.

  The result is `{ ok: true, menace }` or `{ ok: false, code, message }`. Nothing is applied until it returns ok, so a file is never loaded in part.
- **What is not saved.** The opponent selection, and the current game's trajectory and bead changes, are not saved. After a load the box panel shows its empty state and a new game starts.

**Alternatives considered**:

- **`localStorage` autosave.** Rejected in clarification (Q2: a file). It would also make the footer's "nothing is stored" promise harder to keep.
- **A compact binary or base64 format.** Not readable, and saves are small enough already.
- **A JSON Schema validator library.** Rejected because it adds a dependency. A hand-written validator of about 80 lines covers both stages, and the schema file serves as documentation and as a test fixture source.

## R12. Drawer view (FR-028–FR-033, US7)

**Decision**:

- **Placement.** A new `<section>` titled "The drawer", between the learning curve and "How MENACE works". It opens with a disclosure button ("Open the drawer · n boxes", `aria-expanded`) and is **collapsed by default**. It renders only while open, so training costs nothing extra when it is shut.
- **Controls, all native elements:**
  - a radio group "Move": All / 1st / 3rd / 5th / 7th
  - a checkbox "Only empty boxes"
  - a `<select>` "Sort": Discovery order / Most beads / Fewest beads
  - a count line, "Showing n of m discovered boxes", announced politely only when a filter or sort changes
- **Cards.** The list is a `<ul>` of cards. Each card has:
  - a heading such as "Box #12 · 5th move · 14 beads"
  - the shared mini-board, `aria-hidden`, with an sr-only bead list giving the same facts
  - badges for "Used last game" and "Empty: MENACE resigns here"

  The cards reuse the box-panel component from R4, so the symbol and orientation rules apply here too.
- **Updates.** The view re-renders after every commit, and once per training slice while it is open.
- **Empty states.** With no boxes: "MENACE opens a box the first time it meets a position. Play or train a game to fill the drawer." With a filter that matches nothing: "No boxes match these filters."

**Scale check**: at most 304 cards × about 12 nodes each is under 4,000 nodes. Building them in one `innerHTML` pass is within one frame on mid-range hardware. This is confirmed by the browser check timing.

**Alternatives considered**:

- **A separate page or tab.** Rejected. It would break the single-file constraint and break the link between the drawer and the live game.
- **Virtualised scrolling.** Not needed at this size.

## R13. Testing without dependencies

**Decision**:

1. **Split the engine out.** All pure logic moves into `<script id="menace-engine">` inside [index.html](../../index.html). It defines one global, `MenaceEngine`, and must not touch the DOM; it uses an injected `rng` and a `pause` that respects abort signals.
2. **Unit tests.** `node --test` (built into Node ≥ 22) runs the files under `tests/engine/`. A helper reads `index.html`, extracts the engine script by its id, and evaluates it with `node:vm`. One file is shipped, and the code tested is exactly the code users run. A seeded RNG (mulberry32) makes the tests deterministic.
3. **Browser checks.** `tests/browser/check.mjs` drives the installed Chrome through the DevTools Protocol, using Node's built-in `WebSocket` and `fetch`, with no Playwright or Puppeteer. It can emulate a 320 px screen and both colour schemes, which a headless window cannot (its minimum width is 500 px), and it can set the file input for load tests. It checks:
   - rendering mode and language
   - contrast of every text node
   - focus retention
   - no horizontal scroll and chart label height
   - the interrupt scenarios
   - save → load
   - drawer filters

   It prints a pass/fail table and exits non-zero on any failure.
4. **Package file.** A `package.json` with **no dependencies**, holding only `test` and `check:browser` scripts and `engines.node >= 22`.

**Alternatives considered**:

- **Playwright.** Excellent, but it needs a network install and ~100 MB of browsers, against the project's zero-dependency nature. Moving to it later is easy, because the checks are written as plain async functions.
- **Moving the engine into a separate `.js` file.** It works from `file://` as a classic script, but it breaks "share one file". The vm-extraction approach keeps both.

## R14. Historical text (FR-026, FR-027, SC-006)

The page's claims were checked one by one against sources during planning. They were **re-checked against the sources themselves during implementation (2026-11-22)**, which corrected four planning findings. Those corrections are marked ⚠ below.

| # | Claim on the page before | Finding (re-checked) | Page now says | Source |
| --- | --- | --- | --- | --- |
| 1 | Michie "spent the Second World War in the Testery, working alongside Alan Turing and Jack Good" | Michie was Max Newman's first cryptographic assistant in the Testery (late 1942), stayed with Newman in the Newmanry from early 1943, and worked closely with Jack Good. ⚠ Planning said Turing was Michie's "friend and weekly chess partner", but none of the sources checked says so. GCHQ says only that his "interactions with Alan Turing implanted an interest in … machine learning". | Worked on Tunny, "first in the Testery and then in Max Newman's Newmanry alongside Jack Good, and his contact there with Alan Turing left him with a lasting interest in machines that learn" | GCHQ; Wikipedia: Donald Michie |
| 2 | Built MENACE "together with his colleague Roger Chambers" | ⚠ The sources disagree. Wikipedia's MENACE article says "designed and built by … Donald Michie and his colleague Roger Chambers". Michie's 1963 paper (sole author), Wikipedia's Michie article and M. Scroggs name Michie alone. No primary source for Chambers' part in MENACE was found (see spec US5). Every source ties Chambers to BOXES (Michie & Chambers, 1968). | MENACE is credited to Michie, without claiming he worked alone. Chambers is mentioned for BOXES (1968), the pole-balancing learner. | Wikipedia: MENACE; Michie 1963 |
| 3 | 304 matchboxes, with symmetric positions merged | ⚠ *(Convergence, T079)* The sources disagree. Michie's own 1963 paper says "Every one of the 287 essentially distinct positions which the opening player can encounter … is represented by a separate box". Wikipedia ("made from 304 matchboxes") and M. Scroggs give 304. Symmetric positions merged: confirmed. 304 is also what the simulator computes for positions with a real choice (R3). | History text: "one box for each essentially different position it could face: 287 of them by the count in his 1963 paper, though most later accounts give 304". Same-rules text (reworded in Convergence, T085): "Its drawer is built differently from his. It has a box for every position in which MENACE has a real choice: 304 in all, the figure most accounts give, where his 1963 paper counts 287." It also names the other differences: boxes opened on first use rather than a fixed set, and, under one per square, the colours. | Michie 1963; Wikipedia: MENACE; M. Scroggs; computed (R3) |
| 4 | Beads in "nine colours, one per empty square" | True only under one colour per square. Michie 1963: "At first sight there are seven possible moves available. Considerations of symmetry, however, reduce these to four". His opening box holds three colours ("white, lilac and gold"). | Both schemes are described, and the page says which one it uses (US6) | Michie 1963 |
| 5 | Starting beads 4/3/2/1; reinforcement +3/+1/−1 | Confirmed from the primary source *(Convergence, T079)*. Michie 1963, Table 2: stage of play 1/3/5/7, "number of times each colour is replicated" 4/3/2/1. "A draw … received a unit bonus. A win … was rewarded by three extra beads to each open box"; a defeat is punished by "confiscation of the selected bead". Also confirmed by Wikipedia and M. Scroggs, whose blog says "four beads of each colour in the first move box, three in the third move boxes, two in the fifth move boxes and one in the final move boxes". | Kept | Michie 1963; Wikipedia: MENACE; M. Scroggs; M. Scroggs, MENACE blog |
| 6 | Resigns when a box is empty | ⚠ *(Convergence, T084)* Planning cited Michie 1963, but the paper's text contains neither "resign" nor "empty". M. Scroggs' MENACE blog does state it: "After a few games have been played, it is possible that some boxes may end up empty. If one of these boxes is to be used, then MENACE resigns." Wikipedia and Scroggs' /menace page do not address it. | Kept: "Starve a box of every bead and MENACE had nothing left to draw: it resigned." | M. Scroggs, MENACE blog |
| 7 | "stopped losing altogether" against a sharp opponent | ⚠ Wikipedia says that in Michie's 1961 tournament "he and the computer began to draw consistently after twenty games". "Stopped losing altogether" overstates it. M. Scroggs' blog adds that the tournament "lasted 220 games and 16 hours, MENACE drew consistently after 20 games", citing Michie's 1961 "Trial and error". | "In a tournament Michie played against it in 1961, MENACE was drawing consistently after about twenty games" | Wikipedia: MENACE |
| 8 | "Michie went on in 1965 to found … Department of Machine Intelligence and Perception" | ⚠ Edinburgh Informatics, the University's own history, says: "In 1965 this became the Experimental Programming Unit with Michie as Director. In 1966 the Department of Machine Intelligence and Perception (DMIP) was formed". Wikipedia says Michie directed the Department "(previously the Experimental Programming Unit) from its establishment in 1965", which counts from the unit's start. No source gives a month; planning's "January 1965 / October 1966" was not confirmed. | "In 1965 Michie became director of the … Experimental Programming Unit, which grew into its Department of Machine Intelligence and Perception, formed in 1966" *(the 1966 date was added in Convergence, T082)* | Edinburgh Informatics history; Wikipedia: Donald Michie |
| 9 | "This page runs the same rules" | True only under `michie1963` once US6 lands. | Made conditional on the selected rule (US6) | — |
| 10 | Masthead: "Edinburgh, 1961" | ⚠ The year is supported by both Wikipedia articles (M. Scroggs says 1960). No source checked places the build in Edinburgh. | "Donald Michie, 1961" | Wikipedia: MENACE; Wikipedia: Donald Michie |
| 11 | MENACE always moved first, playing ◯ | Confirmed: "MENACE played first, as O". | Kept | Wikipedia: MENACE |
| 12 | Footer: "Donald Michie & Roger Chambers' 1961 MENACE" | Same issue as row 2. | "Donald Michie's 1961 MENACE" | as row 2 |
| 13 | "Michie pre-built every box in advance" *(Convergence, T079)* | Only partly supported. Wikipedia: MENACE "was made from 304 matchboxes glued together in an arrangement similar to a chest of drawers". Michie 1963: each position "is represented by a separate box, the face of which bears a drawing of the position and a code-number". No source says when the boxes were filled. | "Michie's machine was a fixed set of matchboxes glued together like a chest of drawers, each box marked with a drawing of its position" | Wikipedia: MENACE; Michie 1963 |
| 14 | "an early working demonstration that a machine could improve at a task purely through trial, error and reward, the idea now called reinforcement learning" *(Convergence, T079)* | Supported once reworded. Michie 1963 (abstract): "a trial-and-error device which learns to play the game of Noughts and Crosses". Wikipedia: MENACE refined "its strategy through reinforcement learning" and "proved that a computer could learn from failure and success to become good at a task". | "Michie called it 'a trial-and-error device which learns to play': an early working example of a machine learning from success and failure, in the way now called reinforcement learning" | Michie 1963; Wikipedia: MENACE |
| 15 | "the game collapses to 304 cases" (how-it-works text) | See row 3. | "collapses to a few hundred cases" | as row 3 |

Sources:

- [Michie 1963 (PDF)](https://www.gwern.net/docs/rl/1963-michie.pdf)
- [Wikipedia: MENACE](https://en.wikipedia.org/wiki/Matchbox_Educable_Noughts_and_Crosses_Engine)
- [Wikipedia: Donald Michie](https://en.wikipedia.org/wiki/Donald_Michie)
- [GCHQ: Donald Michie](https://www.gchq.gov.uk/person/donald-michie)
- [Edinburgh Informatics history](https://informatics.ed.ac.uk/60-years-of-computer-science-and-ai/a-short-history-of-the-antecedents-of-the-school)
- [M. Scroggs, MENACE](https://www.mscroggs.co.uk/menace/)
- [M. Scroggs, MENACE blog post](https://www.mscroggs.co.uk/blog/19) (added in Convergence, T084)
- The Kellogg College blog listed during planning does not mention Michie, so it is no longer cited.
- Michie 1963 was read through its text layer (the published PDF, as hosted by Gwern) during Convergence (T079), which confirmed rows 3, 4, 5, 13 and 14.

## R15. Small fixes

- **Winning line (FR-019).** `checkWinner` returns `{ winner, line }`. The three squares get a `win` class, shown as an outline plus a tinted background that is distinguishable without colour. The result message names the winner and the squares: "MENACE wins on board squares 1, 5, 9."
- **Footer (FR-039).** New text: "Nothing here is sent anywhere. The drawer lives in this tab and resets on reload, unless you save it to a file on your device with *Save MENACE*."
- **Rule shown (FR-025).** A stat tile reads "Bead rule: Michie 1963" or "Bead rule: one per square". The chart's eyebrow reads "Rolling last 20 games · Michie 1963 rule".
