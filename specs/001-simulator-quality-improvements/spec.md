# Feature Specification: MENACE Simulator Quality Improvements

**Feature Branch**: `001-simulator-quality-improvements` (the project is not a git repository; this is the spec directory name only)

**Created**: 2026-11-22

**Status**: Draft

**Input**: User description: "Check the project (Michies matchbox simulator html page) if there is somthing to do better."

## Context: what the review found

The simulator page was reviewed by reading it in full and by exercising it in a browser. The core MENACE rules are implemented correctly. One check confirmed that the page discovers exactly **304** distinct boxes (1 for the first move, 12 for the third, 108 for the fifth, 183 for the seventh), matching Michie's figure. The starting beads (4/3/2/1) and the reinforcement rule (+3 for a win, +1 for a draw, −1 for a loss) match the published description.

This round covers two kinds of work:

- **Fixes and polish** for the problems the review observed (User Stories 1–5).
- **Three new capabilities** agreed in clarification (User Stories 6–8):
  - a choice of bead rule
  - a view of the whole drawer
  - saving and restoring a trained MENACE

## Clarifications

### Session 2026-11-22

- **Q**: Moves that are equivalent by symmetry: follow Michie's 1963 rule (one bead colour per distinct move), or keep one colour per free square?
  **A**: Let the visitor choose between the two rules.
- **Q**: Is this round limited to fixes and polish, or does it also add new capabilities?
  **A**: It also adds two capabilities:
  - saving and restoring the trained MENACE as a file on the visitor's device
  - a view for browsing every discovered box

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Game records the visitor can trust (Priority: P1)

A visitor watches MENACE play the random mover or the perfect player and, partway through, clicks "New game", picks a different opponent, clicks "Reset MENACE" or starts auto-training. The game in progress must stop cleanly. Afterwards the board, the bead counts, the statistics and the learning curve must show only the games that actually finished.

**Observed in review**: clicking "New game" while a computer game was still playing out left two games running on the same board, and the statistics recorded **2 games** for the one game the visitor saw. Clicking "Reset MENACE" partway through a game showed **2 games played** right after the reset, because the game from before the reset was still recorded.

**Why this priority**: the simulator exists to show learning through bookkeeping. If the record counts phantom games, or games from before a reset, the learning curve and the win rate are wrong, and so is the page's main lesson. Saving and restoring (Story 8) also depends on the record being right.

**Independent Test**: start a game against a computer opponent and interrupt it at different moments with each of the four actions. Check that games played, wins/draws/losses, the learning curve and the box panel show only completed games, and only those started after any reset.

**Acceptance Scenarios**:

1. **Given** a computer-opponent game is still playing out, **When** the visitor clicks "New game", **Then** the unfinished game stops at once and changes no bead counts. The board shows only the new game, and games played goes up by exactly 1 when the new game ends.
2. **Given** a game is in progress, **When** the visitor confirms "Reset MENACE", **Then** games played shows 0, the drawer is empty, the learning curve is empty, and no game started before the reset is recorded later.
3. **Given** a game is in progress, **When** the visitor switches opponent, **Then** the unfinished game is discarded as in scenario 1 and a fresh game against the new opponent begins.
4. **Given** a computer-opponent game is still playing out, **When** the visitor starts auto-training for N games, **Then** the unfinished game is discarded and games played goes up by exactly N when training completes.
5. **Given** auto-training is running, **When** the visitor clicks "Stop", **Then** training ends after the current game. The status says training was stopped and how many of the requested games were played; it does not say "Training finished".
6. **Given** the visitor has made some moves in their own game, **When** they click "New game", **Then** the unfinished game is not counted and MENACE's beads are unchanged.
7. **Given** MENACE's first-move box has run out of beads, **When** a new game starts, **Then** the status explains that MENACE has no opening moves left and needs a reset to play again.

---

### User Story 2 - Understanding what a matchbox shows (Priority: P2)

A visitor plays a move, then looks at the panel "The boxes MENACE used this game" to understand why MENACE played where it did. The panel should make it obvious which box was used, which bead was drawn, and which square on the real board that bead led to.

**Observed in review**:

