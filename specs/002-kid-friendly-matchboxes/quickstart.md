# Quickstart: validating "Matchboxes a Kid Can Follow"

This is a run guide that proves the feature works from end to end.

- What is checked: [spec.md](./spec.md)
- The interfaces: [contracts/](./contracts/)
- The entities: [data-model.md](./data-model.md)

Feature 001's [quickstart](../001-simulator-quality-improvements/quickstart.md) must keep passing as well.

## Prerequisites

The same as feature 001: Node.js ≥ 22 and Google Chrome or Chromium (`CHROME=/path` if it isn't at the default path). Nothing to install.

## 1. Open the page

```sh
open index.html
```

What you should see:

- The box panel shows a **matchbox** next to each box's detail. Its face shows the position, and its tray holds countable beads, each with a shape.
- The controls card has a **Helps** group: **Step by step** and **Simple words**, both off.
- A collapsed **How MENACE learns: the picture story** section sits before "How MENACE works".

## 2. Engine and copy-deck tests

```sh
node --test tests/engine/
```

Expected: all tests pass, including feature 001's.

| Test file | Proves |
| --- | --- |
| `kid.test.mjs` | `PICTURE_MATRICES` map every box square onto `TRANSFORMS[t][i]` for all 8 transforms. `BEAD_MARKS` are 9 unique colour names and shapes. `beadLayout` keeps totals and switches to a heap above 12. `beadChanges` picks the largest gain and loss, with ties broken. |
| `copy.test.mjs` | Every simple-words sentence has 15 words or fewer, with no unexplained word-list term. The story has 6 or fewer panels of 2 or fewer sentences each and covers the process. Every FR-014 event has a tip. (FR-013–FR-015, SC-006) |

## 3. Browser checks

```sh
node tests/browser/check.mjs --only=matchbox,steps,learning,turned,shared-colour-markers,tips,simple-words,story,compare,help,reduced-motion
node tests/browser/check.mjs     # the full suite, including feature 001's checks
```

| Check | How | Pass when | Spec |
| --- | --- | --- | --- |
| `matchbox-counts` | Play 10 games against the Random mover. After each MENACE move and each game, compare every matchbox's tray with the box's beads. | Individual beads (≤ 12) or heap counts add up to the real totals, always | FR-001, FR-002, SC-004 |
| `bead-marks` | Read the marks on the beads and on the board marker for the drawn bead | Same colour and same shape. No two colours share a shape. | FR-003, FR-004 |
| `steps-order` | Step by step on, One step at a time. Watch MENACE's move and press Next 4 times. | Steps 1–5 appear in order with captions. MENACE's ◯ appears only at step 5. | FR-006, FR-007 |
| `steps-auto` | Play by itself | Each step is visible for at least 2 s, and Pause holds the current step | FR-007 |
| `steps-interrupt` | Press New game during step 3 | The steps vanish, nothing is recorded, and a new game starts | FR-011 |
| `learning-beads` | Step by step on: one game MENACE wins and one it loses | The beads moving in or out of each box equal its `BeadChange` (+3 / −1), and the trays end at the committed counts | FR-008 |
| `turned-box` | Play until a step has `transformIndex ≠ 0` | The face ends at `PICTURE_MATRICES[t]`, and the marker lands on `realIdx` | FR-009 |
| `shared-colour-markers` | Michie 1963, opening box with a corner or edge bead | At `lookup` all squares of the group show the marker; after `play`, only the played square has the ◯ | FR-010 |
| `tips-once` | Simple words on. Trigger each event twice. | Each tip appears exactly once and closes with Got it or Esc | FR-014 |
| `simple-words-text` | Simple words on, one game | Every status message and caption shown comes from the copy deck | FR-013 |
| `story` | Open the picture story | 6 or fewer panels, each with a labelled picture and 2 or fewer sentences | FR-015 |
| `compare` | Run 100 games, open What changed? | Before and after match the snapshot and the live box, and the sentence names the colour that gained most | FR-016 |
| `help-identical` | Seeded: 100 training games plus 5 animated games, once with both helps on and once with both off | Identical record and identical beads in every box | FR-021, SC-008 |
| `help-perf` | Run 500 against the perfect player with the helps on, then off | On ≤ 1.1 × off | FR-012, SC-005 |
| `reduced-motion` | Emulate `prefers-reduced-motion: reduce`, Step by step on, one move | `document.getAnimations()` is empty throughout, and every caption still appears | FR-018 |
| feature 001's `contrast-*`, `keyboard*`, `narrow-320*` | Re-run with both helps on and a step sequence open | All pass | FR-017, FR-019, SC-007 |

## 4. Manual checks (not automatable)

| Check | Steps | Pass when |
| --- | --- | --- |
| How MENACE moves (SC-001) | 5 or more children aged 8–12, new to MENACE, watch one game with Step by step on, then retell how MENACE picks a move | At least 4 of 5 mention box, shake, bead and square in order |
| What learning does (SC-002) | The same children watch one win and one loss | At least 4 of 5 say win means more of those beads and loss means that bead is taken away |
| Matching beads (SC-003) | The children point to the square for each drawn bead, including one child who can't tell red from green | At least 9 of 10 moves are correct |
| Screen reader | Both helps on, one full game with VoiceOver or NVDA | Each step caption and result is heard once, and every picture has a sensible description |
| Accuracy (FR-020) | Read every factual sentence in the copy deck against [research K13](./research.md#k13-historical-statements-used-by-the-help-fr-020) | Every statement matches a listed source |

## 5. Done

The feature is complete when sections 2 and 3 pass with no failures, feature 001's suite still passes, and every row in section 4 passes.
