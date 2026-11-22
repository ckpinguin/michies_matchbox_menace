<!--
Sync Impact Report
==================
Version change: 1.0.0 → 1.1.0
Bump rationale: MINOR. Principle III's obligations are tightened and re-grounded: the box count
is now the simulator's own definition, not a claim about Michie, and the page must state the
difference from Michie's count. No principle is removed or redefined incompatibly, and the
current page already complies.

Modified principles:
  III. Historical Fidelity (title unchanged)
    - "Michie's rules" bullet split into "MENACE's rules" and "The drawer".
    - Reason: Michie's 1963 paper counts 287 "essentially distinct positions", while 304 is the
      figure most later accounts give and the number of positions with a real choice that the
      simulator computes (research R3, R14 row 3). The rules are attributed to the sources
      recorded in research: the resignation rule is sourced from M. Scroggs, not the 1963 paper
      (R14 row 6).
    - "Verified figures" now covers both bullets.
    - Rationale extended.

Other changes:
  - Development Workflow & Quality Gates, "Transitional rule": marked as fulfilled. Feature 001
    delivered tests/engine/ and tests/browser/ on 2026-11-22. This is a clarification; the rule
    itself is kept.

Added sections: none
Removed sections: none

Dependent templates (read at runtime; not modified by this command):
  ✅ .specify/templates/plan-template.md: no conflict.
  ✅ .specify/templates/spec-template.md: no conflict.
  ✅ .specify/templates/checklist-template.md: no conflict.
  ⚠ .specify/templates/tasks-template.md: still says tests are OPTIONAL. Principle V continues to
     take precedence (unchanged from v1.0.0).

Follow-up TODOs (outside this command's scope):
  - specs/001-simulator-quality-improvements/spec.md, Assumptions, still says the constitution is
    an unfilled template and that the count of 304 boxes was "verified" as Michie's. Update it
    when the spec is next revised.
  - The page already states the 287/304 difference (index.html, "How MENACE works"), and the
    rule-switch browser check enforces it. No code change is needed.

No deferred placeholders.
-->

# MENACE Simulator Constitution

## Core Principles

### I. Single Self-Contained Page

The product is one HTML file, `index.html`.

- It MUST work when opened directly from disk (`file://`) and from any static host, with no
  install, build step, sign-in or server.
- All markup, styles and scripts MUST be inline. The page MUST NOT load external scripts,
  stylesheets, fonts, images or other resources.
- The page MUST NOT rely on features that fail from `file://`: ES modules, Web Workers loaded
  from separate files, `fetch` of sibling files, or service workers.
- There MUST be no runtime dependencies (no libraries, bundled or linked).
- Development tooling, tests and fixtures MAY live outside `index.html`, but the page MUST
  never load them.

**Rationale**: the simulator is meant to be shared and opened anywhere: emailed to a teacher,
put on a USB stick, or opened offline in a classroom. One file with no dependencies keeps that
promise and removes every supply-chain and link-rot risk.

### II. Privacy by Construction

- The page MUST make zero network requests.
- The page MUST NOT use analytics, tracking, cookies, or any form of telemetry.
- Visitor data (games, the drawer, the record) MUST stay on the visitor's device. It may leave
  memory only through a file the visitor explicitly saves and later chooses to load.
- Browser storage (`localStorage`, IndexedDB and similar) MUST NOT hold visitor data unless a
  feature specification justifies it and the footer's privacy statement is updated in the same
  change.
- The footer's privacy statement MUST describe accurately what is and isn't stored.

**Rationale**: an educational toy has no reason to collect anything. Building privacy into
the design, rather than promising it in a policy, makes the footer statement verifiable.

### III. Historical Fidelity

- **MENACE's rules**: the simulator MUST implement the rules recorded for MENACE in the feature
  research: starting beads of 4/3/2/1 by move, reinforcement of +3 for a win, +1 for a draw and
  −1 for a loss, and resignation when a box is empty. Michie's 1963 bead rule (moves equivalent
  by symmetry share one colour) MUST be available.
- **The drawer**: the simulator MUST have one box for every position MENACE can face with a real
  choice (two or more free squares), merging positions that are rotations or mirror images of
  each other. That gives 304 boxes. Michie's 1963 paper counts 287 "essentially distinct
  positions", so the page MUST state this difference (see Deviations).
- **Deviations**: any departure from the published original MUST be either a choice the visitor
  can make or stated plainly on the page.
- **Historical claims**: every historical or factual claim on the page MUST be supported by a
  source. The source MUST be recorded in the research document of the feature that introduces
  or changes the claim. A claim that can't be sourced MUST be reworded or removed.
- **Verified figures**: the figures in the first two bullets MUST NOT change without a recorded
  source and an automated test asserting the new value.

**Rationale**: the page teaches history and the origins of machine learning. A pleasant but
wrong reconstruction teaches the wrong lesson. Earlier review found unsourced credits and an
overstated "same rules" claim, and reading Michie's own paper later showed that even the box
count differs between sources. The simulator's figures are therefore defined by what it computes
and tests, and every difference from the original is shown to the visitor.

### IV. Accessible to Everyone

The page MUST meet WCAG 2.1 level AA. In particular:

- **Contrast**: text MUST reach at least 4.5:1 against its rendered background (3:1 for large
  text) in both light and dark appearance. That includes text drawn on coloured beads, badges
  and charts. New colours MUST be defined as tokens in every theme block.
- **Keyboard**: every function MUST be operable by keyboard alone. Playing a move MUST NOT throw
  away focus.
