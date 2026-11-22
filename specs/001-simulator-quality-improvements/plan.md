# Implementation Plan: MENACE Simulator Quality Improvements

**Branch**: `001-simulator-quality-improvements` (not a git repository; spec directory name) | **Date**: 2026-11-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-simulator-quality-improvements/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

The simulator is one self-contained page, [index.html](../../index.html). This plan fixes the defects the review found and adds three capabilities.

**Defects fixed**:

- Overlapping games that corrupt the record
- A confusing box panel
- Contrast, focus and rendering-mode problems
- A predictable "perfect" player
- Inaccurate history text

**Capabilities added**:

- A choice of bead rule
- A drawer view
- Saving and restoring a trained MENACE

**Approach**: split the page's script into two parts.

1. **A pure engine** in `<script id="menace-engine">`. Each game works on its own copy of the state and commits once at the end. Games are abandoned with `AbortController`. The engine also covers symmetry move groups, depth-aware minimax, and save serialisation and validation.
2. **A UI layer** that renders and controls the page.

The engine is unit-tested with `node --test` by extracting it from the same file. The page is checked end to end by a dependency-free DevTools-Protocol script running against the installed Chrome.

The page stays a single file with no dependencies that works offline from `file://`.

## Technical Context

**Language/Version**: HTML5, CSS (custom properties, `color-mix()`, grid) and JavaScript (ES2022, classic scripts, no modules, so it works from `file://`).

**Primary Dependencies**: none at runtime. For development, Node.js ≥ 22 (built-in test runner, `WebSocket` and `fetch`) and an installed Chrome or Chromium for the browser checks.

**Storage**: none persistent. A trained MENACE can be saved to and loaded from a JSON file on the visitor's device ([contracts/save-file.md](./contracts/save-file.md)).

**Testing**:

- `node --test tests/engine/` for the engine, loaded from `index.html` through `node:vm` with a seeded RNG.
- `node tests/browser/check.mjs` drives Chrome over the DevTools Protocol, covering emulated 320 px screens, both colour schemes, file-input loading and network auditing.
- Manual checks cover screen readers and the two comprehension criteria (SC-004, SC-011).

**Target Platform**:

- Current evergreen browsers (Chrome/Edge 111+, Firefox 113+, Safari 16.2+; `color-mix()` and `<dialog>` set the floor).
- The page is opened from disk or from any static host.
- Screen widths from 320 px up.

**Project Type**: a client-only single-page web app (one static HTML file).

**Performance Goals**:

- Animated games keep their current pacing: 450 ms after MENACE moves and 350 ms after the opponent.
- A 500-game training run against the perfect player finishes in under 3 s on a mid-range laptop.
- No main-thread task over 50 ms during training: engine work is time-sliced into slices of 12 ms or less.
- Drawer view render (304 boxes) in under 16 ms.
- Saving or loading a 10,000-game MENACE in under 200 ms.

**Constraints**:

- One file.
- Zero network requests.
- No external scripts, fonts or styles.
- WCAG 2.1 AA.
- The verified MENACE rules stay unchanged: 304 boxes, 4/3/2/1 starting beads, +3/+1/−1 reinforcement, resignation on an empty box.
- Save files are at most 5 MB.

**Scale/Scope**:

- At most 304 boxes; the record can grow to about 100,000 outcomes.
- 8 user stories and 42 functional requirements.
- `index.html` grows from about 1,400 lines to an estimated 2,300–2,600 lines.
- New test files are under `tests/`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Checked against [.specify/memory/constitution.md](../../.specify/memory/constitution.md) v1.0.0 (ratified 2026-11-22). The plan was first written against provisional gates G1–G5, before the constitution existed. Those gates became Principles I (G1, G5), II (G2), III (G3) and IV (G4). Principle V is new. The table below cites the principles.

| Principle / constraint | Pre-research | Post-design | Post-implementation (2026-11-22) |
| --- | --- | --- | --- |
| **I. Single Self-Contained Page** | ✅ Planned | ✅ The engine and UI stay inline. Tests read the same file (R13). No modules or workers (R2). | ✅ `index.html` is still one file: inline styles and two inline classic scripts, no external resources, works from `file://`. Tooling lives only in `tests/` and `package.json`. |
| **II. Privacy by Construction** | ✅ Planned | ✅ Save is a local download and load is a local file pick. | ✅ The `no-network` check passes. Nothing is put in browser storage, and the footer says so (FR-039). |
| **III. Historical Fidelity** | ✅ Planned | ✅ `rules.test.mjs` asserts 304 boxes, 4/3/2/1 and +3/+1/−1. Michie 1963 is available and the default. | ✅ The rules tests pass under both bead rules. The history text was re-checked against its sources, and R14 records the source for each claim. |
| **IV. Accessible to Everyone** | ✅ Planned | ✅ Tokens are pre-computed (R6), and the keyboard behaviour and labels are contracted ([ui.md](./contracts/ui.md)). | ✅ `contrast-*`, `keyboard*`, `labels` and `narrow-320*` pass in both schemes, including the dialog and the drawer. The manual screen-reader pass is still pending (tasks T036). |
| **V. Pure, Tested Engine** | — (new) | ✅ A DOM-free `menace-engine` block with injected `rng`/`now` and a single `commit` (R1, R13). | ✅ 37 engine tests run against the block extracted from `index.html`, with `Math.random` and `Date` blocked. |
| Technical Constraints: browser floor | ✅ | ✅ `color-mix()` and `<dialog>` | ✅ No newer features. `content-visibility` only speeds up the drawer where it is supported and changes nothing elsewhere. |
| Technical Constraints: performance budgets | ✅ | ✅ | ✅ The `perf-*` checks pass: 500 games against the perfect player well under 3 s, no long tasks (also with a 50,000-game record and the table and drawer open), full drawer < 16 ms, 10,000-game save/load < 200 ms. |
| Technical Constraints: save format | ✅ | ✅ Format id, integer version, full validation before applying, 5 MB limit | ✅ `save-file.test.mjs` passes: round trip, every rejection code, 200 mutations without a throw. |
| Technical Constraints: development tooling | ✅ | ✅ Node ≥ 22 and Chrome only | ✅ `package.json` has no dependencies. |

