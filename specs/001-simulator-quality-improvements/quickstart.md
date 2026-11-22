# Quickstart: validating the MENACE simulator improvements

This is a run guide that proves the feature works from end to end. What is being checked is defined in [spec.md](./spec.md). The interfaces are defined in [contracts/](./contracts/) and the entities in [data-model.md](./data-model.md).

## Prerequisites

| Need | Why | Check |
| --- | --- | --- |
| Node.js ≥ 22 | Built-in `node --test`, global `WebSocket` and `fetch` | `node --version` |
| Google Chrome (or Chromium) | Browser checks over the DevTools Protocol | macOS default path: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`. Otherwise set `CHROME=/path/to/chrome`. |
| Nothing else | No `npm install`; the project has zero dependencies | — |

All commands run from the repository root.

## 1. Open the page

```sh
open index.html          # macOS; or double-click it. It must work from file:// with no network.
```

What you should see:

- The page looks as it did before.
- The controls card has two new things: a **Bead rule** control (with "Michie 1963" pressed) and the **Save MENACE…** and **Load MENACE…** buttons.
- A collapsed **The drawer** section sits below the learning curve.

## 2. Engine unit tests

```sh
node --test tests/engine/
```

Expected: all tests pass. They cover:

| Test file | Proves |
| --- | --- |
| `rules.test.mjs` | Both rules yield 304 boxes (1/12/108/183). Under `michie1963`, exactly 56 boxes have merged groups, the opening box has 3 colours × 4 beads, and representatives carry the starting beads 4/3/2/1. Under `perSquare`, every free square carries beads. Reinforcement is +3/+1/−1 with a floor at 0. (SC-008, FR-040) |
| `session.test.mjs` | Aborting during a pause, during a pending human move, or before the opponent replies leaves the drawer, beads and record unchanged. N completed games add exactly N to the record. Provisional boxes join the drawer only at commit. An empty opening box ends a game as a resignation at move 1. (SC-001, FR-001–FR-006) |
| `opponents.test.mjs` | Over 500 seeded games, the perfect player never misses an immediate win, prefers the quicker of two wins, and plays ≥ 2 different replies in every position where it has ties, across 50 encounters. (SC-005) |
| `save-file.test.mjs` | Train 1,000 seeded games, then check that `parseSave(serialize(m))` deep-equals `m`. The valid example in [save-file.md](./contracts/save-file.md) is accepted. Every fixture in `tests/fixtures/saves/invalid/` (≥ 10 files: not JSON, wrong format, version 2, non-canonical position, unreachable position, duplicate position, wrong move number, beads on an occupied square, beads on a non-representative, negative beads, totals ≠ outcomes, discovery gap) is rejected with its expected `code`. (SC-009, SC-010) |

## 3. Browser checks

```sh
node tests/browser/check.mjs            # add --headed to watch, --only=<name> to run one check
```

The script starts Chrome with a temporary profile, opens `file://…/index.html`, runs the checks below, and prints a pass/fail table. It exits non-zero on any failure.

| Check | How | Pass when | Spec |
| --- | --- | --- | --- |
| `document` | Evaluate `document.compatMode` and `documentElement.lang` | `CSS1Compat` and `en` | FR-014 |
| `interrupt-*` (4 variants) | Choose Random mover, wait 100–700 ms at random, then trigger New game / opponent switch / Reset (×2) / Run 20. Repeat 25× each. | Games played equals the number of games that finished, and is 0 straight after each reset | SC-001 |
| `training-stop` | Run 500, click Stop at once | Status says "stopped after k of 500" and games played rises by k | FR-005 |
| `contrast-light`, `contrast-dark` | Emulate each colour scheme. Fill boxes with all 9 bead colours (train 100), open the table and the drawer. For every visible text node, compute the colour and the effective background. | Every pair ≥ 4.5:1 (disabled controls ≥ 3:1) | SC-002 |
| `keyboard` | Human game: focus square 1, then press arrows and Enter for each move | `document.activeElement` is a board square after every move, and no Tab was needed | SC-003 |
| `labels` | Opponent = Random mover; read the `aria-label` of occupied squares | They contain "Random mover's cross", never "you" | FR-012 |
| `narrow-320` | Emulate a 320×740 screen. Train 40 games. | `scrollWidth ≤ clientWidth`, and every chart `<text>` is ≥ 10 px tall | SC-007 |
| `win-line` | Seeded game ending in a win | Three squares have class `win`, and the status names them | FR-019 |
| `table-persist` | Open the table, then play a game | The table is still open and has updated | FR-020 |
| `orientation` | Play until a step has `transformIndex ≠ 0` | The panel shows the notice naming the transform and the real board square | FR-008 |
| `rule-switch` | Train 20, switch rule → dialog → Cancel, then switch → confirm | Cancel changes nothing. Confirm gives a fresh MENACE, the new rule is named in the stats and the chart, and the opening box has 9 colours | US6 |
| `save-load` | Train 200, save, capture the download, reload the page, load the file through the file input, confirm | The drawer, beads, record, curve and rule match what was captured before saving | SC-009 |
| `load-reject` | Load each invalid fixture | A plain message is shown and the state is unchanged | SC-010 |
| `drawer` | Train 500, open the drawer, filter 7th + "Only empty", sort by Most beads | The count line matches the number of matching cards, the order is right, and "Used last game" is marked | FR-028–FR-033 |
| `no-network` | Record `Network.requestWillBeSent` events for the whole run | No request other than the page's own `file://` URL | FR-039 |

## 4. Manual checks (not automatable)

| Check | Steps | Pass when |
| --- | --- | --- |
| Screen reader (VoiceOver: ⌘F5) | Play a full human game, then watch one random-mover game | Each move and the result are heard once, and "shaking a box" / "thinking" are not spoken. The opponent selector reads as "Opponent". (FR-013, FR-016) |
| Box panel comprehension (SC-004) | Give 5 first-time viewers a finished game with a rotated box and ask "Which board square did MENACE's drawn bead lead to?" | At least 4 of 5 answer correctly |
| Drawer findability (SC-011) | Ask 5 first-time viewers to find all empty 7th-move boxes after a 500-game run | At least 4 of 5 do it within 30 s |
| Historical text (SC-006) | Compare each claim in "How MENACE works" with the [research R14 table](./research.md#r14-historical-text-fr-026-fr-027-sc-006) | Every claim matches a cited source, and Chambers is not credited with MENACE |
| Visual regression | Screenshot at 1280 px and 375 px before and after the change, in light and dark | Only the intended changes appear: standards-mode spacing, new controls, colours, drawer |

## 5. Done

The feature is complete when sections 2 and 3 pass with no failures and every row in section 4 passes.
