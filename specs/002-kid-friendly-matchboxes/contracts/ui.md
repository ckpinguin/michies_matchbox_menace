# Contract: kid-friendly UI

This adds to feature 001's [UI contract](../../001-simulator-quality-improvements/contracts/ui.md), which still holds in full: controls, the board, the live region, the box panel, the drawer, contrast and 320 px. Where nothing is said here, feature 001's contract applies.

## Helps group (controls card)

| Control | Element and semantics | Behaviour |
| --- | --- | --- |
| Step by step | Button with `aria-pressed`, in a group `aria-labelledby` its visible label "Helps" | Turns on step sequences and bead movements for later moves. A move already under way finishes in its current mode. |
| One step at a time / Play by itself | Segmented pair with `aria-pressed`. Shown only while Step by step is on. | Sets `ui.help.pacing`. |
| Simple words | Button with `aria-pressed` | Switches the status messages, captions and tips to the copy deck, and back. |

The controls are disabled during training, like the other controls (feature 001). Settings reset on reload.

## Matchbox picture (always on)

- **Box panel.** Each entry in "The boxes MENACE used this game" gains a matchbox picture next to the existing mini-board and ledger, which stay unchanged.
- **Semantics.** The picture is an inline `<svg role="img">` with an `aria-label` (see `MatchboxPicture.label` in [data-model.md](../data-model.md)).
- **Beads.** Each bead is a 10 px disc in `--cat-N`, with its shape in `--cat-N-ink`. A heap shows "× n" in `--ink` on the tray.
- **Drawn bead.** It is shown outside the tray, next to the box, with a 2 px `--accent` outline.

## Step area (board card, below the status line)

| Part | Semantics |
| --- | --- |
| Region | `<section aria-label="How MENACE is moving">`. Hidden unless a step or learning sequence is running. |
| Indicator | "Step k of 5". This is text, not a live region. |
| Matchbox | The current box's picture. During `shake` the picture moves in a fixed side-to-side pattern. During `tilt` the drawn bead rolls to the front. |
| Caption | Visible text. Each new caption is announced once through `setStatus`/`announce` (feature 001 live-region rules). |
| Next | Button. Shown when `pacing = "manual"`. It advances one step, and focus stays on it. |
| Pause / Play | Toggle button with `aria-pressed`. Shown when `pacing = "auto"`. |
| Replay turn | Button. Shown only for turned boxes. It replays the face animation. |

**Board during steps**:

- MENACE's new mark is not drawn until step `play`.
- At `lookup` the target squares get a bead marker (a disc with its shape) and the label suffix ", MENACE's bead points here".
- Markers are removed when `play` places the ◯.

**Interruption**:

- **Stop rule.** Any FR-001 interruption from feature 001 ends the sequence at once, hides the region and leaves no trace.
- **Focus.** Focus returns to the board's roving square if it was in the step area.

## Learning sequence (end of game, Step by step on)

The step area shows each used box in turn, with beads moving in or out (K10) and the learning caption. Next, or the automatic timing, moves to the next box. When it finishes, the region hides. Starting a new game skips any remainder.

## Tips (Simple words on)

- **Layout.** A tip is a `<section role="note">` with an `<h3>` title, a short text and a **Got it** button. It appears above the status line.
- **Announcing.** Its title and text are announced once.
- **Closing.** Esc or **Got it** closes it. It never takes focus by itself.

## Picture story

- **Section.** A `<section aria-labelledby>` titled "How MENACE learns: the picture story", collapsed by default behind a disclosure button with `aria-expanded`. It sits before "How MENACE works".
- **Panels.** It shows panels 1–6 in a list. Each panel has an `<svg role="img" aria-label>` scene and its sentences.
- **Wording.** It always uses the copy deck, whatever the Simple words setting.

## "What changed?" panel (after a training run)

- **Placement.** It appears below the learning curve after a training run finishes, as a `<section aria-labelledby>` with the heading "What changed in the last training run?".
- **Box picker.** A `<label>` and `<select>`, listing the opening box first and then boxes in discovery order.
- **Pictures.** Two matchbox pictures labelled "Before" and "After".
- **Summary.** One summary sentence from the copy deck.
- **Clearing.** It is cleared on reset, rule change and load.

## Reduced motion

With `prefers-reduced-motion: reduce`, no element animates. Shaking, rolling, bead drops, the face turn and highlight pulses are replaced by their final pictures, and every caption still appears.

## Contrast and layout

- **Contrast.** All new text, marks and heap counts are at least 4.5:1, and outlines and markers at least 3:1, in both themes. The existing tokens are used, and any new token must be defined in all four theme blocks.
- **Layout.** At 320 px, the step area and the matchbox picture fit without sideways scrolling.
