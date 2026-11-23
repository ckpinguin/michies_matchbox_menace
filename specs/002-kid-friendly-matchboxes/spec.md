# Feature Specification: Matchboxes a Kid Can Follow

**Feature Branch**: `002-kid-friendly-matchboxes` (spec directory name; no branch was created)

**Created**: 2026-11-22

**Status**: Draft

**Input**: User description: "this looks too theoretical, can you show some matchboxes and other helps on the way so a kid could understand the process too?"

## Context: why the page feels theoretical

After feature 001 the page is accurate and accessible, but it explains MENACE the way a reference book would:

- **Boxes are shown as data.** Each box is a 3×3 grid of coloured circles with numbers, plus a list such as "box square 1 (same as 3, 7, 9) — 4 beads". Nothing looks like a matchbox, and nothing looks like beads in a box.
- **The physical process is only described in words.** The real MENACE worked by hand. The operator found the box for the position, shook it, tilted it, and played the square named by the first bead that rolled to the front. Then they added or took away beads. The page jumps straight from the box to the move, so a child never sees the shaking, the bead or the bookkeeping happen.
- **The language is for adults.** The page uses words such as "reinforcement", "symmetry", "canonical orientation", "rolling 20-game rate" and "resign" with little or no explanation.
- **Learning over time is a line chart.** A child cannot see that a particular box is filling up with the beads that win and running out of the beads that lose.

The goal is that a child of about 8 to 12, alone or with a parent or teacher, can watch MENACE and explain how it picks a move and how it learns.

## Clarifications

### Session 2026-11-22

- **Q**: How should the kid-friendly view fit into the page: an optional mode, the new default, or shown alongside today's view? → **A**: Alongside (option C).
  - Matchbox pictures are always shown, next to today's detailed box panel.
  - The step-by-step pacing (User Story 2, and the bead movements of User Story 3) and the simple words and tips (User Story 5) are optional helps that the visitor turns on and off.
  - Today's detailed view stays as it is.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Seeing real matchboxes and beads (Priority: P1)

A child watches MENACE make a move. Next to today's grid of numbered circles, they now also see a matchbox. Its face shows a drawing of the board position, as Michie's boxes did, and its open tray holds round coloured beads that can be counted. The bead MENACE draws is the one that rolls out, and its colour matches a square on the board.

**Why this priority**: this is the heart of the request ("show some matchboxes"). Every other help in this feature points at these boxes and beads, so it has to come first. It is useful on its own even without the step-by-step guide.

**Independent Test**: play one game against the random mover. For every box MENACE uses, check that it looks like a matchbox, that its beads can be counted one by one (or, for large piles, read from a clear count), and that the drawn bead's colour matches the board square that was played.

**Acceptance Scenarios**:

1. **Given** MENACE has just used a box, **When** a child looks at the box, **Then** they see a matchbox with a drawing of the board position on it and an open tray of round beads in the box's colours.
2. **Given** a box holds 12 or fewer beads of a colour, **When** it is shown, **Then** each of those beads is drawn separately, so the child can count them.
3. **Given** a box holds more than 12 beads of a colour, **When** it is shown, **Then** that colour is drawn as a heap and its number is written next to it.
4. **Given** MENACE has drawn a bead, **When** the move is shown, **Then** that bead is shown outside the box, and the board square it stands for is marked with the same colour and the same symbol until MENACE's mark appears there.
5. **Given** a child who cannot tell some colours apart, **When** they compare a bead with the board, **Then** they can still match them, because every bead and its square also share a symbol or number, not only a colour.
6. **Given** a box has no beads left, **When** MENACE meets it, **Then** the tray is shown empty and a simple caption explains that MENACE has nothing to draw, so it gives up the game.

---

### User Story 2 - Following a move step by step (Priority: P2)

A child, or a teacher at the front of a class, wants to see what happens inside MENACE during one move. The move unfolds in five short steps. Each step has a one-sentence caption, and the thing it talks about is highlighted:

