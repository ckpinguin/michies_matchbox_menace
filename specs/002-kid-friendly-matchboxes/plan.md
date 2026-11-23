# Implementation Plan: Matchboxes a Kid Can Follow

**Branch**: `002-kid-friendly-matchboxes` (spec directory name; no git branch created) | **Date**: 2026-11-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-kid-friendly-matchboxes/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Feature 002 makes MENACE's hand-worked process visible to a child of about 8 to 12, building on feature 001's page.

**Always on** (clarification C): every box MENACE uses is drawn as a real matchbox next to today's detailed panel.

- The face of the box shows a drawing of its position, and doubles as a colour key.
- An open tray holds loose beads that can be counted.
- Every bead colour also carries a fixed shape, so colour is never the only cue.

**Two optional helps**:

- **Step by step**: each MENACE move unfolds as five captioned steps: find, shake, tilt, look up, play. The child either presses Next or lets the steps play by themselves. At the end of a game, beads drop in or are taken out.
- **Simple words**: plain-language messages, first-time tips and a six-panel picture story.

**Also new**: turned boxes rotate into place, shared-colour moves are highlighted, and a "What changed?" panel compares a box before and after a training run.

**Approach**: presentation only.

- **Engine.** Feature 001's engine and game controller stay unchanged. The UI's existing `pause` hook holds MENACE's move until the steps finish, and its board rendering holds back MENACE's mark until step 5 (research K1).
- **Determinism.** Animations never draw on `Math.random` (K2), so outcomes are identical with the help on or off.
- **New pure code.** It goes into the engine block with tests: picture matrices for turning boxes, bead layout, and before/after changes.
- **Simple-words text.** It lives in one inline JSON copy deck, which Node tests can check against the reading-level rules (K8).

## Technical Context

**Language/Version**: HTML5, CSS and JavaScript (ES2022, classic scripts), inline SVG and the Web Animations API. Same as feature 001.

**Primary Dependencies**: none at runtime. For development, Node.js ≥ 22 and an installed Chrome or Chromium, as in feature 001.

**Storage**: none. Help settings, the tips already shown and the training snapshot live in memory only (Constitution II). Save files are unchanged: no new fields and no version change.

**Testing**:

- `node --test tests/engine/`: new `kid.test.mjs` and `copy.test.mjs`.
- `node tests/browser/check.mjs`: new checks in `tests/browser/checks/matchboxes.mjs`, `steps.mjs` and `kid-help.mjs`. Feature 001's contrast, keyboard and 320 px checks are re-run with both helps on.
- Manual checks with children (SC-001–SC-003).

**Target Platform**: feature 001's browser floor (Chrome/Edge 111+, Firefox 113+, Safari 16.2+). `Element.animate()` and CSS transforms on SVG groups are supported throughout it. Screens from 320 px.

**Project Type**: a client-only single-page web app (one static HTML file).

**Performance Goals**:

- A training run with the helps on is at most 10% slower than with them off (SC-005), because training skips all animation.
- Animations run at display rate.
- Each automatic step shows for at least 2 s.
- Drawing a matchbox picture takes under 2 ms. The panel shows at most 4 per game.
- The drawer view is unchanged (still compact cards, under 16 ms).

**Constraints**:

- One file, offline, with no external images or fonts (all pictures are inline SVG).
- WCAG 2.1 AA in both themes.
- `prefers-reduced-motion` gives still pictures.
- No change to MENACE's rules, record or save format (FR-021).
- Historical statements must match the feature 001 R14 sources (FR-020; research K13).

**Scale/Scope**:

- 6 user stories and 22 functional requirements.
- `index.html` grows by an estimated 700–1,000 lines: the matchbox component, the step area, the helps controls, tips, the story, the comparison panel and the copy deck.
- New test files go under `tests/`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Checked against [.specify/memory/constitution.md](../../.specify/memory/constitution.md) v1.1.0.

