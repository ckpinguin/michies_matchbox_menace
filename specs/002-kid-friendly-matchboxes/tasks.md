---

description: "Task list for feature 002: Matchboxes a Kid Can Follow"
---

# Tasks: Matchboxes a Kid Can Follow

**Input**: design documents in `/specs/002-kid-friendly-matchboxes/`: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md).

**Tests**: requested. The plan's Testing section names `kid.test.mjs`, `copy.test.mjs` and three browser check modules, the quickstart defines each check, and Constitution V requires every engine addition to be tested. In each story, write the tests first and see them fail before implementing.

**Organization**: one phase per user story, in priority order. Every story after US1 builds on US1's matchbox picture.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (a different file, and no dependency on an unfinished task).
- **[Story]**: the user story the task belongs to (US1–US6).

## Path conventions

- The product is the single file `index.html` at the repository root. Its parts are the `<style>` block, the markup, the new `<script type="application/json" id="menace-copy">` copy deck, the engine `<script id="menace-engine">` and the UI `<script>`. Tasks name the part and the function they change.
- Every task that edits `index.html` is sequential, because they all share one file.
- Tests live under `tests/` (feature 001's harness: `node --test tests/engine/` and `node tests/browser/check.mjs`).

## Shared DOM hooks (read by the browser checks, provided by the implementation)

The checks and the page must agree on these. They add nothing a visitor sees.

| Hook | Where | Meaning |
| --- | --- | --- |
| `svg.matchbox[data-position-key]` | every matchbox picture | The box shown (`MatchboxPicture.positionKey`). |
| `.tray-group[data-color][data-count][data-display]` | one per `TrayGroup` | `data-count` is `TrayGroup.count`, `data-display` is `TrayGroup.display`. |
| `.bead[data-color][data-shape]` | each individual bead, in the tray or drawn | One element per bead shown. |
| `.heap` | a heap | Its text reads `× n`, the number of that colour's beads still in the tray. |
| `.bead-drawn` | the drawn bead (also has `.bead`) | Shown outside the tray. It is one of its group's beads: inside the tray that group shows `count − 1` beads (or a heap of `× count − 1`), so tray plus drawn bead equal `TrayGroup.count`. A finished game's committed boxes have no drawn bead outside. |
| `.face` | the face drawing group inside a matchbox | Carries the turn/flip transform (US4). |
| `#board button[data-idx] .bead-marker[data-color][data-shape]` | a board square | The bead marker (FR-004, FR-010). |
| `#step-area[data-step]` | the step area | `find`, `shake`, `tilt`, `lookup`, `play`, `forced`, `empty` or `learning`. |
| `[data-copy]` | `#status-line`, `#step-caption`, `.tip` | The dotted copy-deck key of the text shown. Absent when the standard words are shown. |

---

## Phase 1: Setup (shared infrastructure)

**Purpose**: test tooling the new checks need. No product change.

- [X] T001 [P] Extend `emulate()` in tests/browser/cdp.mjs to accept `reducedMotion: "reduce" | "no-preference"`. Send it as a `prefers-reduced-motion` media feature alongside the existing `prefers-color-scheme` one, and leave the current callers unchanged.
- [X] T002 [P] Create tests/helpers/load-copy.mjs, modelled on tests/helpers/load-engine.mjs (reuse its exported `INDEX_HTML`). It should:
  - extract `<script type="application/json" id="menace-copy">` with a regex, and throw a clear error naming the block when it is missing
  - export `loadCopy()`, which returns the parsed JSON
  - export `copyStrings(copy)`, which returns every shown string with its dotted path, skipping `placeholders`, `wordList` and each story panel's `picture` id
  - export `expand(text, placeholders)`, which replaces each `{name}` with its sample value
  - export `sentences(text)`, which splits at `.`, `!` and `?`
  - export `wordCount(sentence)`
  
  Follow the rules in contracts/copy-deck.md.
- [X] T003 [P] Create tests/browser/checks/matchboxes.mjs, tests/browser/checks/steps.mjs and tests/browser/checks/kid-help.mjs.
  - Give each a header comment listing its checks (as named in plan.md §Project Structure), and have each `export default []`.
  - Confirm that `node tests/browser/check.mjs` still runs and passes feature 001's 30 checks.

---

## Phase 2: Foundational (blocking prerequisites)

**Purpose**: the copy deck, the help settings, the Helps controls, the step area and the sequence runner. US2, US3, US4 and US5 all build on these.

**⚠️ CRITICAL**: finish this phase before any user story work.

- [X] T004 [P] Write tests/engine/copy.test.mjs using tests/helpers/load-copy.mjs. Cover:
  - the block parses as JSON
  - every `{name}` used in a string is defined in `placeholders`
  - **rule 1**: every sentence of every string, with placeholders expanded, has at most 15 words
  - **rule 2**: no `wordList` term appears as a whole word, case-insensitively, unless covered by `explains`
  
  Also unit-test the helpers on a small synthetic deck, so the rules are proven to fail on a 16-word sentence and on "resigns" (contracts/copy-deck.md, Rules 1–2). It fails until T005.
- [X] T005 Add the copy deck block `<script type="application/json" id="menace-copy">` to index.html, just before `<script id="menace-engine">`.
  - Give it `placeholders` and `wordList` exactly as in contracts/copy-deck.md §Shape.
  - Add empty `steps`, `learning`, `status`, `tips`, `compare` and `explains` objects and an empty `story` array. Later stories fill them.
  - Confirm that `node --test tests/engine/` passes.
- [X] T006 In the UI `<script>` of index.html:
  - Add `const COPY = JSON.parse(document.getElementById("menace-copy").textContent)`.
  - Add `copyText(path, vars)`. It looks up a dotted path in `COPY`, replaces each `{name}` with the HTML-escaped value from `vars`, and throws on an unknown path.
  - Extend the `ui` object with `help: { stepByStep: false, pacing: "auto", simpleWords: false }`, `tipsShown: new Set()` and `snapshot: null`, in memory only (data-model.md: `HelpSettings.stepByStep`, `HelpSettings.pacing`, `HelpSettings.simpleWords`; Constitution II).
- [X] T007 Add the **Helps** control group to the controls card markup in index.html, after the Bead rule group (contracts/ui.md §Helps group).
  - **Markup**: a visible label `<span class="control-label" id="help-label">Helps</span>`, a `role="group"` with `aria-labelledby="help-label"`, and two buttons with `aria-pressed="false"`: `#help-steps` "Step by step" and `#help-words` "Simple words".
  - **Pacing**: a segmented pair `#help-pacing` (`data-pacing="manual"` "One step at a time", `data-pacing="auto"` "Play by itself"), with `aria-pressed`. It is shown only while Step by step is on.
  - **Wiring**: clicks update `ui.help` (data-model.md: `HelpSettings.stepByStep`, `HelpSettings.pacing`, `HelpSettings.simpleWords`) and `aria-pressed`.
  - **Styling**: reuse the existing `.segmented` styles.
  - **Training**: `setControlsDisabled()` already disables every controls-card button during training, so the new buttons are covered. Check that this holds.
- [X] T008 Add the step area to index.html, inside `#board-card` and directly below `#status-line` (contracts/ui.md §Step area; research K6).
  - **Region**: `<section id="step-area" aria-label="How MENACE is moving" hidden>`.
  - **Contents**: `#step-indicator` (plain text, not live), `#step-picture`, `#step-caption`, `#step-next` "Next", `#step-playpause` (`aria-pressed`, labelled "Pause" or "Play") and `#step-replay` "Replay turn" (hidden by default).
  - **CSS**: add styles to the `<style>` block using the existing tokens only, so it fits 288 px of content width at a 320 px screen with no sideways scrolling.
- [X] T009 Add a reduced-motion layer to the UI `<script>` of index.html (FR-018; contracts/ui.md §Reduced motion).
  - **Media query**: `const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)")`.
  - **Helper**: add `motion(el, keyframes, options)`. It calls `el.animate()` normally. When `reduceMotion.matches`, it applies the last keyframe's styles at once and returns an already-finished stand-in, so `document.getAnimations()` stays empty.
  - **CSS**: add a `@media (prefers-reduced-motion: reduce)` block in `<style>` that turns off transitions and animations for every new class.
  - **Rule**: every animation added by later tasks MUST go through `motion()`, and none may use `Math.random` (research K2).
- [X] T010 Implement `runSequence(frames, signal)` in the UI `<script>` of index.html. It follows the data-model.md `MoveStep` sequence state: idle → running(step k) → done, or cancelled.
  - **Showing**: it shows `#step-area`, and for each frame `{ step, indicator, caption, copyKey, render(pictureEl), replay? }` sets `data-step`, the indicator text and the caption (`data-copy` = `copyKey` when the deck supplied it). It then calls `render`.
  - **Announcing**: it announces each caption once through the existing `announce()`, following feature 001's live-region rules.
  - **Pacing**: when `ui.help.pacing === "manual"` it advances on `#step-next`. When it is `"auto"` it advances after at least 2000 ms, and `#step-playpause` holds and resumes the current frame.
  - **Aborting**: it resolves at once and hides the region when `signal` aborts. If focus was inside the step area, it returns focus to the board's roving square.
  - **Timers**: every timer it uses is cleared on abort.
- [X] T011 Add `let currentSequence = null` (an `AbortController` for a running learning or replay sequence). Make `abandonCurrentGame()` in index.html abort it and set it to `null`.
  - Then check that each FR-011 interruption reaches `abandonCurrentGame()` before doing anything else: New game (the `new-game-btn` handler), opponent switch (the `opponentSelect` handler), reset (the `resetBtn` handler), training (`runTraining`), rule change (`switchRule`) and load (`applyLoadedMenace`).

**Checkpoint**: `node --test tests/engine/` and the full browser suite pass. The Helps buttons toggle `aria-pressed` and the step area exists but never shows yet.

---

## Phase 3: User Story 1 - Seeing real matchboxes and beads (Priority: P1) 🎯 MVP

**Goal**: every box MENACE uses is drawn as a matchbox next to its existing detail. The face shows the position and doubles as the colour key, the tray holds countable beads (or a heap with a count), and each colour carries a fixed shape. The drawn bead's board square shows the same colour and shape until MENACE's ◯ appears.

**Independent test**: play one game against the Random mover. Every box in the panel is a matchbox whose beads add up to the ledger's counts. The drawn bead's colour and shape match the marked board square. Loading `tests/fixtures/saves/valid/empty-opening.json` shows an empty tray and the "nothing to draw" caption.

### Tests for User Story 1 ⚠️

- [X] T012 [P] [US1] Write the US1 part of tests/engine/kid.test.mjs, using tests/helpers/load-engine.mjs and tests/helpers/rng.mjs (contracts/engine-additions.md, Tests 2–3).
  - **`BEAD_MARKS`**: 9 frozen entries, with `colorIdx` 0–8 in order, the colour names and shapes in research K4's order, unique names and shapes, and no shape called `circle`, `nought`, `cross` or `x`.
  - **`BEAD_DISPLAY_LIMIT`**: equals 12.
  - **`beadLayout`**: checked on boxes from `reachablePositions` under both bead rules, with bead counts set from a seeded rng (0–40). It keeps the total, uses `"beads"` at 12 and `"heap"` at 13, lists only representatives with beads in representative order, and sets `shown` correctly.
- [X] T013 [P] [US1] Add checks to tests/browser/checks/matchboxes.mjs, using the shared DOM hooks above.
  - **`matchbox-counts`** (FR-001, FR-002, SC-004):
    - Play 10 games against the Random mover. After each MENACE move and each game end, check that every `#box-panel` entry's matchbox `.tray-group[data-count]` equals the count in the same entry's `.bead-ledger` row.
    - For `data-display="beads"`, the number of `.bead` elements of that colour (tray plus drawn) must equal `data-count`. For a heap, the `× n` text plus the drawn bead must equal `data-count`.
    - Then press Run 500 and play one game. Assert that at least one heap appears and reads correctly.
  - **`bead-marks`** (FR-003, FR-004): after a MENACE bead move, and before its ◯ is drawn, the `.bead-drawn` and the board `.bead-marker` have the same `data-color` and `data-shape`. No two colours in any matchbox share a shape.
  - **`matchbox-empty`** (US1/AC6): load `tests/fixtures/saves/valid/empty-opening.json` the way tests/browser/checks/save-load.mjs does. The panel's resigned entry then shows a matchbox with no `.bead` and the caption saying MENACE has nothing to draw.
- [X] T014 [P] [US1] Extend `auditContrast()` in tests/browser/checks/a11y.mjs for SVG `<text>` drawn on an SVG shape. When the element (or its nearest ancestor) has `data-contrast-bg="--token"`, use that token's computed colour as the background instead of the HTML ancestors' background. Feature 001's `contrast-light` and `contrast-dark` checks then audit the heap counts in the matchbox.

### Implementation for User Story 1

- [X] T015 [US1] Add `BEAD_MARKS`, `BEAD_DISPLAY_LIMIT` and `beadLayout(beads, groups, limit = BEAD_DISPLAY_LIMIT)` to the engine block of index.html, and expose them on `MenaceEngine` (contracts/engine-additions.md; research K4).
  - **Data**: data-model.md `BeadMark.colorIdx`, `BeadMark.colourName`, `BeadMark.shape`, `TrayGroup.colorIdx`, `TrayGroup.count`, `TrayGroup.display`, `TrayGroup.shown`.
  - **Freezing**: freeze `BEAD_MARKS` and its entries.
  - **Purity**: no DOM, timers, `Math.random` or `Date`.
  - **Done when**: T012 passes.
- [X] T016 [US1] Add `beadMarkSVG(colorIdx, cx, cy, r)` to the UI `<script>` of index.html.
  - It draws a disc in `catColor(colorIdx)` with `BEAD_MARKS[colorIdx].shape` (star, heart, triangle, square, diamond, moon, plus, flower or arrow) inside it in `catInk(colorIdx)`.
  - The shapes are fixed paths scaled to `r`, still recognisable at a 10 px bead.
  - It returns a `<g class="bead" data-color data-shape>` string. The tray beads, the face key dots and the board markers all reuse it.
- [X] T017 [US1] Add `matchboxSVG(box, { beads = box.beads, drawn = null, label })` to the UI `<script>` of index.html (research K3; contracts/ui.md §Matchbox picture). Follow data-model.md `MatchboxPicture.positionKey`, `MatchboxPicture.face`, `MatchboxPicture.tray`, `MatchboxPicture.drawn` and `MatchboxPicture.label`. The picture has:
  - **Box**: a matchbox sleeve seen slightly from above, about 200 × 150 viewBox units, scaling down to 288 px wide.
  - **Face**: a `<g class="face">` holding the position in ◯ and ✕. Each free square shows the `beadMarkSVG` of its group's representative.
  - **Tray**: the open tray, laid out from `E.beadLayout(beads, box.groups)`. Individual 10 px beads go in fixed, deterministic cluster positions computed from the group index and bead index (no `Math.random`). A heap has its `× n` count in `--ink` as SVG `<text data-contrast-bg>`. The tray grows taller rather than shrinking the beads.
  - **Empty box**: an empty tray.
  - **Drawn bead**: when `drawn` is set, one bead of that colour sits outside the tray with `.bead-drawn` and a 2 px `--accent` outline, and the tray shows one fewer (see the shared DOM hooks).
  - **Semantics**: `role="img"` and an `aria-label` giving the box number, the face in words (reuse `positionSentence`) and each group's count, colour name and shape, for example "4 blue star beads".
- [X] T018 [US1] Add matchbox styles to the `<style>` block of index.html: sleeve, face, tray, bead outline, heap and drawn bead.
  - Use the existing tokens. Any new token must be defined in all four theme blocks.
  - Text must reach at least 4.5:1, and outlines at least 3:1, in light and dark (FR-019).
- [X] T019 [US1] Show a matchbox in each `#box-panel` entry (clarification C), next to the unchanged mini-board and ledger.
  - **Where**: in `boxCardHTML()` and `renderBoxPanel()` in index.html.
  - **Drawn bead**: while the game is running and not yet committed (`ui.view.deltas === null`), pass `drawn: step.colorIdx`. After the game ends, show the committed beads with no drawn bead.
  - **Resigned entry**: show the empty matchbox, with its existing "nothing left to draw" note.
  - **Layout**: wrap it so the box body still fits 320 px.
  - **Restored counts**: check that loading, reset and rule change re-render the panel, so matchboxes show the restored counts at once (spec edge case "Loading a saved MENACE").
- [X] T020 [US1] Hold back MENACE's ◯ while its bead marker shows (FR-004; research K1).
  - **State**: add `ui.heldBack = { idx, colorIdx } | null`.
  - **Board**: `renderBoard()` in index.html draws that square as empty, with a `.bead-marker` (`beadMarkSVG`). The square's accessible label gains the suffix ", MENACE's bead points here".
  - **Setting it**: in `onAnimatedEvent` (`type: "menace"`, `choice.kind === "bead"`), set `ui.heldBack`.
  - **Clearing it**: in `startNewGame()`'s `pause` callback, after the existing 450 ms `"menace-move"` wait (or on abort), clear `ui.heldBack` and re-render the board.
  - **Unchanged**: game flow and timing stay as in feature 001, and forced moves show no marker.
- [X] T021 [US1] Run `node --test tests/engine/` and `node tests/browser/check.mjs --only=matchbox,bead-marks,contrast,narrow-320,keyboard,box-panel,orientation,shared-colour`, and fix every failure in index.html.

**Checkpoint**: US1 is complete and shippable on its own. This is the MVP.

---

## Phase 4: User Story 2 - Following a move step by step (Priority: P2)

**Goal**: with Step by step on, each MENACE move unfolds as five captioned steps (find, shake, tilt, look up, play), one at a time or by themselves. MENACE's ◯ appears only at step 5.

**Independent test**: turn on Step by step and One step at a time, then press New game. Steps 1–5 appear in order, each with its caption and highlight, and the ◯ appears only after the fourth Next.

### Tests for User Story 2 ⚠️

- [X] T022 [P] [US2] Add checks to tests/browser/checks/steps.mjs.
  - **`steps-order`** (FR-006, FR-007, US2/AC1–AC2, AC4–AC6):
    - With both helps off, the step area stays hidden and MENACE's ◯ appears within 1 s.
    - Then turn on Step by step and One step at a time, and press New game. `#step-area[data-step]` goes find → shake → tilt → lookup → play, with `#step-indicator` reading "Step k of 5" and a non-empty caption at each step.
    - The step-1 caption on a fresh MENACE says the box is new.
    - No ◯ is on the board before `play`.
    - Then play games as "Play it yourself", choosing the visitor's squares with the page's global `MenaceEngine.perfectMove`. Retry up to 20 games until MENACE's fifth move, and check that only a single `forced` caption is shown there.
  - **`steps-auto`** (FR-007): with Play by itself, each step stays at least 2000 ms (measure with `performance.now()` in the page). Pressing Pause holds the current step for 3 s, and Play resumes it.
  - **`steps-interrupt`** (FR-011): during step 3, press New game. The step area hides at once, the record's games played does not change, and a new game starts.

### Implementation for User Story 2

- [X] T023 [US2] Add the step captions (data-model.md `MoveStep.caption`) in two forms:
  - the standard words, as a `STEP_TEXT` constant in the UI `<script>` of index.html
  - the simple words, as `steps.find.text`, `steps.find.newBox`, `steps.shake.text`, `steps.tilt.text`, `steps.lookup.text`, `steps.play.text`, `steps.forced.text`, `steps.empty.text` and `steps.empty.opening` in the copy deck
  
  Then add `stepCaption(id, variant, vars)`. It returns `{ html, copyKey }`, taking the deck text when `ui.help.simpleWords` is on and the standard text otherwise.
  - **Wording**: it must match research K13, for example "MENACE shakes the box, then tilts it. The first bead to roll to the front is the one it uses." The page's colour and shape names must never be presented as Michie's.
  - **Done when**: `copy.test.mjs` passes.
- [X] T024 [US2] Add `moveStepFrames(choice, board, signal)` to the UI `<script>` of index.html (data-model.md `MoveStep.id`, `MoveStep.index`, `MoveStep.highlight`, `MoveStep.variant`; and the special cases).
  - **Bead move**: it returns the five frames find, shake, tilt, lookup and play. The `variant` is `"new-box"` when `choice.provisional` is set.
  - **Forced move**: one `forced` frame with no indicator.
  - **Resignation**: `find` followed by `empty`, using `empty.opening` when `choice.moveNumber === 1`.
- [X] T025 [US2] Implement each frame's `render` in index.html, every animation through `motion()` from T009. Each frame draws `matchboxSVG` in `#step-picture`, using the box from `lookupBox(choice.positionKey, game)`.
  - **find**: highlight the board, and the box appears with a "new box" badge for the `new-box` variant.
  - **shake**: a fixed side-to-side keyframe pattern of about 0.8 s.
  - **tilt**: the drawn bead rolls from the tray to the front and becomes `.bead-drawn`.
  - **lookup**: highlight the face key dot for `choice.colorIdx`, and set `ui.heldBack` so the board marker shows on `choice.realIdx`.
  - **play**: clear `ui.heldBack`, re-render the board so the ◯ appears, and remove the markers.
- [X] T026 [US2] Wire the steps into the game in index.html (research K1).
  - **Capturing the move**: in `onAnimatedEvent`, store the latest `choice`, along with the game, in the `run`.
  - **The pause**: replace `startNewGame()`'s `pause` callback with `menaceMovePause(kind, signal)`:
    - For `"menace-move"`, when `ui.help.stepByStep` was on when the move began, it does `await runSequence(moveStepFrames(...), signal)`.
    - Otherwise, and for `"opponent-move"`, it keeps the existing 450 ms and 350 ms waits.
  - **Announcements**: with steps on, the step captions are the announcements. The usual "MENACE drew a bead and played …" status line is set with `{ announce: false }` after `play`, so nothing is announced twice (FR-017).
- [X] T027 [US2] Add keyboard and focus behaviour to the step area in index.html (research K6; FR-017).
  - **Next**: when activated by the visitor, focus stays on Next for the following step.
  - **Pause/Play**: toggles `aria-pressed` and its label.
  - **Focus**: the board's roving focus and arrow keys are unchanged, and nothing in the step area takes focus by itself.
  - **Tab order**: the step-area controls follow the status line.
- [X] T028 [US2] Handle the visitor's own turn and training in index.html.
  - **Visitor's turn**: the step area stays hidden and the status line keeps its "Your move" text (the simple-words version comes in T047).
  - **Training**: `runTraining()` passes no `pause` and never calls `menaceMovePause`. Add a guard in `menaceMovePause` that returns at once while `ui.training.running` (FR-012).
- [X] T029 [US2] Run `node tests/browser/check.mjs --only=steps-order,steps-auto,steps-interrupt,keyboard,narrow-320,integrity` and fix every failure in index.html.

**Checkpoint**: US1 and US2 work on their own, and the steps are off by default.

---

## Phase 5: User Story 3 - Seeing the beads go in and out after a game (Priority: P2)

**Goal**: with Step by step on, the end of each game shows every box used gaining 3 beads (win) or 1 (draw), or losing its drawn bead (loss), with a plain caption.

**Independent test**: with Step by step on, play one game MENACE wins and one it loses. Each box shows the right number of beads moving, and ends at the ledger's committed count.

### Tests for User Story 3 ⚠️

- [X] T030 [P] [US3] Add `learning-beads` to tests/browser/checks/steps.mjs (FR-008; US3/AC1–AC4).
  - **Setup**: with Step by step and One step at a time on, play games against the Random mover until one win and one loss have been seen (up to 30 games).
  - **Each learning frame**: `data-step="learning"`, and the beads shown moving in (`.bead-drop`) or out (`.bead-out`) equal the box's ledger delta (+3, +1 or −1).
  - **After each frame**: the tray's `data-count` equals the ledger's committed count, and the caption has at most 2 sentences.

### Implementation for User Story 3

- [X] T031 [US3] Add the learning captions (data-model.md `LearningStep.caption`) in two forms:
  - the standard words, as a `LEARNING_TEXT` constant in the UI `<script>`
  - the simple words, as `learning.win`, `learning.draw` and `learning.loss` in the copy deck of index.html
  
  Each caption has 1 or 2 sentences and matches research K13 (win 3 more beads, draw 1 more, loss: the bead is taken away). For example: "MENACE won, so it gets more of the beads that worked."
- [X] T032 [US3] Add `learningFrames(game, deltas)` to the UI `<script>` of index.html. It returns one frame per delta, in the order the boxes were played (data-model.md `LearningStep.positionKey`, `LearningStep.result`, `LearningStep.colorIdx`, `LearningStep.before`, `LearningStep.after`).
  - **Source of values**: `before` and `after` come only from feature 001's `deltas`, never recomputed (SC-004).
  - **Resigned games**: boxes used before the resignation get frames. The empty box has no delta, so it gets none.
- [X] T033 [US3] Implement each learning frame's `render` in index.html through `motion()` (research K10).
  - **Starting picture**: `matchboxSVG(box, { beads: before })`.
  - **Win or draw**: `after − before` beads (`.bead-drop`) fall from above into fixed tray positions.
  - **Loss**: the drawn bead (`.bead-out`) lifts out to a "put aside" spot beside the box.
  - **End state**: the picture is redrawn with the committed `after` beads.
  - **Heaps**: when a colour is shown as a heap, the moving beads are still drawn one by one, and the heap's `× n` changes from `before` to `after`.
  - **Timing**: about 1 s per box with Play by itself.
- [X] T034 [US3] Start the learning sequence in index.html.
  - **When it starts**: in `onAnimatedEvent` (`type: "end"`), after the existing renders and result status, when `ui.help.stepByStep` is on and the game was not abandoned.
  - **How**: create an `AbortController`, store it as `currentSequence`, and call `runSequence(learningFrames(...), controller.signal)`.
  - **When it stops**: New game and every other interruption abort it through T011, and the panel already shows the committed counts. When it finishes, the region hides and `currentSequence` is cleared.
- [X] T035 [US3] Run `node tests/browser/check.mjs --only=learning-beads,steps,matchbox-counts,integrity` and fix every failure in index.html.

**Checkpoint**: US1–US3 work. The steps and the bead movements share the Step by step switch.

---

## Phase 6: User Story 4 - Understanding why a box looks turned around (Priority: P3)

**Goal**: in the step-by-step help, a box shown turned or flipped rotates its face into the board's orientation, and the bead's square lands on the played board square (replayable). Under Michie's 1963 rule, a shared colour marks all its equivalent squares, with a plain explanation.

**Independent test**: with Step by step on, play until a move has `transformIndex ≠ 0`. The face ends at `PICTURE_MATRICES[t]`, the marker is on the played square, and Replay turn runs the turn again.

### Tests for User Story 4 ⚠️

- [X] T036 [P] [US4] Add the `PICTURE_MATRICES` test to tests/engine/kid.test.mjs (contracts/engine-additions.md, Test 1).
  - **Centres**: box square `i` has centre `((i % 3) − 1, ⌊i / 3⌋ − 1)`, with y pointing down.
  - **Mapping**: for every `t` in 0–7 and `i` in 0–8, `[a, b, c, d]` maps that centre (x′ = a·x + c·y, y′ = b·x + d·y, CSS `matrix()` order) onto the centre of `TRANSFORMS[t][i]`.
  - **Shape**: 8 frozen entries.
- [X] T037 [P] [US4] Add checks to tests/browser/checks/matchboxes.mjs.
  - **`turned-box`** (FR-009, US4/AC1, AC3):
    - With Step by step and One step at a time on, play games against the Random mover until a lookup frame's box is turned (the step caption uses the `turned` variant, or the box panel shows "This box shows the board").
    - At `play`, the `#step-picture .face` computed transform equals `matrix(a, b, c, d, 0, 0)` for that `t`, read from the page's `MenaceEngine.PICTURE_MATRICES`.
    - The marker sits on the square the ◯ then occupies.
    - Replay turn runs an animation again, or re-applies the matrix when motion is reduced.
  - **`shared-colour-markers`** (FR-010, US4/AC2): under Michie 1963 with Step by step on, find a MENACE opening move whose group has more than one square.
    - At `lookup`, every square `TRANSFORMS[t][g]` for `g` in the group has a `.bead-marker` of the same colour, and the caption uses the `shared` variant.
    - After `play`, only the played square has the ◯ and no marker remains.

### Implementation for User Story 4

- [X] T038 [US4] Add `PICTURE_MATRICES` (the 8 frozen `[a, b, c, d]` arrays from research K5, in `TRANSFORMS` order) to the engine block of index.html and expose it on `MenaceEngine`. Done when T036 passes.
- [X] T039 [US4] Add the `turned` and `shared` lookup captions:
  - the standard words in `STEP_TEXT`
  - the simple words as `steps.lookup.turned` and `steps.lookup.shared` in the copy deck of index.html
  
  Extend `moveStepFrames()` to set `variant: "turned"` when `choice.transformIndex !== 0`, and `"shared"` when `choice.groupSquares.length > 1`. When both apply, use `turned` first and the shared caption after it, in a second sentence.
  - **Wording**: the turned caption says the box picture turns to match the board, with no word-list term. The shared caption follows research K7, for example "These squares are really the same move. MENACE puts its ◯ on this one."
- [X] T040 [US4] In the `lookup` frame's `render` in index.html, when `choice.transformIndex !== 0`:
  - **Turn**: animate `.face` from the identity to `matrix(…PICTURE_MATRICES[t], 0, 0)` over about 1.2 s through `motion()`, keeping the end state (transform-origin at the face's centre).
  - **Marker**: then place the board marker on `choice.realIdx`.
  - **Replay**: show `#step-replay`, which re-runs the turn on the current picture without moving to the next step.
  - **Reduced motion**: the face jumps to the matrix and the caption still says what happened.
- [X] T041 [US4] For shared colours in index.html (research K7), extend `ui.heldBack` to carry `squares`, the list `choice.groupSquares.map((g) => E.TRANSFORMS[choice.transformIndex][g])`.
  - **At lookup**: `renderBoard()` draws a marker on every one of those squares.
  - **At play**: the other markers fade out through `motion()`, leaving only `realIdx`, where the ◯ appears.
  - **One-per-square rule**: groups have one square, so nothing changes.
- [X] T042 [US4] Run `node --test tests/engine/` and `node tests/browser/check.mjs --only=turned-box,shared-colour,orientation,steps` and fix every failure.

**Checkpoint**: US1–US4 work. The most confusing moment, a turned box, is now animated.

---

## Phase 7: User Story 5 - Simple words and tips along the way (Priority: P3)

**Goal**: with Simple words on, the status messages, captions and tips use the copy deck's plain words. Each first-time event shows a tip once, and the "How MENACE learns" picture story tells the whole idea in 6 panels.

**Independent test**: turn on Simple words and play a few games. Each kind of event shows its tip exactly once, every message shown comes from the deck and passes `copy.test.mjs`, and the story can be read from start to end.

### Tests for User Story 5 ⚠️

- [X] T043 [P] [US5] Add rules 3–5 to tests/engine/copy.test.mjs (contracts/copy-deck.md).
  - **Story size**: `story` has 1–6 panels, each with 1–2 sentences, a non-empty `alt`, and a `picture` in `["drawer", "find", "shake", "lookup", "win", "loss"]`.
  - **Story content**: the story text together mentions a box, shaking or tilting, a bead, a square, and a win, a draw and a loss.
  - **Tips**: `tips` has exactly the six FR-014 events, each with a non-empty `title` and a `text` of at most 2 sentences.
  - **Status and learning**: every `status` key from the contract exists, and each `learning` caption has at most 2 sentences.
- [X] T044 [P] [US5] Add checks to tests/browser/checks/kid-help.mjs.
  - **`tips-once`** (FR-014, US5/AC2–AC3): with Simple words on, trigger each event twice: new box (a fresh MENACE), first win, first draw, first loss, turned box, and empty box (via `tests/fixtures/saves/valid/empty-opening.json`).
    - Each `.tip[data-copy="tips.<event>"]` appears exactly once.
    - It closes with Got it, or with Esc when focus is inside it.
    - It never takes focus by itself.
  - **`simple-words-text`** (FR-013, SC-006): with Simple words on (and Step by step on in manual pacing), play one game. Each time `#status-line` or `#step-caption` changes, it has `data-copy`, and its text equals that deck entry with placeholders filled. It also passes the 15-word and word-list rules, re-checked in the page.
  - **`story`** (FR-015, US5/AC4): open the picture story. It shows at most 6 panels, each with an `svg[role=img][aria-label]` and at most 2 sentences, and the disclosure button toggles `aria-expanded`.

### Implementation for User Story 5

- [X] T045 [US5] Fill `status` in the copy deck of index.html: `yourTurn`, `menaceWins`, `youWin`, `opponentWins`, `draw`, `trainingDone` and `trainingStopped` (contracts/copy-deck.md), plus `menaceMoved`, `forced` and `openingEmpty`, using "gives up", never "resigns".
  - Add `statusFor(key, vars, standardHTML)`. It returns `{ html, copyKey }`, taking the deck text when `ui.help.simpleWords` is on.
  - Route every `setStatus` call in `onAnimatedEvent`, `resultMessage`, `OPENING_EMPTY_MESSAGE` and `runTraining` through it.
  - `setStatus` sets or removes `data-copy` on `#status-line`.
- [X] T046 [US5] Wire the Simple words switch in index.html. Toggling `#help-words` re-renders the current status line and any visible step caption or tip in the other wording, without announcing them again (FR-005). With Simple words off, all of feature 001's text is byte-for-byte unchanged.
- [X] T047 [US5] Fill `tips` in the copy deck of index.html for `new-box`, `first-win`, `first-draw`, `first-loss`, `turned-box` and `empty-box`, each with a `title` and a `text` of 1–2 sentences.
  - Add the tip region above `#status-line`: a `<section class="tip" role="note">` with an `<h3>`, the text, and a **Got it** button. Its title and text are announced once.
  - Esc closes it only when focus is inside it, so it never competes with the confirm dialog's own Esc.
  - Add `showTip(event)` (data-model.md `Tip.event`, `Tip.title`, `Tip.text`, `Tip.shown`):
    - It shows nothing unless `ui.help.simpleWords` is on and `!ui.tipsShown.has(event)`.
    - It adds the event to `ui.tipsShown`.
    - It queues tips so only one shows at a time, in event order.
  - Also add `status.yourTurn` wording for the visitor's turn.
- [X] T048 [US5] Detect the tip events in `onAnimatedEvent` in index.html (research K9): a `menace` event with `choice.provisional` is a new box, with `choice.transformIndex !== 0` a turned box, and with `choice.kind === "resigned"` an empty box. An `end` event with `game.outcome` win, draw or loss is the first win, draw or loss. Training runs raise no tips.
- [X] T049 [US5] Fill `story` in the copy deck of index.html with the 6 panels of research K9, in order: `drawer`, `find`, `shake`, `lookup`, `win`, `loss` (data-model.md `PictureStory.panels`, `StoryPanel.picture`, `StoryPanel.sentences`, `StoryPanel.alt`).
  - Every factual sentence must match research K13.
  - Add the story section to the markup of index.html, just before `<section class="how-it-works">`: `<section aria-labelledby="story-title">` with the heading "How MENACE learns: the picture story", and a disclosure button (`aria-expanded="false"`, `aria-controls`) that reveals an `<ol>` of panels, collapsed by default. It reuses the drawer section's disclosure styles.
  - The story always uses the deck, whatever the Simple words setting.
- [X] T050 [US5] Draw the six story scenes in the UI `<script>` of index.html with `matchboxSVG` and `beadMarkSVG` on fixed demo boxes, with no `Math.random` and no animation. The scenes are a row of boxes (drawer), board plus box (find), a tilted box with the bead at the front (shake), a bead plus a marked square (lookup), +3 beads (win) and a bead set aside (loss). Each is an `<svg role="img" aria-label="{alt}">`.
- [X] T051 [US5] Run `node --test tests/engine/` and `node tests/browser/check.mjs --only=tips-once,simple-words-text,story,contrast,keyboard,narrow-320,feedback` and fix every failure.

**Checkpoint**: US1–US5 work. Both helps are independent and off by default.

---

## Phase 8: User Story 6 - Watching one box learn over many games (Priority: P4)

**Goal**: after a training run, "What changed?" shows any discovered box before and after the run as two matchboxes, with one sentence naming the colour that gained most and, if any, the one that lost most.

**Independent test**: note the opening box's beads, press Run 100, and open What changed? Before equals the noted counts, after equals the box now, and the sentence names the colour that grew most.

### Tests for User Story 6 ⚠️

- [X] T052 [P] [US6] Add `beadChanges` tests to tests/engine/kid.test.mjs (contracts/engine-additions.md, Test 4). Cover a gain only, a loss only, both, neither (both `null`) and ties (the lower `colorIdx` wins), checking that only representatives are compared.
- [X] T053 [P] [US6] Add `compare` to tests/browser/checks/kid-help.mjs (FR-016, US6/AC1–AC2).
  - **Setup**: switch to the Random mover, then read the opening box's ledger counts (box panel).
  - **Run**: press Run 100 and wait for it to finish.
  - **Assertions**:
    - The "What changed in the last training run?" section is visible, and its `<select>` lists the opening box first.
    - Its Before matchbox's `.tray-group[data-count]` equals the noted counts, and its After matchbox equals the current ledger.
    - The summary names the colour whose count rose most.
    - Reset hides the panel.

### Implementation for User Story 6

- [X] T054 [US6] Add `beadChanges(beforeBeads, afterBeads, groups)` to the engine block of index.html and expose it on `MenaceEngine` (data-model.md `BeadChangeSummary.gained`, `BeadChangeSummary.lost`; contracts/engine-additions.md). Done when T052 passes.
- [X] T055 [US6] Add the training snapshot to index.html (data-model.md `TrainingSnapshot.gamesBefore`, `TrainingSnapshot.beads`, `TrainingSnapshot.newBoxes`; research K11).
  - **Recording**: at the start of `runTraining()`, after `abandonCurrentGame()`, set `ui.snapshot = { gamesBefore, beads: new Map(...copies of every box's beads), newBoxes: new Set() }`.
  - **Filling**: at the end, add the keys of boxes that did not exist before to `newBoxes`.
  - **Clearing**: set `ui.snapshot = null` on reset, `switchRule` and `applyLoadedMenace`.
- [X] T056 [US6] Fill `compare.gained`, `compare.lost`, `compare.nothing` and `compare.newBox` in the copy deck of index.html.
  - Add `<section id="compare-section" aria-labelledby="compare-title" hidden>`, headed "What changed in the last training run?", between the learning-curve card and the drawer section (contracts/ui.md §"What changed?").
  - **Box picker**: a `<label>` and `<select>`, with the opening box first and then discovery order.
  - **Pictures**: two `matchboxSVG` pictures captioned "Before" and "After". For new boxes, Before is `E.startingBeads` for that box, and `compare.newBox` says so.
  - **Summary**: one sentence from `E.beadChanges` plus `BEAD_MARKS` names.
  - **When it shows**: render after each training run, and hide it while `ui.snapshot === null`.
- [X] T057 [US6] Run `node --test tests/engine/` and `node tests/browser/check.mjs --only=compare,training,perf,drawer,contrast,narrow-320` and fix every failure.

**Checkpoint**: all six stories work.

---

## Phase 9: Polish & cross-cutting concerns

**Purpose**: the guarantees that span stories: help-identical outcomes, performance, reduced motion, accessibility with the helps on, accuracy, and the human checks.

- [X] T058 [P] Add `help-identical` to tests/browser/checks/kid-help.mjs (FR-021, SC-008).
  - **Run A**: in the seeded tab, with both helps on (Step by step in One step at a time, the check pressing Next until each sequence ends), play 5 animated games against the Random mover, then press Run 100. Save MENACE and keep the file text, the record and every ledger.
  - **Run B**: reload the page (the harness re-applies the same seed to each new document) and repeat with both helps off.
  - **Assertion**: the two save files are identical, apart from any timestamp field.
- [X] T059 Add `help-perf` to tests/browser/checks/kid-help.mjs (FR-012, SC-005; plan §Performance Goals).
  - **Timing**: Run 500 against the Perfect player with both helps on, then (after Reset) with both off. The on run takes at most 1.1 × the off run.
  - **Picture speed**: `matchboxSVG` for the opening box averages under 2 ms over 100 calls.
  - **Drawer**: feature 001's `perf-drawer` still passes.
- [X] T060 [P] Add `reduced-motion` to tests/browser/checks/steps.mjs (FR-018, SC-007). Use `emulate({ reducedMotion: "reduce" })` from T001, turn on Step by step, and play one MENACE move including a turned box if one comes up. Sample `document.getAnimations().length` every 50 ms: it is always 0, and every step caption still appears.
- [X] T061 [P] Add `contrast-helps-light`, `contrast-helps-dark`, `keyboard-helps` and `narrow-320-helps` to tests/browser/checks/a11y.mjs (FR-017, FR-019, SC-007). They re-run the existing audits with both helps on and a step sequence paused at `lookup`, with a tip open, the story open and the compare panel visible. Fail on any contrast miss, any keyboard trap, or `document.documentElement.scrollWidth > 320`.
- [X] T062 Fix every failure from T058–T061 in index.html.
- [X] T063 Review every factual sentence in the copy deck of index.html against research K13 and feature 001 R14 (FR-020; contracts/copy-deck.md Rule 6). Correct any mismatch, and record the review date and result under K13 in specs/002-kid-friendly-matchboxes/research.md.
- [X] T064 Update specs/002-kid-friendly-matchboxes/quickstart.md §3 if any check name or method changed during implementation, for example adding `matchbox-empty` and the `*-helps` checks.
- [X] T065 Run the full suites, `node --test tests/engine/` and `node tests/browser/check.mjs`, with 0 failures. Save screenshots with `node tests/browser/check.mjs --screenshots=specs/002-kid-friendly-matchboxes/after`.
- [ ] T066 Run the manual checks in quickstart.md §4 and record the results there: SC-001–SC-003 with at least 5 children aged 8–12, including one who can't tell red from green, and a VoiceOver or NVDA pass of one game with both helps on. These need people, so the task stays open until they are done.

---

## Dependencies & execution order

### Phase dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: depends on Setup. It blocks every story.
- **US1 (Phase 3)**: depends on Foundational. It is the MVP.
- **US2 (Phase 4)** and **US3 (Phase 5)**: depend on US1 (matchbox picture, `ui.heldBack`). They are independent of each other: both use `runSequence`, but US2 hooks the move pause and US3 the `end` event.
- **US4 (Phase 6)**: depends on US2 (it extends the `lookup` frame and `moveStepFrames`).
- **US5 (Phase 7)**: depends on Foundational and US1. Its step and learning wording relies on the captions from US2 and US3 when those exist, but the tips, status messages and story work without them.
- **US6 (Phase 8)**: depends on US1 only (matchbox picture, plus training from feature 001).
- **Polish (Phase 9)**: depends on every story included in the release.

```text
Setup → Foundational → US1 ─┬─ US2 ── US4
                            ├─ US3
                            ├─ US5
                            └─ US6
                                       → Polish
```

### Within each story

- Tests first (they must fail), then the engine data or functions, then the UI helpers, then the wiring, then the story's verification run.
- Tasks in `index.html` run in ID order.

### Parallel opportunities

- **Setup**: T001, T002 and T003 (three different files).
- **Foundational**: T004 (copy.test.mjs) alongside T005–T011 (index.html).
- **US1**: T012, T013 and T014 (kid.test.mjs, matchboxes.mjs, a11y.mjs) together, then T015–T020 in order.
- **US2 / US3**: T022 and T030 (both in steps.mjs, so one after the other), alongside the index.html work of the other story.
- **US4**: T036 and T037 together.
- **US5**: T043 and T044 together.
- **US6**: T052 and T053 together.
- **Polish**: T058, T060 and T061 together (kid-help.mjs, steps.mjs, a11y.mjs). T059 follows T058 in the same file.
- **Across stories**: once US1 is done, the US3, US5 and US6 test files can be written while US2's index.html work goes on.

## Parallel example: User Story 1

```text
# The three US1 test tasks touch different files:
T012 tests/engine/kid.test.mjs         BEAD_MARKS, BEAD_DISPLAY_LIMIT, beadLayout
T013 tests/browser/checks/matchboxes.mjs   matchbox-counts, bead-marks, matchbox-empty
T014 tests/browser/checks/a11y.mjs     SVG text background in auditContrast
# Then, in order, in index.html:
T015 → T016 → T017 → T018 → T019 → T020 → T021
```

## Parallel example: User Story 6 (alongside US2)

```text
Developer A: T023 → T024 → T025 → T026   (US2, index.html)
Developer B: T052 kid.test.mjs + T053 kid-help.mjs   (US6 tests, written while A works)
```

## Implementation strategy

### MVP first (US1 only)

1. Phase 1 Setup, then Phase 2 Foundational.
2. Phase 3 (US1): matchboxes with countable beads, shape marks and the board marker.
3. **Stop and validate**: T021, plus feature 001's full suite. This already answers "show some matchboxes".

### Incremental delivery

1. US1, the matchboxes (MVP).
2. US2, the five steps, then US3, the beads going in and out. Together they are the core of "helps on the way".
3. US4, turned boxes and shared colours.
4. US5, simple words, tips and the story.
5. US6, before and after a training run.
6. Polish: help-identical, help-perf, reduced motion, accessibility with the helps on, the accuracy review, and the manual checks.

Each increment keeps feature 001's suite passing and leaves the helps off by default.

---

## Phase 10: Convergence

- [X] T067 Rewrite every two-sentence caption of the five steps as one sentence: in `STEP_TEXT` in the UI `<script>` of index.html (`tilt.text`, `lookup.turned`, `lookup.shared`, `lookup.turnedShared`) and in the copy deck (`steps.find.newBox`, `steps.tilt.text`, `steps.lookup.turned`, `steps.lookup.shared`, `steps.lookup.turnedShared`). Keep the deck's 15-word limit and the research K13 wording. Add a rule to tests/engine/copy.test.mjs that every `steps.find`, `steps.shake`, `steps.tilt`, `steps.lookup` and `steps.play` entry is exactly one sentence, and assert in `steps-order` (tests/browser/checks/steps.mjs) that each step caption shown is one sentence in both wordings, per FR-006, US2/AC1 (contradicts)
- [X] T068 Freeze the "After" side of "What changed?" at the end of the training run: in `finishSnapshot()` in index.html, copy every box's beads into the snapshot (for example `ui.snapshot.after`), and make `renderCompareBox()` and `compareSentence()` draw the After matchbox and the summary from those counts instead of the live `box.beads`, so games played after the run are not shown as changes "during the run". Extend `compare` in tests/browser/checks/kid-help.mjs to play one animated game after the run and assert that the After counts and the summary are unchanged, per FR-016, US6/AC1 (partial)
- [X] T069 Reword the copy deck's `learning.draw` in index.html so that it also says the move becomes a little more likely next time, in at most 2 sentences of at most 15 words each. Add an assertion to tests/engine/copy.test.mjs that every `learning` entry says how the move's chances change (more or less likely, or more or less often), per US3/AC4 (partial)
- [X] T070 Make the copy deck's `steps.lookup.turnedShared` in index.html also say that MENACE just picks one of the squares, as `steps.lookup.shared` does, keeping it to one sentence as T067 requires, per US4/AC2 (partial)
- [X] T071 With Simple words on, make the resigned entry in `renderBoxPanel()` in index.html use the copy deck's plain wording: `steps.empty.text`, or `steps.empty.opening` for the opening box, and a heading without "resigned". Keep the standard words byte-for-byte unchanged (FR-005), re-render the box panel from `onWordsChanged()`, and extend `matchbox-empty` in tests/browser/checks/matchboxes.mjs to check both wordings, per US1/AC6, FR-013 (partial)