- **Assistive technology**: controls MUST expose accurate names, roles and states. Live
  announcements MUST carry meaningful events, such as moves, results and outcomes of operations,
  and MUST NOT carry transient filler.
- **Small screens**: the page MUST be fully usable from 320 px wide with no sideways scrolling,
  and chart text MUST stay at least 10 px tall.
- **Motion and document**: the page MUST respect `prefers-reduced-motion`. It MUST declare its
  language and render in standards mode.

**Rationale**: an educational page that shuts out low-vision, keyboard or screen-reader users
fails its purpose. Concrete thresholds make the principle testable rather than aspirational.

### V. Pure, Tested Engine

- **Separation**: game logic MUST live in a DOM-free engine block inside `index.html`
  (`<script id="menace-engine">`), apart from the UI layer. The engine MUST receive randomness
  and time as injected parameters, so its behaviour is deterministic under test.
- **Tests with every change**: every change to engine behaviour (rules, opponents, game sessions,
  save and load) MUST include automated tests run by `node --test`. These tests evaluate the
  engine extracted from `index.html` itself, so the code tested is the code shipped.
- **Shared state**: state that more than one game could touch MUST be changed only by the
  engine's single commit step for a finished game. Abandoned games MUST leave no trace.
- **Precedence**: this principle overrides any template default that treats tests as optional.

**Rationale**: the review found that overlapping games silently corrupted the record, which
went unnoticed because nothing was tested. A pure engine with deterministic tests is the
cheapest way to keep MENACE's bookkeeping honest.

## Technical Constraints

- **Browser floor**: current evergreen browsers, with `color-mix()` and `<dialog>` support as
  the baseline (Chrome/Edge 111+, Firefox 113+, Safari 16.2+). Using a newer platform feature
  requires a fallback or a recorded justification in the feature plan.
- **Performance budgets**:
  - Animated games keep a deliberate, readable pace.
  - Batch training MUST keep the page responsive, with no main-thread task over 50 ms.
  - A 500-game run against the perfect player MUST finish in under 3 s on a mid-range laptop.
  - Rendering the full drawer (304 boxes) MUST take less than one frame (16 ms).
- **Save format**:
  - Saved files MUST carry a format identifier and an integer version, and MUST be validated
    completely before anything is applied. A file is never applied in part.
  - Any change to the format MUST increase the version.
  - Readers MUST either accept older versions or reject them with a plain explanation.
  - Files over 5 MB MUST be rejected.
- **Development tooling**:
  - Tooling uses only what Node.js ≥ 22 (built-in test runner, `WebSocket`, `fetch`) and an
    installed Chrome or Chromium provide.
  - A development dependency (an npm package) MAY be added only with a justification in the
    feature plan's Complexity Tracking table.
  - `package.json`, if present, MUST NOT list runtime dependencies.

## Development Workflow & Quality Gates

- **Spec-driven flow**: features follow Spec Kit, in the order `/speckit-specify` →
  `/speckit-clarify` (as needed) → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`.
  Artifacts live in `specs/<NNN-feature>/`.
- **Constitution Check**: every plan MUST check itself against Principles I–V and the Technical
  Constraints. Any violation MUST be justified in the plan's Complexity Tracking table;
  otherwise the plan does not pass.
- **Definition of done**: a feature that changes the page is complete only when all of these
  hold:
  1. `node --test tests/engine/` passes.
  2. `node tests/browser/check.mjs` passes, covering standards mode, contrast in both schemes,
     the keyboard, the 320 px layout, the absence of network requests, and the feature's own
     checks.
  3. For UI changes, a manual screen-reader pass (VoiceOver or NVDA) of the affected flows is
     done.
  4. For UI changes, visual before/after screenshots at 1280 px and 375 px in light and dark
     appearance are compared, and only the intended changes appear.
  5. For text that makes historical or factual claims, the sources are recorded in the
     feature's `research.md`.
- **Transitional rule**: until the test harness (`tests/engine/`, `tests/browser/`) exists, a
  change MUST either add the harness or record equivalent manual verification in the feature's
  `quickstart.md`. Feature 001 delivered the harness on 2026-11-22, so this rule applies again
  only if the harness is ever removed.
- **Spec amendments**: an amendment discovered during planning or implementation MUST be made in
  the spec itself, marked as amended, and called out to the user. It MUST NOT be applied
  silently in the plan or the code.

## Governance

- **Authority**: this constitution takes precedence over other project practices and over
  defaults in Spec Kit templates. Where they conflict, the constitution wins, and the conflict
  SHOULD be noted in the next amendment's Sync Impact Report.
- **Amendments**: amend by editing this file through `/speckit-constitution`. Each amendment
  includes a Sync Impact Report (version change, principles changed, sections added or removed,
  and the effect on templates) and updates the version and the Last Amended date.
- **Versioning** follows semantic versioning:
  - MAJOR: a principle is removed or redefined in a way that is not backward compatible, or a
    governance rule is removed.
  - MINOR: a new principle or section is added, or existing guidance is materially expanded or
    tightened.
  - PATCH: clarifications, wording and typo fixes with no change in meaning.
- **Compliance review**:
  - Each `/speckit-plan` run re-checks compliance before and after design.
  - Each `/speckit-implement` run checks the Definition of Done before declaring completion.
  - Any change to Principle III's verified figures needs a source and a test in the same change.
- **Runtime guidance**: the source of truth for development guidance is this file together with
  the current feature's `specs/<NNN-feature>/` artifacts. The project has no other guidance file.

**Version**: 1.1.0 | **Ratified**: 2026-11-22 | **Last Amended**: 2026-11-22