- The box's position code labels MENACE's pieces "X" and the opponent's pieces "O". On the board MENACE is drawn as a nought (◯) and the opponent as a cross (✕), so the code reads the wrong way round.
- A box is shown in its standard (rotated or mirrored) orientation, and its bead list names squares in that orientation. The status line names squares on the real board. A visitor can read "MENACE played square 3" while the panel highlights the bead for "square 9", and nothing explains why.

**Why this priority**: the box panel is the page's main teaching device. Confusing symbols and unexplained square numbers undermine the explanation, but they do not corrupt any results, so this comes after Story 1. The drawer view (Story 7) shows boxes in the same way, so it inherits this fix.

**Independent Test**: play games until MENACE meets a position that is shown rotated or mirrored in its box. Confirm that the panel's symbols match the board and that a first-time viewer can tell which real square the drawn bead produced.

**Acceptance Scenarios**:

1. **Given** a box is shown in the panel, **When** the visitor reads its position code, **Then** MENACE's and the opponent's pieces use the same symbols as the board, or a visible legend explains the code.
2. **Given** the box's standard orientation differs from the real board, **When** the visitor looks at the box, **Then** the panel says that the box shows a rotated or mirrored version of the board and names the real-board square the drawn bead was played on.
3. **Given** the box's orientation matches the real board, **When** the visitor looks at the box, **Then** no orientation notice appears and the square numbers match the status line.

---

### User Story 3 - Readable and usable for everyone (Priority: P2)

Visitors with low vision, keyboard-only users, screen-reader users and phone users can read every label, follow the game and play it without workarounds.

**Observed in review**:

- **Low-contrast text.** Small grey labels (ratio 3.5:1), brass labels (3.4:1) and the green/amber win and draw badges (2.9:1 and 2.7:1) fall short of the 4.5:1 minimum for normal text. Bead counts printed on the yellow, pink, light-green and orange beads range from 2.0:1 to 2.9:1, which makes them hard to read in the light theme.
- **Keyboard focus is lost.** After a keyboard user places a mark, focus leaves the board, so the user has to Tab back to it before every move.
- **Wrong spoken labels.** Screen readers call the opponent's squares "you" even when the opponent is the random mover or the perfect player.
- **No accessible name.** The opponent selector does not announce its visible label "Opponent".
- **Unreliable rendering.** The page lacks the opening declarations that put browsers into standard rendering mode and tell assistive technology its language. Browsers currently render it in legacy compatibility mode.
- **Tiny chart labels.** The chart's axis labels shrink to about 5 px tall at a 500 px screen width, and smaller on phones.

**Why this priority**: these problems shut some visitors out of an educational page or make it noticeably harder to use, but they do not make results wrong.

**Independent Test**: check contrast in both light and dark appearance, play a full game using only the keyboard and then with a screen reader, and view the page at 320–375 px width.

**Acceptance Scenarios**:

1. **Given** light or dark appearance, **When** any text on the page is measured against its background (including the bead count on each of the nine bead colours), **Then** it meets the WCAG 2.1 AA contrast minimum.
2. **Given** a keyboard-only visitor in their own game, **When** they place a mark, **Then** focus stays on the board and they can choose their next square without Tab presses to get back to the board.
3. **Given** the opponent is the random mover or the perfect player, **When** a screen reader reads an occupied square, **Then** it names that opponent, not "you".
4. **Given** a screen reader reaches the opponent selector, **When** it announces the control, **Then** it reads the label "Opponent" and which option is selected.
5. **Given** a phone screen 320–375 px wide, **When** the learning curve is shown, **Then** its axis and end-point labels are at least 10 px tall and the page does not scroll sideways.
6. **Given** a screen-reader user watches a full game, **When** the game is played out, **Then** they hear each move and the final result once each, and no passing message that is immediately replaced.

---

### User Story 4 - Opponents and feedback that behave as described (Priority: P3)

A visitor trains MENACE against the "perfect player" and reads the end-of-game feedback. The opponent should play as well as its name promises, with natural variety, and the result should be easy to see.

**Observed in review**:

