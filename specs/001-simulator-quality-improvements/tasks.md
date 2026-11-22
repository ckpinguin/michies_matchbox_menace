---

description: "Task list for MENACE Simulator Quality Improvements"
---

# Tasks: MENACE Simulator Quality Improvements

**Input**: Design documents from `/specs/001-simulator-quality-improvements/`

**Prerequisites**:

- [plan.md](./plan.md)
- [spec.md](./spec.md)
- [research.md](./research.md)
- [data-model.md](./data-model.md)
- [contracts/](./contracts/)
- [quickstart.md](./quickstart.md)

**Tests**: test tasks are **included** for every story.

- [Constitution](../../.specify/memory/constitution.md) Principle V makes engine tests mandatory for every engine change, overriding the template's "tests optional" default.
- The plan and quickstart define the test suites.
- Within each story, write the tests first and confirm they FAIL before implementing.

**Organization**: tasks are grouped by user story, so each story can be implemented and tested independently after the Foundational phase.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on unfinished tasks).
- **[Story]**: the user story the task belongs to (US1–US8, from spec.md).
- **Citations**: data-model constraints are cited as `data-model.md: Entity.field` instead of being restated.

## Path Conventions (from plan.md)

- **The product** is a single file: `index.html` at the repository root.
  - `<script id="menace-engine">` holds the pure engine.
  - The second `<script>` holds the UI layer.
- **Tooling and tests** live in `package.json` and under `tests/`. The page never loads them.
- **Refinement of the plan's structure**: browser checks are split into one module per area under `tests/browser/checks/`, all loaded by `tests/browser/check.mjs`. This lets check tasks for different stories run in parallel.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: test tooling with zero dependencies, plus a visual baseline of the *unmodified* page.

- [ ] T001 Create `package.json` at the repository root:
  - `"private": true`, with no `dependencies` or `devDependencies`.
  - Scripts: `"test": "node --test tests/engine/"` and `"check:browser": "node tests/browser/check.mjs"`.
  - `"engines": { "node": ">=22" }`.

  (Constitution: Technical Constraints → Development tooling)
- [ ] T002 [P] Create `tests/helpers/rng.mjs`. Export `mulberry32(seed)`, which returns a function producing floats in [0, 1), deterministically per seed.
- [ ] T003 [P] Create `tests/helpers/load-engine.mjs`. Export `loadEngine()`, which:
  - reads `index.html` (resolved relative to the helper file),
  - extracts the text of `<script id="menace-engine">…</script>`,
  - evaluates it with `node:vm` in a fresh context with no DOM globals,
  - returns `MenaceEngine`.

  It throws a clear error if the block is missing, which is expected until T010 (research R13).
- [ ] T004 [P] Create `tests/browser/cdp.mjs`, a minimal DevTools Protocol client with no dependencies:
  - **Launch and connect**: start Chrome (the `CHROME` env var, or the macOS default path from quickstart.md) with a temporary `--user-data-dir`, `--remote-debugging-port=0` and headless unless `--headed`. Read `DevToolsActivePort` and connect with the global `WebSocket`.
  - **Messaging**: `send(method, params)` returns a Promise; `on(event, fn)` subscribes to events.
  - **Helpers**: `open(url)`, `evaluate(expression, { awaitPromise })`, `emulate({ width, height, mobile, colorScheme })`, `setFileInput(selector, absPath)`, `setDownloadDir(dir)`, `screenshot(path)`, and `close()`, which also removes the profile.
- [ ] T005 Create the runner `tests/browser/check.mjs`. It depends on T004.
  - Imports every `tests/browser/checks/*.mjs`. Each module default-exports an array of `{ name, spec, run(ctx) }`.
  - Supports `--only=<comma-separated names or prefixes>`, `--headed` and `--screenshots=<dir>`.
  - Opens a fresh page at `file://<repo>/index.html` for each check.
  - Records `Network.requestWillBeSent` URLs into `ctx.requests`.
  - Prints a pass/fail table and exits non-zero on any failure.
- [ ] T006 Create `tests/browser/checks/document.mjs` with two checks. It depends on T005.
  - `document`: `compatMode === "CSS1Compat"` and `lang === "en"`.
  - `no-network`: across a 20-game training run, `ctx.requests` holds only the page's own `file://` URL.

  (FR-014, FR-039; quickstart §3)
- [ ] T007 Capture baseline screenshots of the **unmodified** `index.html` with `node tests/browser/check.mjs --only=document --screenshots=specs/001-simulator-quality-improvements/baseline/`. Take them at 1280×900 and 375×800, in light and dark appearance (research R8). The `document` check is expected to FAIL at this point.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: build the pure engine and its game-session model, which all stories rely on. The UI keeps today's behaviour, including the "one colour per square" bead rule.

**⚠️ CRITICAL**: no user story work can begin until this phase is complete.