**Result**: PASS, with no violations, so Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/001-simulator-quality-improvements/
├── spec.md               # Feature specification (clarified; FR-004 amended in planning)
├── plan.md               # This file
├── research.md           # Phase 0: decisions R1–R15
├── data-model.md         # Phase 1: Menace, Matchbox, Game, Record, BeadRule, Saved MENACE
├── quickstart.md         # Phase 1: validation run guide
├── contracts/
│   ├── engine-api.md         # MenaceEngine functions and guarantees
│   ├── save-file.md          # Save format v1 and semantic validation rules
│   ├── save-file.schema.json # Structural JSON Schema for the save format
│   └── ui.md                 # Controls, ARIA semantics, announcements, drawer view
├── checklists/
│   └── requirements.md   # Spec quality checklist
└── tasks.md              # Phase 2 output (/speckit-tasks; not created here)
```

### Source Code (repository root)

```text
index.html                    # The page (still one file):
                              #   <head>  doctype, lang, meta, <style> (tokens incl. new *-ink and bead tokens)
                              #   <body>  markup: masthead, controls (+ bead rule, save/load), board, box panel,
                              #           stats, learning curve, drawer view (new), how it works, footer, <dialog>
                              #   <script id="menace-engine">  pure logic: MenaceEngine (contracts/engine-api.md)
                              #   <script>                     UI layer: rendering, controller, training, file I/O
package.json                  # No dependencies; scripts: "test", "check:browser"; engines.node >= 22
tests/
├── helpers/
│   ├── load-engine.mjs       # Extracts <script id="menace-engine"> from index.html and evaluates it with node:vm
│   └── rng.mjs               # Seeded PRNG (mulberry32)
├── engine/
│   ├── rules.test.mjs        # 304 boxes, move groups, starting beads, reinforcement
│   ├── session.test.mjs      # Abandon/commit guarantees, training counts, empty opening box
│   ├── opponents.test.mjs    # Perfect player: immediate wins, quickest win, variety
│   └── save-file.test.mjs    # Round trip, valid example, rejection codes
├── fixtures/
│   └── saves/
│       ├── valid/            # The example from contracts/save-file.md, plus a perSquare save
│       └── invalid/          # ≥ 10 malformed or tampered files, one per rejection code
└── browser/
    ├── cdp.mjs               # Minimal DevTools Protocol client (launch Chrome, send/await, events)
    └── check.mjs             # The browser checks listed in quickstart.md §3
```

**Structure Decision**: the single-file page stays the product, so nothing ships except `index.html`. The engine and the UI are separated *inside* that file by two `<script>` elements, which gives the tests a clean seam without a build step or a second runtime file. Tests and tooling live in `tests/` and are never loaded by the page.

## Phase Summary

- **Phase 0 – Research** ([research.md](./research.md)): 15 decisions (R1–R15), including:
  - the concurrency root cause and its fix
  - the training loop
  - the Michie 1963 move groups (56 of the 304 boxes are affected; verified)
  - orientation naming
  - minimax
  - pre-computed contrast tokens
  - focus and semantics
  - standards mode
  - chart sizing
  - dialogs
  - save format
  - the drawer view
  - testing without dependencies
  - the history fact-check (two corrections beyond the spec: the Turing wording and the 1965/1966 dates)
  - small fixes
- **Phase 1 – Design**: [data-model.md](./data-model.md), [contracts/](./contracts/) (engine API, save format and schema, UI) and [quickstart.md](./quickstart.md).
- **Spec amendment from planning**: FR-004 now also lets training stop automatically when MENACE's opening box is empty (research R2).

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Moving from quirks to standards mode shifts the layout | Before/after screenshots at 1280 and 375 px in both themes (quickstart §4). Fix spacing in the same change. |
| Rewriting `playGame` reintroduces a race | Every abandon path goes through the same `abandonCurrentGame()`. `session.test.mjs` and the 100-trial `interrupt-*` browser checks guard it. |
| The bead colour nudges change the look | The changes are at most about 6% lighter or darker and only on 6 of the 18 colour values (R6). All other beads keep their colour and only the number's ink changes. |
| A large `index.html` gets harder to maintain | Fixed section order and the engine/UI seam. The engine's contract is documented and tested. |
| Chrome DevTools Protocol details vary between versions | Only stable domains are used (`Page`, `Runtime`, `Emulation`, `DOM`, `Network`, `Browser`). The checks are plain async functions, so moving to Playwright later is mechanical. |

## Complexity Tracking

No constitution violations. This section is intentionally empty.