- The perfect player picks at random among moves that are equally good in the long run, so it can pass up a win available on the spot in favour of a slower one.
- The first random choice it makes in each position is then fixed for good. Its play becomes completely predictable after a few games, so MENACE trains against a narrower opponent than intended.
- The table view of the learning curve snaps shut every time another game is added.
- The table's figures are not labelled as rolling 20-game rates.
- The winning line is not highlighted when a game ends.

**Why this priority**: these are polish and fidelity improvements. The simulator still works without them.

**Independent Test**: play 200 or more games against the perfect player. Check that it takes every immediate win, that its replies vary among equally good moves, and that the table and the end-of-game display behave as described.

**Acceptance Scenarios**:

1. **Given** the perfect player can win on its current move, **When** it moves, **Then** it takes that win.
2. **Given** the perfect player has several equally good moves in a position it has met before, **When** it meets that position again in later games, **Then** its choice can differ from game to game.
3. **Given** a game ends in a win for either side, **When** the result is shown, **Then** the three winning squares are visibly highlighted and the result announcement names the winner.
4. **Given** the visitor has opened the table view, **When** another game finishes, **Then** the table stays open and updates.
5. **Given** the table view is open, **When** the visitor reads a row, **Then** it is clear that each figure is the rolling 20-game rate as at the last game in that range.

---

### User Story 5 - A historically accurate explanation (Priority: P3)

A teacher or curious reader uses the "How MENACE works" section as a reference. Its claims should agree with published sources.

**Observed in review**:

- **Chambers credit.** The page says Michie built MENACE "together with his colleague Roger Chambers". The sources checked credit MENACE to Michie alone and link Chambers to Michie's later BOXES pole-balancing work (Michie & Chambers, 1968). One encyclopedia article does mention Chambers, but no primary source for his part in MENACE was found.
- **"Same rules" claim.** The page says it "runs the same rules" as the original. In Michie's 1963 paper, moves that are equivalent by symmetry share one bead colour; for example, a position with seven free squares gets only four colours. The simulator gives every free square its own beads. This affects **56 of the 304** boxes. Story 6 resolves the difference.

**Why this priority**: accuracy matters for an educational page, but this is a text change with low effort and low risk.

**Independent Test**: compare each historical statement on the page with the listed sources. Every statement is supported, reworded, or removed.

**Acceptance Scenarios**:

1. **Given** the history section, **When** a reader checks the account of who built MENACE against the sources, **Then** the page credits Donald Michie, and mentions Roger Chambers only for work the sources tie to him.
2. **Given** the history section, **When** a reader compares its description of the bead rules with Michie's 1963 paper, **Then** the page describes both bead rules accurately and says which one Michie used.

---

### User Story 6 - Choosing the bead rule (Priority: P3)

A visitor who has read how MENACE works wants to see whether symmetry matters. They choose between two bead rules:

- **Michie's 1963 rule**: moves that are equivalent by symmetry share a single bead colour. The first box, for example, has just three colours: corner, edge and centre.
- **One colour per square**: every free square has its own beads.

They then train MENACE under each rule and compare how quickly it learns.

**Why this priority**: it makes the page's "same rules" claim true and adds a hands-on experiment. It is a new capability rather than a fix, so it follows the fixes in Stories 1–5.

**Independent Test**: select each rule in turn and inspect the opening box and a symmetric later box. Train 200 games under each rule against the same opponent, and confirm that the boxes are set up as the chosen rule describes and the rule in use is always visible.

**Acceptance Scenarios**:

1. **Given** the page has just opened, **When** the visitor looks at the rule setting, **Then** Michie's 1963 rule is selected.
2. **Given** Michie's 1963 rule is selected, **When** MENACE opens its first-move box, **Then** the box holds three bead colours (corner, edge, centre) with 4 beads each.
3. **Given** "one colour per square" is selected, **When** MENACE opens its first-move box, **Then** the box holds nine bead colours with 4 beads each.
4. **Given** Michie's 1963 rule is selected and MENACE draws a bead that stands for several equivalent squares, **When** it moves, **Then** it plays one of those squares and the box panel names the real square played.
5. **Given** MENACE has played at least one game, **When** the visitor changes the rule, **Then** the page asks for confirmation and warns that the current training will be lost unless it is saved first. Only after the visitor confirms does a fresh MENACE start under the new rule.
6. **Given** either rule is in use, **When** the visitor looks at the statistics and the learning curve, **Then** the rule in use is named there.