| Principle / constraint | Pre-research | Post-design |
| --- | --- | --- |
| **I. Single Self-Contained Page** | ✅ All pictures are drawn by the page | ✅ Inline SVG components. The copy deck is an inline JSON `<script>` block, readable from `file://` (K8). No new resources and no modules. |
| **II. Privacy by Construction** | ✅ Nothing new is stored | ✅ `ui.help`, `ui.tipsShown` and the training snapshot are in memory only and reset on reload. Save files are unchanged. The footer statement stays accurate. |
| **III. Historical Fidelity** | ✅ Help text must agree with sources | ✅ Every factual statement in the help is mapped to a source (K13). Colour and shape names are presented as the page's own, not Michie's. MENACE's rules are untouched, and the 287/304 statement from feature 001 is kept. |
| **IV. Accessible to Everyone** | ✅ Planned | ✅ Each picture has `role="img"` and a text equivalent. Each step caption is announced once. Next, Pause and the tips are keyboard operable without stealing board focus (K6). Reduced motion gives still pictures. Shape marks mean colour is never the only cue. Bead marks use the existing AA `--cat-N-ink` tokens. Everything fits 320 px. The existing checks are re-run with both helps on. |
| **V. Pure, Tested Engine** | ✅ Engine behaviour unchanged | ✅ The new pure helpers (`PICTURE_MATRICES`, `beadLayout`, `beadChanges`) go in the engine block, with tests in `kid.test.mjs`. Animations never use the injected randomness (K2). The `help-identical` check proves identical outcomes. |
| Technical Constraints: browser floor | ✅ | ✅ The Web Animations API and SVG transforms are within the floor. |
| Technical Constraints: performance budgets | ✅ | ✅ Training skips animation (`help-perf` check). The drawer is unchanged. No task over 50 ms: animations run on the compositor and pictures are small. |
| Technical Constraints: save format | ✅ Unchanged | ✅ No new fields, so the version stays 1. |
| Technical Constraints: development tooling | ✅ | ✅ No new dependencies. |
| Workflow: spec amendments | — | ✅ None needed. The clarification (option C) is recorded in the spec. |

**Result**: PASS, with no violations, so Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/002-kid-friendly-matchboxes/
├── spec.md               # Feature specification (clarified: option C)
├── plan.md               # This file
├── research.md           # Phase 0: decisions K1–K13
├── data-model.md         # Phase 1: picture, mark, step, learning step, tip, story, help settings, snapshot
├── quickstart.md         # Phase 1: validation run guide
├── contracts/
│   ├── ui.md             # Helps controls, step area, matchbox picture, tips, story, comparison panel (semantics, keyboard, announcements)
│   ├── copy-deck.md      # Structure of the inline copy deck and the reading-level rules
│   └── engine-additions.md   # PICTURE_MATRICES, beadLayout, beadChanges, BEAD_MARKS
├── checklists/
│   └── requirements.md   # Spec quality checklist
└── tasks.md              # Phase 2 output (/speckit-tasks; not created here)
```

### Source Code (repository root)

```text
index.html                    # Still one file. New parts:
                              #   <style>   matchbox, tray, bead and mark styles; step area; tips; story; comparison panel
                              #   markup    "Helps" group in the controls card; step area in the board card;
                              #             picture-story section (before "How MENACE works"); "What changed?" panel
                              #   <script type="application/json" id="menace-copy">   simple-words copy deck (K8)
                              #   <script id="menace-engine">   + PICTURE_MATRICES, BEAD_MARKS, beadLayout, beadChanges
                              #   <script>   UI: matchbox component, step sequencer (via pause), learning sequence,
                              #              tips, story, comparison, simple-words switch
tests/
├── helpers/
│   └── load-copy.mjs         # Extracts and parses <script id="menace-copy">
├── engine/
│   ├── kid.test.mjs          # PICTURE_MATRICES, beadLayout, beadChanges, BEAD_MARKS
│   └── copy.test.mjs         # Reading level, word list, story limits, tip coverage
└── browser/checks/
    ├── matchboxes.mjs        # matchbox-counts, bead-marks, turned-box, shared-colour-markers
    ├── steps.mjs             # steps-order, steps-auto, steps-interrupt, learning-beads, reduced-motion
    └── kid-help.mjs          # tips-once, simple-words-text, story, compare, help-identical, help-perf
```

**Structure Decision**: as in feature 001, the single page is the product. The engine/UI seam inside it is kept. A second seam is added, the copy deck: plain data in the page, read by both the UI and the tests. All tooling stays under `tests/`.

## Phase Summary

- **Phase 0, research** ([research.md](./research.md)), decisions K1–K13:
  - Pausing moves without engine changes.
  - Determinism with the help on.
  - The matchbox picture.
  - Shape marks instead of numbers, because box and board square numbers differ.
  - Picture matrices, verified against the engine for all 72 pairs.
  - Layout at 320 px.
  - Shared colours.
  - The testable copy deck.
  - Tips and the story.
  - Bead movements.
  - The before/after snapshot.
  - Testing.
  - Sources for every statement in the help.
- **Phase 1, design**: [data-model.md](./data-model.md), [contracts/](./contracts/) and [quickstart.md](./quickstart.md).

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| The step-by-step help changes MENACE's play | K1 (timing via `pause` only) and K2 (no randomness in animations). The `help-identical` check compares seeded runs with the help on and off. |
| Kid text drifts above the reading level | Every simple-words string is in the copy deck, and `copy.test.mjs` enforces FR-013. |
| Animations hurt motion-sensitive visitors | `prefers-reduced-motion` gives still pictures (`reduced-motion` check). |
| The page gets heavy for adults | The helps are off by default. Matchboxes are small and sit beside, not instead of, the detail (clarification C). The drawer is unchanged. |
| A colour-blind child can't match beads | Fixed shape marks (K4), and a manual check with a child who can't tell red from green (SC-003). |

## Complexity Tracking

No constitution violations. This section is intentionally empty.