- [ ] T008 [P] Write `tests/engine/rules.test.mjs`, using `loadEngine()` and `mulberry32`:
  - `reachablePositions().size === 304`, split 1/12/108/183 by move number.
  - `canonicalize` tie-breaks to the lowest transform index.
  - `checkWinner` returns `{ winner, line }`.
  - `moveGroups`:
    - under `perSquare`, every group has one square
    - under `michie1963`, exactly 56 boxes have a group with more than one square
    - the opening box has `[[0,2,6,8],[1,3,5,7],[4]]`
    - `....O...X` has `[[0],[1,3],[2,6],[5,7]]`
  - `startingBeads`: 4/3/2/1 on representatives only (`michie1963`) or on every free square (`perSquare`), and 0 on occupied squares.
  - `createMenace()` defaults: `beadRule === "michie1963"`, an empty drawer and a zero record.

  (quickstart §2; contracts/engine-api.md)
- [ ] T009 [P] Write `tests/engine/session.test.mjs`, covering contracts/engine-api.md §Playing a game, guarantees 1–3:
  - Aborting during `pause`, during a pending human `opponent`, or before the opponent replies leaves a deep-equal snapshot of the Menace unchanged.
  - A finished game commits exactly once.
  - Provisional boxes appear in `menace.boxes` only after commit, with `discoveryIndex` in discovery order.
  - 25 seeded games against `randomMove` add exactly 25 to the record.
  - The bead changes are +3/+1/−1 with a floor at 0.
  - An empty opening box leads to `resignedAt.moveNumber === 1` and an outcome of loss.
  - `commit` throws unless the game has `status === "finished"`.
- [ ] T010 Split the scripts in `index.html`.
  - Move the pure logic into a new `<script id="menace-engine">` that defines the global `MenaceEngine`: `LINES`, `TRANSFORMS`, `applyTransform`, `boardKey`, `canonicalize`, `drawBead(counts, rng)`, `randomMove(board, rng)`, `perfectMove(board, rng)` (existing algorithm for now) and `rollingSeries(outcomes, window)`.
  - The engine must not touch the DOM or use timers, `Math.random` or `Date` (contracts/engine-api.md, rules).
  - The UI `<script>` calls `MenaceEngine.*` and passes `Math.random` as `rng`.
  - No change in behaviour: play one game by hand to confirm.
- [ ] T011 Add the engine constants and board helpers in `index.html` (`menace-engine`), per contracts/engine-api.md §Constants and §Board helpers:
  - `TOTAL_BOXES`, `BEAD_RULES`, `DEFAULT_BEAD_RULE`, `START_BEADS`, `REINFORCE`, `TRANSFORM_NAMES` (research R4 table), `SAVE_FORMAT` and `SAVE_VERSION`.
  - `checkWinner(board)` returns `{ winner, line }`.
  - `canonicalize(board)` returns `{ key, transformIndex, T, board }`.
  - `reachablePositions()` is computed once and cached.

  Update the UI's callers of `checkWinner`.
- [ ] T012 Add the engine model in `index.html`: `createMenace({ beadRule })`, `moveGroups(canonicalBoard, beadRule)` (stabiliser orbits, research R3) and `startingBeads(positionKey, moveNumber, beadRule)`. Cited fields:
  - `data-model.md: Menace.beadRule, Menace.boxes, Menace.discoveryCount, Menace.record`
  - `data-model.md: Matchbox.positionKey, Matchbox.canonicalBoard, Matchbox.moveNumber, Matchbox.groups, Matchbox.beads, Matchbox.discoveryIndex`
  - `data-model.md: Record.gamesPlayed, Record.win, Record.draw, Record.loss, Record.outcomes`
- [ ] T013 Add the engine Game session and `chooseMove(menace, game, rng)` in `index.html`.
  - `chooseMove` returns a `MoveChoice` (`forced` / `resigned` / `bead`, contracts/engine-api.md §Menace) and never mutates `menace`.
  - It creates provisional boxes in `game.provisional`. *Task-specific narrowing:* `Matchbox.discoveryIndex` is tentative (`discoveryCount + k`) until commit.
  - It appends trajectory steps.
  - Cited fields:
    - `data-model.md: Game.id, Game.opponent, Game.board, Game.steps, Game.provisional, Game.signal, Game.status, Game.outcome, Game.winLine, Game.resignedAt`
    - `data-model.md: TrajectoryStep.positionKey, TrajectoryStep.transformIndex, TrajectoryStep.colorIdx, TrajectoryStep.groupSquares, TrajectoryStep.realIdx`
- [ ] T014 Add the engine `commit(menace, game)` in `index.html`, returning `BeadChange[]`. In order it:
  1. inserts provisional boxes in discovery order and fixes their `discoveryIndex`,
  2. applies `REINFORCE` with a floor at 0,
  3. appends the outcome to the record.

  It throws unless `game.status === "finished"`. Cited fields:
  - `data-model.md: BeadChange.positionKey, BeadChange.colorIdx, BeadChange.before, BeadChange.after`
  - `data-model.md: Menace.discoveryCount, Record.outcomes`
- [ ] T015 Add the engine `playGame({ menace, opponent, rng, signal, pause, onEvent })` in `index.html`, per contracts/engine-api.md §Playing a game.
  - Check `signal.aborted` after every `await`.
  - An abandoned game returns `{ status: "abandoned", game }` without committing. A finished game is committed and returns its `deltas`.
  - Emit the events `start`, `menace`, `opponent` and `end`.