---

### User Story 7 - Browsing the whole drawer (Priority: P3)

After training, a visitor wants to look inside every matchbox MENACE has opened, not only the ones used in the latest game. They want to see which positions MENACE has learned to like and which boxes have run dry.

**Why this priority**: it extends the page's main teaching device (the box panel) to the whole drawer. That makes learning visible across hundreds of positions instead of one game at a time.

**Independent Test**: train 500 games, open the drawer view, and use its filters and sorting to find specific boxes, for example every empty 7th-move box. Check that what it shows matches the box panel for the same boxes.

**Acceptance Scenarios**:

1. **Given** MENACE has discovered some boxes, **When** the visitor opens the drawer view, **Then** every discovered box is listed. Each entry shows the box's position (in the same symbols as the board), its move number, the beads for each move, the total number of beads, and whether it is empty.
2. **Given** the drawer view is open, **When** the visitor filters by move number (1st, 3rd, 5th or 7th) or chooses to see only empty boxes, **Then** only matching boxes are listed and the number shown is stated.
3. **Given** the drawer view is open, **When** the visitor sorts by discovery order or by total beads, **Then** the list reorders accordingly.
4. **Given** a game has just finished, **When** the visitor looks at the drawer view, **Then** the boxes used in that game are marked and their bead counts are already updated.
5. **Given** no box has been discovered yet, **When** the visitor opens the drawer view, **Then** it explains that boxes appear as MENACE meets new positions.
6. **Given** a keyboard-only or screen-reader user, **When** they use the drawer view, **Then** they can reach every filter, sort option and box, and each box is announced with its move number, total beads and whether it is empty.

---

### User Story 8 - Saving and restoring a trained MENACE (Priority: P4)

A teacher trains MENACE for 1,000 games before a lesson. They save it to a file on their own computer, and in class they load it back so pupils can play against an experienced MENACE straight away. At the moment, reloading the page loses all training.

**Why this priority**: it removes the main cost of experimenting, which is losing long training runs, but it is a convenience. Everything else works without it.

**Independent Test**: train 1,000 games, save, reload the page, and load the file. Check that the drawer, every bead count, the statistics, the learning curve and the bead rule all match what was saved. Then try loading damaged and unrelated files.

**Acceptance Scenarios**:

1. **Given** no training run is in progress, **When** the visitor chooses "Save MENACE", **Then** a file is saved to the visitor's device holding:
   - the drawer
   - the record (games played, wins, draws, losses and the outcome sequence behind the learning curve)
   - the bead rule
   - the date it was saved
2. **Given** a saved file, **When** the visitor loads it and confirms that it will replace the current MENACE, **Then** the drawer, the statistics, the learning curve and the bead rule match the saved ones exactly, and any game in progress is discarded.
3. **Given** a restored MENACE, **When** it plays further games, **Then** it draws from exactly the restored bead counts.
4. **Given** a file that is not a MENACE save, is damaged, is in an unsupported format version, or holds impossible values, **When** the visitor tries to load it, **Then** the page rejects it with a plain explanation and the current MENACE stays exactly as it was.
5. **Given** a file saved under a different bead rule from the one in use, **When** it is loaded, **Then** the page switches to the file's rule and says so.
6. **Given** the visitor saves or loads, **When** the operation runs, **Then** nothing is sent outside the visitor's device.

---

### Edge Cases