1. Find the matchbox that matches the board.
2. Shake the box.
3. Tilt it: the first bead to roll to the front is the one MENACE uses.
4. Look at the bead's colour to find its square.
5. Put MENACE's mark on that square.

**Why this priority**: seeing the steps in order is what turns the matchboxes from a picture into a process a child can retell. It depends on the matchboxes from Story 1.

**Independent Test**: turn the step-by-step help on and watch one MENACE move. Check that the five steps appear in order, each with its caption and highlight, and that the move only happens at step 5. Then check that a child can retell the steps afterwards.

**Acceptance Scenarios**:

1. **Given** the step-by-step help is on, **When** it is MENACE's turn, **Then** the five steps are shown in order, each with a caption of one short sentence and a highlight on the board, box, bead or square it talks about.
2. **Given** the step-by-step help is on, **When** the visitor chooses to go one step at a time, **Then** each step waits until they ask for the next one.
3. **Given** the step-by-step help is on, **When** the visitor chooses to let it play by itself, **Then** each step stays on screen long enough to read (at least 2 seconds), and a pause is always available.
4. **Given** MENACE meets a position for the first time, **When** step 1 is shown, **Then** the caption says that MENACE has never seen this board before, so it takes a new matchbox and fills it with beads.
5. **Given** only one empty square is left, **When** it is MENACE's turn, **Then** the steps are replaced by one caption: there is only one place left, so MENACE needs no box.
6. **Given** the step-by-step help is off, **When** MENACE moves, **Then** the game runs at its usual pace.

---

### User Story 3 - Seeing the beads go in and out after a game (Priority: P2)

At the end of a game, the child sees MENACE learn. Every matchbox used in that game is shown again:

- **Win**: three new beads of the colour that was drawn drop into each box.
- **Draw**: one new bead drops in.
- **Loss**: the drawn bead is taken out and put aside.

A caption says why in plain words, for example: "MENACE won, so it gets more of the beads that worked."

**Why this priority**: learning is the point of MENACE. Without seeing the beads change, a child may think MENACE just plays at random forever. It builds on Story 1's matchboxes.

**Independent Test**: play a game MENACE wins and a game it loses with the help on. Check that every box used shows the right number of beads arriving or leaving, that the counts afterwards match the box, and that the caption explains it simply.

**Acceptance Scenarios**:

1. **Given** MENACE wins, **When** the game ends, **Then** each box used shows three beads of the drawn colour going in, and its count goes up by three.
2. **Given** the game is a draw, **When** it ends, **Then** each box used shows one bead going in.
3. **Given** MENACE loses, **When** the game ends, **Then** each box used shows its drawn bead being taken out, and its count goes down by one.
4. **Given** any result, **When** the beads have moved, **Then** a caption of no more than two short sentences says what happened and why it makes that move more or less likely next time.

---

### User Story 4 - Understanding why a box looks turned around (Priority: P3)

Many boxes show the board turned or flipped, because one box covers all the ways of turning the same position. A child is confused when the box's picture does not look like the board. The help turns or flips the box's picture until it matches the board. Then it shows where the drawn bead's square ends up.

**Why this priority**: it removes the most confusing moment in the game, but it only comes up in some moves, and the page already explains it in words (feature 001).

**Independent Test**: play until MENACE uses a box shown in a turned orientation. Check that the box's picture visibly turns or flips to match the board, that the bead's square follows it, and that the caption explains it simply.

**Acceptance Scenarios**:

1. **Given** a box is shown in a different orientation from the board, **When** the help explains it, **Then** the box's picture turns or flips until it matches the board, and the drawn bead's square visibly lands on the board square that was played.
2. **Given** a box under Michie's 1963 rule where one bead colour stands for several squares that look the same, **When** the help explains the bead, **Then** it shows all of those squares and says, in simple words, that they are really the same move, so MENACE just picks one.
3. **Given** a child wants to see it again, **When** they ask to replay the turn, **Then** the turning is shown again.

---