- [ ] T016 Move the UI in `index.html` onto the engine model.
  - Replace `state.boxes`, `discoveryCount`, `gamesPlayed`, `tally` and `gameLog` with `state.menace`, created with `createMenace({ beadRule: "perSquare" })`. *Task-specific:* this keeps today's behaviour until US6 (T050) switches to `DEFAULT_BEAD_RULE`.
  - Run animated games through `MenaceEngine.playGame` with today's 450/350 ms delays and no abort yet. Store results in `ui.lastGame` (`data-model.md: ui.lastGame`).
  - Stats, chart and box panel read from `state.menace` and `ui.lastGame`. "Boxes discovered" counts committed boxes only.
  - Reset creates a fresh Menace with the same rule.
- [ ] T017 Checkpoint:
  - `node --test tests/engine/` passes (rules and session).
  - `node tests/browser/check.mjs --only=no-network` passes.
  - A manual game against each opponent still plays.
  - The `document` check is still expected to fail until US3.

**Checkpoint**: the engine and session model are in place. User stories can now begin.

---

## Phase 3: User Story 1 - Game records the visitor can trust (Priority: P1) 🎯 MVP

**Goal**: only one game is ever in progress. Interrupted games are discarded cleanly, training counts exactly, and stopping is reported honestly (FR-001–FR-006).

**Independent Test**: interrupt computer games at random moments with New game, an opponent switch, Reset and Run N. Games played must always equal the number of finished games, and nothing from before a reset may be counted after it (SC-001).

### Tests for User Story 1

> Write these first and confirm they FAIL before implementing.

- [ ] T018 [P] [US1] Create `tests/browser/checks/integrity.mjs` with the checks `interrupt-new-game`, `interrupt-opponent`, `interrupt-reset` and `interrupt-train`. Each picks Random mover, waits a random 100–700 ms, then interrupts, 25 trials per check. Add `training-stop`: Run 500, Stop at once, then the status reads "stopped after k of 500" and games played rose by k. (quickstart §3)

### Implementation for User Story 1

- [ ] T019 [US1] Add the game controller in `index.html` (research R1).
  - One `currentGame` with its own `AbortController`, and `abandonCurrentGame()`.
  - An abortable `pause(ms, signal)`.
  - A human-opponent promise that resolves `null` on abort.
  - New game, opponent switch, Reset (after its click-again confirmation) and Run N all call `abandonCurrentGame()` before starting.
  - Remove the old `playGame` / `startNewGame` state writes.

  (FR-001–FR-003)
- [ ] T020 [US1] Rewrite the training loop in `index.html` (research R2).
  - Slices of at most 12 ms of engine work, yielding with `setTimeout(0)`.
  - Render the stats and chart once per slice.
  - Check a Stop flag between games.
  - Final status: "Training finished: N games." or "Training stopped after k of N games."

  (`data-model.md: ui.training`) (FR-004, FR-005)
- [ ] T021 [US1] Handle the empty opening box in `index.html`. When a game ends with `resignedAt.moveNumber === 1` (`data-model.md: Game.resignedAt`):
  - Show a persistent status saying that MENACE has no opening moves left and needs a reset.
  - Auto-stop training with that reason.

  (FR-006, FR-004 as amended)
- [ ] T022 [US1] Validate US1: `node --test tests/engine/session.test.mjs` and `node tests/browser/check.mjs --only=interrupt,training-stop` pass.

**Checkpoint**: User Story 1 is complete. This is the MVP: the statistics can now be trusted.

---

## Phase 4: User Story 2 - Understanding what a matchbox shows (Priority: P2)

**Goal**: the box panel uses the board's symbols, explains rotated or mirrored boxes, and names squares without ambiguity (FR-007–FR-009).

**Independent Test**: play until a box is shown rotated or mirrored. The panel uses ◯/✕, shows the orientation notice and names the real board square played. 4 of 5 first-time viewers identify that square (SC-004).

### Tests for User Story 2

- [ ] T023 [P] [US2] Extend `tests/engine/rules.test.mjs`:
  - For every transform, `chooseMove(...).realIdx === T[colorIdx]`.
  - Each `TRANSFORM_NAMES[i]` matches its direction. For example, under transform 1 the real board's bottom-left square appears at box square 1, which is "rotated 90° clockwise" (research R4).
- [ ] T024 [P] [US2] Create `tests/browser/checks/box-panel.mjs` with two checks:
  - `orientation`: play until a step has `transformIndex ≠ 0`, then the notice names the transform and the real board square.
  - `glyphs`: no position code contains `X` or `O`.

### Implementation for User Story 2

- [ ] T025 [US2] Add `glyph(mark)` in the `index.html` UI, mapping `X`→◯, `O`→✕ and empty→·. Use it for the position code and the mini-boards, and add the legend line "◯ MENACE · ✕ opponent · · empty" (contracts/ui.md §Box panel). (FR-007)
- [ ] T026 [US2] Add the orientation notice to the `index.html` box panel. When `step.transformIndex ≠ 0`, show "This box shows the board ‹TRANSFORM_NAMES[i]›. The bead for box square c was played on board square r." (FR-008)
- [ ] T027 [US2] Qualify square labels in `index.html`.
  - Use "board square n" in the status line and "box square n" in the panel.
  - The ledger gets one row per move group: "box square c (same as d, e) — k beads", followed by the ± badge (`data-model.md: Matchbox.groups`).

  (FR-009)