- **Interrupt timing**: the visitor interrupts while MENACE is "shaking a box", during the opponent's thinking pause, or while waiting for the visitor's click. All three must discard the unfinished game the same way.
- **Rapid clicks**: the visitor clicks "New game" several times quickly. Exactly one game ends up in progress.
- **Stop at the end**: the visitor clicks "Stop" during the last game of a training run. The status reports the actual number of games completed.
- **Empty opening box**: the first-move box loses all of its beads (possible after many losses). MENACE then resigns every game. The page must say plainly that MENACE has run out of opening moves and can play again only after a reset or a load, instead of showing an endless string of losses with no explanation.
- **Symmetric positions**: in a symmetric position, one bead can correspond to more than one equivalent real square. The panel must name the square that was actually played.
- **Light and dark appearance**: the system appearance changes between light and dark while the page is open. All colours, including bead colours and badges, must keep meeting the contrast requirement.
- **Long sessions**: the record holds thousands of games. The learning curve, the table, the drawer view and saving and loading stay responsive and readable.
- **Training running**: while a training run is in progress, changing the bead rule, saving and loading are unavailable, like the other controls.
- **Cancelled actions**: the visitor cancels a rule change or a load at the confirmation step. Nothing changes and the game in progress continues.
- **Saving early**: the visitor saves before any game has been played. The page allows it, and loading the file gives an untrained MENACE.
- **Tampered files**: a file edited by hand to hold impossible values (negative beads, beads on occupied squares, positions that cannot occur in play, more boxes than exist) is rejected as a whole. It is never loaded in part.
- **Empty filter result**: a drawer-view filter matches no boxes. The view says so instead of showing a blank list.

## Requirements *(mandatory)*

### Functional Requirements

#### Game integrity

- **FR-001**: The page MUST allow only one game in progress at a time. Each of the following MUST end any game in progress before anything else happens:
  - "New game"
  - switching opponent
  - a confirmed reset
  - starting auto-training
  - a confirmed rule change
  - a confirmed load
- **FR-002**: An abandoned game MUST NOT count toward games played, the win/draw/loss record or the learning curve. It MUST NOT change any bead counts.
- **FR-003**: After a confirmed reset, the statistics, the drawer and the learning curve MUST reflect only games started after the reset.
- **FR-004**: An auto-training run of N games MUST add exactly N completed games to the record, unless the visitor stops it early or MENACE can no longer open a game (FR-006). In that second case, training stops automatically and the status explains why. *(Amended during planning; see research R2.)*
- **FR-005**: When a training run is stopped early, the status MUST say so and report how many of the requested games were completed.
- **FR-006**: When MENACE's first-move box has no beads left, the page MUST tell the visitor that MENACE can no longer start a game and that a reset or a load is needed.

#### Box panel clarity

- **FR-007**: The box position code MUST use the same symbols as the board for MENACE's and the opponent's pieces, or carry a visible legend that explains the code.
- **FR-008**: When a box is shown in an orientation that differs from the real board, the panel MUST say so and name the real-board square that the drawn bead was played on.
- **FR-009**: Square numbers in the status line, the box panel and the board's spoken labels MUST always make clear which orientation they refer to.

#### Accessibility and readability

- **FR-010**: All text MUST meet WCAG 2.1 AA contrast against its background in both light and dark appearance. This includes small labels, win/draw/loss badges, chart labels and the bead count on each of the nine bead colours.
- **FR-011**: After a visitor places a mark with the keyboard, focus MUST stay on the board.
- **FR-012**: The spoken labels for occupied squares MUST name the actual opponent ("Random mover", "Perfect player" or "you").
- **FR-013**: The opponent selector MUST announce its visible label "Opponent" and the currently selected option to assistive technology.
- **FR-014**: The page MUST declare its language as English. It MUST include the declarations that make browsers render it in standard mode rather than legacy compatibility mode.
- **FR-015**: Learning-curve labels MUST be at least 10 px tall at screen widths from 320 px up, and the page MUST NOT scroll sideways at those widths.
- **FR-016**: Screen-reader announcements during a game MUST give each move and the final result once each, without announcing passing messages that are replaced at once.

#### Opponents and feedback

- **FR-017**: The perfect player MUST take an immediate win when one is available, and MUST prefer the quickest win among equally good moves.
- **FR-018**: When the perfect player has several equally good moves, its choice MUST be able to vary between games and MUST NOT become fixed after it first meets a position.
- **FR-019**: When a game is won, the winning line MUST be highlighted on the board and named in the result announcement.
- **FR-020**: Once opened, the learning-curve table MUST stay open as new games are added. Its rows MUST state that each figure is the rolling 20-game rate as at the last game in the range.

#### Bead rule

- **FR-021**: The visitor MUST be able to choose between two bead rules:
  - **Michie's 1963 rule**: moves that are equivalent by symmetry share one bead colour.
  - **One colour per square**: every free square has its own beads.