### User Story 5 - Simple words and tips along the way (Priority: P3)

A child or a parent reads the page. With the simple-words help on, messages and explanations use plain words. The first time something new happens, a short tip pops up. A short picture story, "How MENACE learns", tells the whole idea in a few panels.

Examples of new things that get a tip:

- a new box is opened
- MENACE wins for the first time
- MENACE loses for the first time
- a box looks turned around
- a box is empty

**Why this priority**: it widens who can follow the page, but the pictures and steps in Stories 1 to 3 carry most of the understanding.

**Independent Test**: play a few games with the simple-words help on. Check that each kind of event shows its tip exactly once, that every message and explanation in this mode passes the reading-level rules in FR-013, and that the picture story can be read from start to end.

**Acceptance Scenarios**:

1. **Given** the simple-words help is on, **When** the page shows a status message or an explanation, **Then** it uses plain words, short sentences, and no unexplained technical term.
2. **Given** an event in the tip list happens for the first time on this visit, **When** it happens, **Then** a short tip about it appears, and it can be closed with one action.
3. **Given** a tip has been shown on this visit, **When** the same kind of event happens again, **Then** the tip does not appear again.
4. **Given** a child opens the picture story, **When** they read through it, **Then** it explains in at most 6 panels how MENACE picks a move and how its beads change after a win, a draw and a loss. Every panel has a picture and at most two short sentences.

---

### User Story 6 - Watching one box learn over many games (Priority: P4)

After a training run of many games, a child wants to see what changed. They pick a box, for example the opening box, and see its beads before and after the run side by side. They can see which colours grew and which shrank, with a sentence such as "MENACE now likes the corner much more than the edge."

**Why this priority**: it connects the single-game story to the learning curve, but it only matters once a child has understood one game.

**Independent Test**: note the opening box's beads, run 100 games, then open the comparison. Check that before and after match the real counts, and that the sentence names the colour that grew most.

**Acceptance Scenarios**:

1. **Given** a training run has finished, **When** the child opens the comparison for a box, **Then** they see that box's beads before and after the run side by side, as matchboxes.
2. **Given** the comparison is shown, **When** the child reads it, **Then** one sentence names the move (colour) that gained the most beads and, if any, the move that lost the most.

---

### Edge Cases

- **Very full boxes**: after many wins a box can hold 40 or more beads of one colour. The heap and its number must stay readable and fit the box.
- **Empty box**: MENACE gives up. The empty tray and the "nothing to draw" caption appear instead of steps 2 to 5. If it is the opening box, the caption says MENACE cannot start any game until it is reset or a saved MENACE is loaded.
- **Last free square**: no box is needed (User Story 2, scenario 5).
- **Interrupting the steps**: the visitor presses "New game", switches opponent, resets or starts training in the middle of the steps. The steps stop at once and the abandoned game leaves no trace, as for any interrupted game (feature 001).
- **Training runs**: hundreds of games are played in seconds. The step-by-step animation and the bead movements are skipped during training. Only the final result is shown, and training is no slower than with the help off.
- **The visitor's own turn**: with the help on, the caption says it is the child's turn and how to choose a square. Nothing waits on the help.
- **Reduced motion**: if the device asks for less motion, the steps, bead movements and turning boxes appear as still pictures with their captions. Nothing is lost.
- **Small screens**: a matchbox, its beads and the caption must fit a 320 px wide screen without sideways scrolling.
- **Light and dark appearance**: the matchbox drawings, beads and symbols stay clear and meet contrast requirements in both.
- **Switching the bead rule**: under "one colour per square" every free square has its own colour. Under Michie's 1963 rule some colours stand for several squares (User Story 4, scenario 2).
- **Loading a saved MENACE**: the matchboxes show the restored bead counts at once.

## Requirements *(mandatory)*

### Functional Requirements

#### Matchboxes and beads