- [ ] T028 [US2] Validate US2: `node --test tests/engine/rules.test.mjs` and `--only=orientation,glyphs` pass. Then run the manual SC-004 comprehension check (quickstart §4).

**Checkpoint**: User Story 2 works independently.

---

## Phase 5: User Story 3 - Readable and usable for everyone (Priority: P2)

**Goal**:

- standards-mode document with its language declared
- WCAG AA contrast in both themes
- keyboard play without losing focus
- correct spoken labels and announcements
- a chart that stays legible at 320 px

(FR-010–FR-016)

**Independent Test**: the contrast checks, keyboard play, a screen-reader pass and the 320 px layout (SC-002, SC-003, SC-007).

### Tests for User Story 3

- [ ] T029 [P] [US3] Create `tests/browser/checks/a11y.mjs` with five checks:
  - `contrast-light` and `contrast-dark`: emulate the colour scheme, train 100 games, and open the table and the drawer if present. For every visible text node, including SVG `<text>`, the colour against the effective background found by walking up ancestors must be ≥ 4.5:1. Disabled controls need only ≥ 3:1.
  - `keyboard`: after each Arrow/Enter move, `document.activeElement` is a board square.
  - `labels`: occupied squares say "Random mover's cross", never "you".
  - `narrow-320`: at 320×740, `scrollWidth ≤ clientWidth` and chart `<text>` is ≥ 10 px tall.

  (quickstart §3)

### Implementation for User Story 3

- [ ] T030 [US3] Add the document skeleton in `index.html`: `<!doctype html>`, `<html lang="en">`, a `<head>` (charset, viewport, title, `<meta name="description">`, `<style>`) and a `<body>` wrapping the markup and scripts. Compare with the baseline in `specs/001-simulator-quality-improvements/baseline/` and fix any spacing regressions. (FR-014; research R8)
- [ ] T031 [US3] Update the contrast tokens in the `index.html` `<style>`, using the values in the research R6 tables.
  - Change `--ink-muted`.
  - Add `--brass-ink`, `--status-good-ink`, `--status-warning-ink` and `--status-critical-ink`.
  - Adjust the affected `--cat-N` values and add `--cat-N-ink`.
  - Define them in all four theme blocks: `:root`, `@media (prefers-color-scheme: dark) :root`, `:root[data-theme="light"]` and `:root[data-theme="dark"]`.
  - Apply them: `--brass-ink` to eyebrow text, `--status-*-ink` to the `.delta` badges and the resigned eyebrow, and `--cat-N-ink` to `.bead-chip` text.

  (FR-010)
- [ ] T032 [US3] Rework the board in `index.html` (research R7; contracts/ui.md §Board).
  - Create the 9 square buttons once, in `role="grid"` rows, and update them in place.
  - Use `aria-disabled` instead of `disabled`.
  - Roving tabindex: arrow keys wrap at the edges, Home/End jump to squares 1 and 9, and Enter/Space plays (`data-model.md: ui.focusSquare`).

  (FR-011)
- [ ] T033 [US3] Fix labels in `index.html`.
  - Square labels: "Board square n, empty", "…, MENACE's nought", "…, ‹display name›'s cross", or "…, your cross" for the human. Display names follow `data-model.md: Opponent` (FR-012).
  - The opponent group gets `aria-labelledby` pointing at its visible "Opponent" label (FR-013).
- [ ] T034 [US3] Control live announcements in `index.html` with `setStatus(text, { announce })`. "Shaking a box" and "thinking" are visible only. Moves, results, training start and end, and save/load messages are spoken (contracts/ui.md §Status line). (FR-016)
- [ ] T035 [US3] Make the chart responsive in `index.html` (research R9).
  - `ResizeObserver` plus `requestAnimationFrame`; the SVG is drawn at the container's real pixel width.
  - 11 px text.
  - Height 240 px, or 200 px below 480 px wide.
  - Padding so the end-point labels never clip.

  (FR-015)
- [ ] T036 [US3] Validate US3: `node tests/browser/check.mjs --only=document,contrast,keyboard,labels,narrow-320` passes. Then do a manual VoiceOver pass of a human game and a random-mover game (quickstart §4).

**Checkpoint**: User Story 3 works independently.

---

## Phase 6: User Story 4 - Opponents and feedback that behave as described (Priority: P3)

**Goal**: a perfect player that takes immediate wins and varies its play, a highlighted winning line, and a table that stays open with clear labels (FR-017–FR-020).

**Independent Test**: 500 seeded games against the perfect player (SC-005), plus the `win-line` and `table-persist` checks.

### Tests for User Story 4

- [ ] T037 [P] [US4] Create `tests/engine/opponents.test.mjs`:
  - Across 500 seeded games the perfect player never misses an immediate win.
  - It prefers the quicker of two wins.
  - It plays ≥ 2 different replies in every position where it has ties, across 50 encounters.
  - `tableRows(series, 10)` reports each range's rate as at its last game.