- **FR-022**: Michie's 1963 rule MUST be selected when the page first opens.
- **FR-023**: Under Michie's 1963 rule, each box MUST hold beads for exactly one representative of each group of equivalent moves, with starting counts of 4/3/2/1 by move number. When such a bead is drawn, MENACE MUST play one of the squares in that group.
- **FR-024**: Changing the bead rule MUST start a fresh MENACE (empty drawer, empty record), and only after the visitor confirms. The confirmation MUST warn that the current training will be lost unless it is saved first.
- **FR-025**: The rule in use MUST be named alongside the statistics and the learning curve.

#### Historical accuracy

- **FR-026**: The history text MUST agree with published sources: MENACE credited to Donald Michie, and Roger Chambers mentioned only for work the sources tie to him.
- **FR-027**: The "How MENACE works" text MUST describe both bead rules accurately and state which one Michie used. The claim that the page "runs the same rules" MUST be true for the rule it is made about.

#### Drawer view

- **FR-028**: The page MUST offer a view that lists every discovered box. Each entry MUST show:
  - its position, in the same symbols as the board
  - its move number
  - its beads for each move
  - its total number of beads
  - whether it is empty, meaning MENACE would resign there
- **FR-029**: The visitor MUST be able to filter the drawer view by move number (1st, 3rd, 5th, 7th) and to show only empty boxes. The view MUST state how many boxes match.
- **FR-030**: The visitor MUST be able to sort the drawer view by discovery order or by total beads.
- **FR-031**: The boxes used in the current or most recent game MUST be marked in the drawer view.
- **FR-032**: The drawer view MUST update after every finished game. During training it MUST update at the same moments as the statistics.
- **FR-033**: When no boxes have been discovered, or a filter matches none, the drawer view MUST say so and explain how boxes are discovered.

#### Save and restore

- **FR-034**: When no training run is in progress, the visitor MUST be able to save the current MENACE to a file on their own device. The file MUST hold:
  - every discovered box with its bead counts and discovery order
  - the record (games played, wins, draws, losses and the outcome sequence behind the learning curve)
  - the bead rule
  - a format version
  - the date saved
- **FR-035**: The visitor MUST be able to load a saved file. After confirmation, it MUST replace the current MENACE entirely, without merging. The restored drawer, statistics, learning curve and bead rule MUST then be shown.
- **FR-036**: A restored MENACE MUST continue from exactly the saved bead counts and record.
- **FR-037**: The page MUST reject, as a whole and with a plain explanation, any file that is:
  - not a MENACE save
  - damaged
  - in an unsupported format version
  - holding impossible values (negative bead counts, beads on occupied squares, positions that cannot occur in play, or more boxes than exist)

  After a rejection, the current MENACE MUST stay unchanged.
- **FR-038**: Loading a file saved under a different bead rule MUST switch the page to that rule and tell the visitor.

#### Preserved behaviour and shared requirements

- **FR-039**: The page MUST NOT send the visitor's games or drawer anywhere; saving and loading happen only on the visitor's device. The footer MUST explain that the drawer resets on reload unless the visitor saves it to a file.
- **FR-040**: The verified rules MUST stay unchanged under both bead rules: 304 boxes, 4/3/2/1 starting beads by move, +3/+1/−1 reinforcement, and resignation when a box is empty.
- **FR-041**: The new controls (bead rule, save, load) and the drawer view MUST meet FR-010–FR-016: AA contrast, keyboard operation, correct spoken labels and announcements, and usability at 320 px wide.
- **FR-042**: The page MUST keep its current look, its three opponents and its current controls, apart from the changes above.

### Key Entities