- **FR-001**: Each box MENACE uses MUST be shown as a matchbox. Its face MUST show a drawing of the box's board position in the board's own symbols, and its open tray MUST show the box's beads.
- **FR-002**: Beads MUST be shown as individual round beads in their colours when a colour has 12 or fewer beads, and as a heap with a written count above that. The beads shown MUST always match the box's real counts.
- **FR-003**: Every bead colour MUST also carry a second mark (a symbol or number) that is shown both on the bead and on the board square it stands for, so colour is never the only way to match them.
- **FR-004**: The drawn bead MUST be shown leaving the box, and the board square it stands for MUST be marked with the same colour and mark until MENACE's piece is placed.

#### Step-by-step help

- **FR-005**: The matchbox pictures (FR-001 to FR-004) MUST always be shown, alongside today's detailed box panel, which stays as it is. The visitor MUST be able to turn two helps on and off independently: the step-by-step help (FR-006 to FR-009) and the simple-words help (FR-013 to FR-015). *(Clarified 2026-11-22: option C.)*
- **FR-006**: With the help on, each MENACE move MUST be shown as the five steps of User Story 2, in order, each with a one-sentence caption and a highlight on what it describes.
- **FR-007**: The visitor MUST be able to choose between going one step at a time and letting the steps play by themselves (each at least 2 seconds, with pause and resume).
- **FR-008**: With the help on, the end of each game MUST show the beads going into or out of every box used: +3 of the drawn colour for a win, +1 for a draw, the drawn bead taken out for a loss. A plain-words caption MUST explain why.
- **FR-009**: When a box is shown in a different orientation from the board, the help MUST turn or flip the box's picture to match the board and show where the drawn bead's square lands. The visitor MUST be able to replay this.
- **FR-010**: Under Michie's 1963 rule, when a bead stands for several equivalent squares, the help MUST show all of those squares and explain in plain words that they are the same move.
- **FR-011**: Interrupting a game (new game, opponent switch, reset, training, rule change, load) MUST stop any step sequence at once. The interrupted game MUST leave no trace, as feature 001 requires.
- **FR-012**: During training runs the step animations and bead movements MUST be skipped, so training takes no longer with the help on than with it off.

#### Simple words and tips

- **FR-013**: With the simple-words help on, all status messages, captions, tips and the picture story MUST follow these reading-level rules:
  - sentences of at most 15 words
  - no technical term from the project's word list (for example "reinforcement", "symmetry", "canonical", "rolling rate", "resign") unless it is explained in the same place in one plain sentence
- **FR-014**: A short tip MUST appear the first time on a visit that each of these happens:
  - a new box is opened
  - MENACE wins, draws or loses for the first time
  - a box is shown turned or flipped
  - MENACE gives up because a box is empty

  Each tip MUST be closable with one action and MUST NOT appear again on the same visit.
- **FR-015**: The page MUST offer a picture story, "How MENACE learns", of at most 6 panels. Each panel has a picture and at most two short sentences, and together they cover finding a box, drawing a bead, playing the square, and what happens to the beads after a win, a draw and a loss.

#### Learning over many games

- **FR-016**: After a training run, the visitor MUST be able to compare any discovered box's beads before and after the run, shown as matchboxes. One sentence names the move that gained the most beads and, if any, the move that lost the most.

#### Shared requirements

- **FR-017**: Every picture, animation and highlight MUST have a text equivalent for screen readers. Every step and caption MUST be reachable and operable by keyboard. Captions that replace each other MUST be announced once each, without filler.
- **FR-018**: When the device asks for reduced motion, every animation MUST be replaced by its final picture plus its caption.
- **FR-019**: All new pictures, symbols and text MUST meet WCAG 2.1 AA contrast in light and dark appearance, and MUST fit screens from 320 px wide without sideways scrolling.
- **FR-020**: Everything the help shows about MENACE MUST agree with the sources recorded for feature 001, for example:
  - each box shows a drawing of its position
  - the box is shaken and tilted, and the first bead to roll to the front is used
  - a win adds three beads, a draw adds one, and a loss takes the drawn bead away

  New historical or factual statements MUST be sourced in this feature's research.