- [ ] T038 [P] [US4] Create `tests/browser/checks/feedback.mjs` with two checks:
  - `win-line`: in a seeded winning game, three squares have the class `win` and the status names them.
  - `table-persist`: the table is opened, a game is played, and the table is still open and updated.

### Implementation for User Story 4

- [ ] T039 [US4] Rewrite `perfectMove` in the `index.html` engine (research R5).
  - Depth-aware scores of ±(10 − plies).
  - Memoise only the score, keyed by `(boardKey, player)`.
  - Choose uniformly among the best replies using `rng`.
  - Never clear the memo on reset.

  (FR-017, FR-018)
- [ ] T040 [US4] Highlight the winning line in `index.html`.
  - Squares in `game.winLine` get the class `win`: outline plus tint, with no animation under `prefers-reduced-motion`.
  - Their label gets the suffix ", winning line".
  - The result message names the winner and the squares (`data-model.md: Game.winLine`).

  (FR-019)
- [ ] T041 [US4] Fix the learning-curve table in `index.html`.
  - Add the engine function `tableRows(series, 10)`.
  - `ui.tableOpen` persists across re-renders.
  - Caption and headers follow contracts/ui.md §Learning curve.

  (`data-model.md: ui.tableOpen, Record.outcomes`) (FR-020)
- [ ] T042 [US4] Validate US4: `node --test tests/engine/opponents.test.mjs` and `--only=win-line,table-persist` pass.

**Checkpoint**: User Story 4 works independently.

---

## Phase 7: User Story 5 - A historically accurate explanation (Priority: P3)

**Goal**: every historical claim on the page is sourced. Chambers is no longer credited with MENACE, the dates are corrected, and both bead rules are described accurately (FR-026, FR-027).

**Independent Test**: compare the page text with the research R14 table and its sources (SC-006).

- [ ] T043 [US5] Rewrite the history paragraphs in "How MENACE works" in `index.html`, following research R14 rows 1, 2, 7 and 8:
  - the Testery/Newmanry/Good/Turing wording
  - Chambers removed as a MENACE builder
  - the tournament figures, if desired
  - 1965 (Experimental Programming Unit) and 1966 (Department)

  (FR-026)
- [ ] T044 [US5] Add a bead-rule paragraph in `index.html`. It describes Michie's 1963 shared-colour rule and the one-per-square rule, says which one Michie used and which one the page uses, and makes the "same rules" claim accurate (research R14 rows 4 and 9). (FR-027)
- [ ] T045 [US5] Validate US5: check every claim in the "How MENACE works" section of `index.html` against the sources in the R14 table of `specs/001-simulator-quality-improvements/research.md` (quickstart §4, SC-006).

**Checkpoint**: User Story 5 works independently.

---

## Phase 8: User Story 6 - Choosing the bead rule (Priority: P3)

**Goal**: the visitor chooses between Michie's 1963 rule (the default) and one colour per square. Changing the rule needs confirmation and starts a fresh MENACE, and the rule in use is always shown (FR-021–FR-025).

**Independent Test**: under Michie 1963 the opening box has 3 colours; under one per square it has 9. The rule switch confirms or cancels correctly, and the rule is named in the stats and the chart (SC-008).

### Tests for User Story 6

- [ ] T046 [P] [US6] Extend `tests/engine/session.test.mjs`. Under `michie1963`:
  - `chooseMove` draws only representatives and plays `T[rep]`.
  - `step.groupSquares` lists the bead's group.
  - Reinforcement changes only the representative's beads.

  Under `perSquare` behaviour is unchanged.
- [ ] T047 [P] [US6] Create `tests/browser/checks/bead-rule.mjs` with a `rule-switch` check: train 20, switch rule → Cancel changes nothing → switch again and confirm → a fresh MENACE whose stats and chart name the new rule, and whose opening box has 9 colours (quickstart §3).

### Implementation for User Story 6

- [ ] T048 [US6] Check the `michie1963` path through the `index.html` engine's `chooseMove`.
  - `step.groupSquares` comes from `box.groups`.
  - `drawBead` can only return representatives, because non-representatives hold 0.
  - Fix any gaps left by T013.

  (`data-model.md: Matchbox.groups, Matchbox.beads, TrajectoryStep.groupSquares`)
- [ ] T049 [US6] Build the confirmation dialog in `index.html` (research R10; contracts/ui.md §Confirmation dialog).
  - One native `<dialog>`, opened with `showModal()`.
  - `aria-labelledby` and `aria-describedby`; initial focus on Cancel; Esc cancels; focus returns to the opener.
  - API: `confirmDialog({ title, body, actions })` returns `Promise<actionId>`.

  US8 reuses it.
- [ ] T050 [US6] Add the bead-rule control to the controls card in `index.html`.
  - A group with `aria-labelledby` pointing at its "Bead rule" label.
  - Buttons "Michie 1963" and "One per square", with `aria-pressed`, and a one-line hint.
  - The page now creates its Menace with `DEFAULT_BEAD_RULE`, replacing T016's `"perSquare"` (`data-model.md: Menace.beadRule, BeadRule`).

  (FR-021, FR-022)