- **Game**: one round of noughts and crosses between MENACE and an opponent. It is *in progress*, *finished* (win, draw, loss or resignation) or *abandoned*. Only finished games are recorded.
- **Matchbox**: one position that MENACE may face on its turn, stored in a standard orientation. It records the move number it belongs to (1st, 3rd, 5th or 7th), how many beads it holds for each possible move (or each group of equivalent moves, under Michie's 1963 rule), and the order in which it was first opened.
- **Bead change**: the effect of a finished game on one box. It records which box, which move's beads, and the count before and after.
- **Record**: games played, wins, draws and losses, and the sequence of outcomes behind the rolling 20-game learning curve.
- **Opponent**: who MENACE plays against: the visitor, the random mover or the perfect player.
- **Bead rule**: whether equivalent moves share a bead colour (Michie's 1963 rule) or every free square has its own (one colour per square). One rule applies to the whole drawer.
- **Saved MENACE**: a file on the visitor's device holding a drawer, a record, a bead rule, a format version and the date saved. It can be loaded later to replace the current MENACE.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100 trials of interrupting a game at random moments (by new game, opponent switch, reset or starting training), games played always equals the number of games that actually finished. No game started before a reset is ever counted after it.
- **SC-002**: 100% of text elements, including the bead count on all nine bead colours, meet WCAG 2.1 AA contrast in both light and dark appearance.
- **SC-003**: A keyboard-only visitor can play a full game with zero extra key presses to get back to the board between moves.
- **SC-004**: In a check with at least 5 first-time viewers, at least 4 correctly name the real-board square that MENACE's drawn bead led to, using the box panel alone.
- **SC-005**: Over 500 games against the perfect player, it misses no immediate win. In every position where it has two or more equally good moves, it plays at least two different moves across 50 encounters.
- **SC-006**: Every historical statement on the page is supported by at least one of the cited sources, with no contradictions.
- **SC-007**: At a 320 px screen width, all chart labels are at least 10 px tall and the page needs no sideways scrolling. This includes the drawer view and the new controls.
- **SC-008**: Under Michie's 1963 rule, each of the 56 symmetric boxes holds exactly one bead colour per group of equivalent moves; for example, the opening box has 3 colours. Under "one colour per square", every free square in every box has beads. Both rules produce exactly 304 boxes.
- **SC-009**: After 1,000 training games, a save followed by a load in a freshly opened page reproduces 100% of the boxes, bead counts, the record, the learning curve and the bead rule.
- **SC-010**: All files in a test set of at least 10 malformed, unrelated or tampered files are rejected with an explanation, and the current MENACE is unchanged every time.
- **SC-011**: In a check with at least 5 first-time viewers, at least 4 find all empty 7th-move boxes in the drawer view within 30 seconds.

## Assumptions

- **Audience**: curious learners, teachers and students, on desktop and phone.
- **Delivery**: the simulator stays a single page that works offline, with no installation and nothing to sign in to.
- **Abandoned games**: abandoned games are discarded rather than scored. This matches the original, where only completed games were reinforced.
- **Training interrupts games**: starting auto-training while a game is showing abandons that game, the same as "New game".
- **Default bead rule**: Michie's 1963 rule is the default, because the page presents itself as a recreation of the original. "One colour per square" is the page's current behaviour and stays available.
- **Changing the bead rule resets MENACE**: a drawer built under one rule cannot be converted to the other without inventing bead counts.
- **Saved files**:
  - Each save is one file, readable in a text editor.
  - The visitor chooses where to store it.
  - The selected opponent is not saved.
- **Loading replaces**: loading replaces the current MENACE rather than merging with it.
- **Drawer view scope**: the drawer view lists discovered boxes only. Undiscovered boxes appear only in the "n / 304 discovered" count.
- **Accessibility target**: WCAG 2.1 level AA.
- **Theme**: the page keeps following the device's light or dark setting. No manual theme switch is added.
- **Already correct**: the count of 304 boxes and the 4/3/2/1 and +3/+1/−1 rules were verified and are not to be changed. The bead rule becomes selectable (FR-021–FR-025), but these numbers stay the same under both rules.
- **No project principles**: the project constitution is still an unfilled template, so no project principles constrained this specification.
- **Sources used for the history checks**:
  - [Michie (1963), "Experiments on the mechanization of game-learning"](https://www.gwern.net/docs/rl/1963-michie.pdf)
  - [Wikipedia: MENACE](https://en.wikipedia.org/wiki/Matchbox_Educable_Noughts_and_Crosses_Engine)
  - [Wikipedia: Donald Michie](https://en.wikipedia.org/wiki/Donald_Michie)
  - [M. Scroggs, MENACE reimplementation notes](https://www.mscroggs.co.uk/menace/)