- **FR-021**: The help MUST only change how MENACE is shown. MENACE's choices, bead counts, record, learning curve and saved files MUST be exactly the same with the help on or off.
- **FR-022**: The kid-friendly help MUST work offline as part of the single page, with nothing to download or install.

### Key Entities

- **Matchbox picture**: how one box is drawn. It shows the box's face with the drawing of its board position, an open tray with beads grouped by colour (individual beads, or a heap with a count above 12), and the second mark for each colour.
- **Bead mark**: the symbol or number that each bead colour shares with the board square it stands for, so colour is not the only cue.
- **Move step**: one of the five steps of a MENACE move (find, shake, tilt, look up, play). It has a caption and a highlight target.
- **Learning step**: the end-of-game change shown for each box used. It records the result, the beads added or taken out, and a caption.
- **Tip**: a short message tied to the first time an event happens on a visit, with a shown-once flag.
- **Picture story**: an ordered set of up to 6 panels, each with a picture and up to two short sentences.
- **Help settings**: whether the step-by-step help and the simple-words help are on (each separately), and whether steps advance one at a time or by themselves. The matchbox pictures are always on. These are presentation settings, not part of a MENACE, and are not saved in MENACE files.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a check with at least 5 children aged 8 to 12 who have not seen MENACE before, at least 4 can retell in their own words how MENACE picks a move (box, shake, bead, square) after watching one game with the help on.
- **SC-002**: In the same check, at least 4 of 5 children can say what happens to the beads after a win and after a loss, having watched one game of each.
- **SC-003**: In the same check, children match a drawn bead to its board square correctly in at least 9 of 10 moves, including at least one child who cannot tell red from green.
- **SC-004**: In 100% of boxes shown, the beads drawn or counted on the matchbox equal the box's real bead counts, before and after every game.
- **SC-005**: A 500-game training run takes no more than 10% longer with the help on than with it off.
- **SC-006**: 100% of sentences shown in simple-words mode have at most 15 words and contain no unexplained term from the project's word list.
- **SC-007**: With the help on, every picture has a text equivalent and every step can be done by keyboard. With reduced motion requested, no animation plays. At 320 px width nothing scrolls sideways.
- **SC-008**: Over 100 games played with the help on and 100 with it off, with the same chance outcomes, MENACE's moves, bead counts and record are identical.

## Assumptions

- **Audience**: children of about 8 to 12 who can read short sentences, on their own or with a parent or teacher, plus any beginner who finds the current page too technical. Younger children are expected to use it with an adult reading along.
- **Language**: English, like the rest of the page.
- **Builds on feature 001**: the box panel, bead rules, drawer view, save and load, and all of feature 001's accessibility and integrity guarantees stay in force and are not repeated here.
- **Where the matchboxes appear**: in the box panel ("The boxes MENACE used this game"), next to each box's existing detail, and in the before-and-after comparison (User Story 6). The drawer view keeps its compact cards, so that showing up to 304 boxes stays fast.
- **Help settings are not remembered**: the help's on/off and pacing choices reset when the page is reloaded. This keeps the privacy promise of storing nothing on the visitor's device.
- **Bead colours**: the page keeps its nine bead colours. The second mark on each bead (FR-003) is new.
- **Pictures are drawn by the page itself**: no photographs or downloaded images, in keeping with the single, offline page.
- **Historical basis**: the matchbox face drawings, the shake-and-tilt choice of the first bead to roll forward, and the bead rewards and penalties are taken from Michie's 1963 paper as recorded in feature 001's research (R14). Any new historical statement needs a source.
- **Out of scope**:
  - sound effects or read-aloud narration
  - a printable "build your own MENACE" guide
  - translations
  - changing MENACE's rules or training behaviour
- **Constitution**: v1.1.0 applies. In particular: one offline page (I), nothing stored or sent (II), accurate and sourced history (III), WCAG 2.1 AA (IV), and any engine change tested (V).