- [ ] T051 [US6] Add the rule-change flow in `index.html`, following data-model.md's Menace lifecycle.
  - A Fresh MENACE switches at once.
  - Otherwise show `confirmDialog` with Cancel and "Switch and start fresh".
  - On confirm: `abandonCurrentGame()`, then `createMenace(newRule)`, clear `ui.lastGame`, re-render and start a new game.

  (FR-024)
- [ ] T052 [US6] Show the rule in `index.html`: a stat tile reading "Bead rule: Michie 1963" or "Bead rule: one per square", and the chart eyebrow "Rolling last 20 games · ‹rule› rule". (FR-025)
- [ ] T053 [US6] Update the box panel and text in `index.html` for the Michie rule.
  - Non-representative group members show a hollow chip in the representative's colour, with no number. The ledger uses its "same as" rows (from T027 if US2 is done; otherwise add them here).
  - If US5 is done, update its bead-rule sentence (T044) to refer to the new control.

  (FR-027)
- [ ] T054 [US6] Validate US6: `node --test tests/engine/` and `--only=rule-switch` pass. By hand, check that the opening box has 3 colours under Michie 1963 and 9 under one per square.

**Checkpoint**: User Story 6 works independently.

---

## Phase 9: User Story 7 - Browsing the whole drawer (Priority: P3)

**Goal**: a collapsible view listing every discovered box, with filters, sorting, badges and empty states (FR-028–FR-033).

**Independent Test**: after 500 games, filter to 7th move plus "Only empty" and sort by most beads. The count, order and "Used last game" marks are correct (SC-011).

### Tests for User Story 7

- [ ] T055 [P] [US7] Create `tests/browser/checks/drawer.mjs` with a `drawer` check: train 500, open the drawer, apply 7th + "Only empty boxes", sort by "Most beads". The count line must equal the number of cards, the order must be descending, "Used last game" must match `ui.lastGame.steps`, and the no-match empty state must appear for an impossible filter. (quickstart §3)

### Implementation for User Story 7

- [ ] T056 [US7] Add the drawer section to `index.html`, between the learning curve and "How MENACE works":
  - a `<section aria-labelledby>` with the heading "The drawer"
  - a disclosure button "Open the drawer · n boxes" with `aria-expanded` and `aria-controls`
  - collapsed by default

  (contracts/ui.md §Drawer view; FR-028)
- [ ] T057 [US7] Add the drawer controls in `index.html`: a `<fieldset>` of Move radios (All, 1st, 3rd, 5th, 7th), an "Only empty boxes" checkbox, and a labelled Sort `<select>` (Discovery order, Most beads, Fewest beads). (`data-model.md: ui.drawer.open, ui.drawer.move, ui.drawer.emptyOnly, ui.drawer.sort`) (FR-029, FR-030)
- [ ] T058 [US7] Add the drawer cards in `index.html`: a `<ul>` of `<li>` built with a compact variant of the box-card renderer (`boxCardHTML`). Each card has:
  - the heading "Box #i · kth move · b beads"
  - an `aria-hidden` mini-board with an sr-only bead list
  - the badges "Used last game" (from `ui.lastGame.steps`) and "Empty: MENACE resigns here"

  (`data-model.md: Matchbox.discoveryIndex, Matchbox.moveNumber, Matchbox.beads`) (FR-028, FR-031)
- [ ] T059 [US7] Add the count line and empty states in `index.html`.
  - "Showing n of m discovered boxes", announced politely only after a filter or sort change.
  - The no-box and no-match messages from contracts/ui.md.

  (FR-029, FR-033)
- [ ] T060 [US7] Wire drawer updates in `index.html`: re-render after every commit and once per training slice (T020), only while the drawer is open. (FR-032)
- [ ] T061 [US7] Validate US7: `node tests/browser/check.mjs --only=drawer` passes. Then run the manual SC-011 findability check (quickstart §4).

**Checkpoint**: User Story 7 works independently.

---

## Phase 10: User Story 8 - Saving and restoring a trained MENACE (Priority: P4)

**Goal**: save the MENACE to a local file and load it back exactly. Invalid files are rejected whole and nothing is sent anywhere (FR-034–FR-039).

**Independent Test**: train 1,000 games, save, reload and load. Everything matches (SC-009), and every invalid fixture is rejected with the state unchanged (SC-010).

### Tests for User Story 8

- [ ] T062 [P] [US8] Create two valid fixtures:
  - `tests/fixtures/saves/valid/example-michie1963.json`: exactly the example in contracts/save-file.md.
  - `tests/fixtures/saves/valid/per-square.json`: a small, internally consistent `perSquare` save.
- [ ] T063 [P] [US8] Create ≥ 12 invalid fixtures in `tests/fixtures/saves/invalid/`, named `<code>--<case>.json`, where the prefix is the expected rejection code from contracts/engine-api.md. Each fixture is the valid example with exactly one defect:
  - `not-json`
  - `not-menace`
  - `unsupported-version` (version 2)
  - `bad-structure`
  - `bad-record` (totals ≠ outcomes)
  - `bad-position`: non-canonical `X...O....`, unreachable, and duplicate
  - `bad-move-number`
  - `bad-beads`: occupied square, non-representative under `michie1963`, negative, and over the bound
  - `bad-discovery` (a gap)
- [ ] T064 [P] [US8] Create `tests/engine/save-file.test.mjs`:
  - After 1,000 seeded games, `parseSave(serialize(m))` deep-equals `m`: rule, boxes and record.
  - Both valid fixtures are accepted.
  - Each invalid fixture is rejected with its filename's prefix code.
  - A text over 5 MB, generated in memory, gives `too-large`.
  - `parseSave` never throws across 200 seeded random mutations of the valid example.

  (quickstart §2)
- [ ] T065 [P] [US8] Create `tests/browser/checks/save-load.mjs` with two checks:
  - `save-load`: train 200, then `setDownloadDir`, save, reload, `setFileInput` and confirm. The drawer, beads, record, curve and rule all match.
  - `load-reject`: each invalid fixture shows a plain message and leaves the state unchanged.

### Implementation for User Story 8

- [ ] T066 [US8] Add the engine `serialize(menace, { now })` in `index.html`, producing 2-space JSON per contracts/save-file.md. Cited fields:
  - `data-model.md: Saved MENACE; Menace.beadRule`
  - `data-model.md: Record.gamesPlayed, Record.win, Record.draw, Record.loss, Record.outcomes`
  - `data-model.md: Matchbox.positionKey, Matchbox.moveNumber, Matchbox.discoveryIndex, Matchbox.beads`
- [ ] T067 [US8] Add the engine `parseSave(text)` in `index.html`.
  - Structural checks first, then the semantic rules in contracts/save-file.md, returning the codes from contracts/engine-api.md.
  - Derive `groups` from the position and the rule.
  - Return a Menace only when every check passes.

  Cited fields:
  - `data-model.md: Matchbox.positionKey, Matchbox.moveNumber, Matchbox.beads, Matchbox.discoveryIndex`
  - `data-model.md: Record.gamesPlayed, Record.outcomes, Menace.beadRule`
- [ ] T068 [US8] Add the "Save MENACE…" button to the controls card in `index.html`.
  - Build a `Blob`, give it an object URL and click a temporary `<a download>` named `menace-<rule>-<games>-games-<YYYY-MM-DD>.json`.
  - Speak "Saved MENACE: N games".
  - Disable it during training.

  (FR-034)
- [ ] T069 [US8] Add loading in `index.html`: a "Load MENACE…" button and a hidden `<input type="file" accept=".json,application/json">`.
  - Reject files over 5 MB before reading them.
  - Run `parseSave`. A failure shows a plain rejection message and leaves the state untouched.
  - A success shows `confirmDialog` (T049; build it here first if US6 isn't done) comparing the two MENACEs. Skip the dialog when the current MENACE is Fresh.
  - On Replace: `abandonCurrentGame()`, replace the Menace, announce the rule switch if the rule differs, clear `ui.lastGame`, re-render and start a new game.

  (FR-035–FR-038)
- [ ] T070 [US8] If US6 is done, add a "Save MENACE…" action to the rule-change dialog (T051) in `index.html`. Saving keeps the dialog open. (FR-024)
- [ ] T071 [US8] Update text in `index.html`:
  - The footer privacy text from research R15 (FR-039).
  - The empty-opening-box message (T021) now also offers "or load a saved MENACE".
- [ ] T072 [US8] Validate US8: `node --test tests/engine/save-file.test.mjs` and `--only=save-load,load-reject,no-network` pass.

**Checkpoint**: all user stories work independently.

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: performance budgets, a page-wide accessibility sweep, visual regression, documentation and the constitution's Definition of Done.

- [ ] T073 [P] Create `tests/browser/checks/performance.mjs` for the budgets in plan.md and the constitution's Technical Constraints:
  - A 500-game run against the perfect player takes < 3 s.
  - `PerformanceObserver('longtask')` sees no task > 50 ms during training.
  - Opening the drawer with all discovered boxes renders in < 16 ms.
  - Saving or loading a 10,000-game MENACE takes < 200 ms.
- [ ] T074 Run the FR-041 sweep: re-run `--only=contrast,keyboard,narrow-320` with the drawer open, with the dialog open, and with the new controls focused. Fix any failures in `index.html`.
- [ ] T075 Run the visual regression: screenshots at 1280 px and 375 px, light and dark, compared with `specs/001-simulator-quality-improvements/baseline/`. Only the intended changes may appear (FR-042).
- [ ] T076 [P] Update the Constitution Check in `specs/001-simulator-quality-improvements/plan.md` to cite constitution Principles I–V instead of the provisional gates G1–G5. This is the constitution v1.0.0 follow-up.
- [ ] T077 Run the full `specs/001-simulator-quality-improvements/quickstart.md`:
  - `node --test tests/engine/` passes.
  - `node tests/browser/check.mjs` passes every check.
  - Every manual check in §4 passes.

  Then confirm each item of the constitution's Definition of Done.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
  - T005 depends on T004; T006 and T007 depend on T005.
  - **T007 must run before any change to `index.html`.**
- **Foundational (Phase 2)**: depends on Setup and blocks every user story.
  - Order: T010 → T011 → T012 → T013 → T014 → T015 → T016 → T017.
  - T008 and T009 can be written alongside, against the contract.
- **User Stories (Phases 3–10)**: each depends only on Foundational, with the soft links listed below.
- **Polish (Phase 11)**: depends on all the stories you choose to deliver.

### User Story Dependencies

- **US1 (P1)**: Foundational only. **MVP.**
- **US2 (P2)**: Foundational only.
- **US3 (P2)**: Foundational only.
- **US4 (P3)**: Foundational only.
- **US5 (P3)**: Foundational only. T044 describes the rule the page uses *at the time*.
- **US6 (P3)**: Foundational only.
  - T053 reuses T027's ledger rows if US2 is done, otherwise adds them.
  - T053 updates T044's text if US5 is done.
- **US7 (P3)**: Foundational only.
  - T060 also hooks into T020's training slices if US1 is done; otherwise it uses T016's render path.
- **US8 (P4)**: Foundational only.
  - T069 reuses T049's dialog, or builds it first if US6 isn't done.
  - T070 applies only if US6 is done.
  - T071 edits T021's message if US1 is done.

### Within Each User Story

- Write the tests first ([P] tasks in separate files) and confirm they fail.
- Then do the engine changes, then the UI wiring, then the story's validation task.
- Every implementation task edits `index.html`, so within a story they run in order.

### Parallel Opportunities

- **Setup**: T002, T003 and T004 can run in parallel.
- **Foundational**: T008 and T009 can run in parallel with each other and with T010–T016.
- **Per story**: the test, check and fixture tasks marked [P] can run in parallel:
  - US2: T023, T024
  - US4: T037, T038
  - US6: T046, T047
  - US8: T062–T065
- **Across stories**: test and check modules for different stories can be written in parallel. Implementation is **effectively serial**, because it all lives in the single file `index.html` (constitution Principle I). If several people work at once, give each story's `index.html` work to one person at a time.

---

## Parallel Examples

```bash
# Setup
Task: "T002 Create tests/helpers/rng.mjs"
Task: "T003 Create tests/helpers/load-engine.mjs"
Task: "T004 Create tests/browser/cdp.mjs"

# Foundational: write both engine test files while T010–T016 proceed
Task: "T008 Write tests/engine/rules.test.mjs"
Task: "T009 Write tests/engine/session.test.mjs"

# User Story 1
Task: "T018 Create tests/browser/checks/integrity.mjs"

# User Story 2
Task: "T023 Extend tests/engine/rules.test.mjs (orientation)"
Task: "T024 Create tests/browser/checks/box-panel.mjs"

# User Story 3
Task: "T029 Create tests/browser/checks/a11y.mjs"

# User Story 4
Task: "T037 Create tests/engine/opponents.test.mjs"
Task: "T038 Create tests/browser/checks/feedback.mjs"

# User Story 6
Task: "T046 Extend tests/engine/session.test.mjs (michie1963)"
Task: "T047 Create tests/browser/checks/bead-rule.mjs"

# User Story 7
Task: "T055 Create tests/browser/checks/drawer.mjs"

# User Story 8: fixtures and tests together
Task: "T062 Create tests/fixtures/saves/valid/*.json"
Task: "T063 Create tests/fixtures/saves/invalid/*.json"
Task: "T064 Create tests/engine/save-file.test.mjs"
Task: "T065 Create tests/browser/checks/save-load.mjs"

# Polish
Task: "T073 Create tests/browser/checks/performance.mjs"
Task: "T076 Update plan.md Constitution Check"
```

---

## Implementation Strategy

### MVP first (User Story 1 only)

1. Phase 1: Setup. Capture the baseline (T007) before touching `index.html`.
2. Phase 2: Foundational. The engine and session model; the page behaves as before.
3. Phase 3: US1. Clean abandonment and honest training counts.
4. **Stop and validate**: T022. The statistics can now be trusted, which was the most serious defect found.

### Incremental delivery (suggested order)

| Step | Story | What it delivers |
| --- | --- | --- |
| 1 | US1 (P1) | Trustworthy record. MVP. |
| 2 | US3 (P2) | Accessibility and standards mode, early, so that later UI work is built on the final tokens and board semantics. |
| 3 | US2 (P2) | A box panel people can understand. |
| 4 | US4 (P3) | Opponent and feedback polish. |
| 5 | US5 (P3) | Corrected history text. |
| 6 | US6 (P3) | The bead-rule choice. Michie 1963 becomes the default. |
| 7 | US7 (P3) | The drawer view. |
| 8 | US8 (P4) | Save and restore. Then Polish. |

Each step ends with its validation task and can be shipped on its own.

### Notes

- **[P]** means a different file with no dependency on unfinished tasks. **[USn]** maps a task to its spec user story.
- Under constitution Principle V, every engine change comes with tests. Under the Definition of Done, browser checks pass before a story counts as complete.
- The project is not a git repository. If it becomes one, commit after each validation task.
- Avoid editing `index.html` from two tasks at once, and avoid letting a story depend on another story's unfinished work. The soft links listed above are the only allowed exceptions.
