# Contract: Page UI (controls, semantics, announcements)

This is what visitors and assistive technology can rely on. Where nothing is said here, the existing look and controls stay as they are (FR-042).

## Document

- Starts with `<!doctype html>` and `<html lang="en">`, with a `<head>` (charset, viewport, title, description, styles) and a `<body>` (FR-014).
- `document.compatMode === "CSS1Compat"`.
- Makes no network requests and uses no external resources (FR-039).

## Controls card

| Control | Element and semantics | Behaviour |
| --- | --- | --- |
| Opponent | Group `aria-labelledby` its visible "Opponent" label. Three buttons with `aria-pressed`. | Abandons the current game and starts a new one (FR-001, FR-013) |
| Bead rule *(new)* | Group `aria-labelledby` its "Bead rule" label. Buttons "Michie 1963" and "One per square" with `aria-pressed`, plus a one-line hint. | Confirmation dialog if the MENACE is trained → fresh MENACE under the new rule (FR-021–FR-024) |
| Auto-train | "Run 20 / 100 / 500" and "Stop" | Abandons the current game. Time-sliced run. Final message gives `done` of `target` (FR-004, FR-005) |
| New game | Button | Abandons the current game and starts a new one |
| Reset MENACE | Button with the existing "click again" confirmation | Abandons the current game; fresh MENACE with the same rule |
| Save MENACE… *(new)* | Button in a "Your MENACE" group | Downloads the save file ([save-file.md](./save-file.md)). Announces "Saved MENACE: N games". |
| Load MENACE… *(new)* | Button that opens a hidden `<input type="file" accept=".json,application/json">` | Validate → (confirm) → replace; or a plain rejection message (FR-035–FR-038) |

While training runs, every control except **Stop** is unavailable: `disabled` for buttons outside the board.

## Confirmation dialog *(new)*

- A native `<dialog>` opened with `showModal()`.
- It is labelled by its heading and described by its body text.
- Focus starts on the safest button (**Cancel**). Esc cancels, and focus returns to the control that opened the dialog.

| Trigger | Body | Buttons |
| --- | --- | --- |
| Rule change (trained MENACE) | "Switching the bead rule starts a fresh MENACE. Your N games of training will be lost unless you save first." | Save MENACE… · Cancel · Switch and start fresh |
| Load (trained MENACE) | "Replace your current MENACE (N games, rule) with the saved one (M games, rule, saved on date)?" | Cancel · Replace |

## Board

- A container with `role="grid"` and the label "Noughts and crosses board", made of three rows of three square buttons.
- The squares are created **once** and updated in place.
- **Roving tabindex**: exactly one square has `tabindex="0"`. Arrow keys move between squares, Home and End jump to squares 1 and 9, and Enter or Space plays.
- A square that can't be played has `aria-disabled="true"`. It stays focusable and ignores activation.
- **Labels**: "Board square n, empty", "Board square n, MENACE's nought" or "Board square n, ‹opponent›'s cross". The opponent is "your" for the human, otherwise "Random mover" or "Perfect player" (FR-012).
- **Winning squares** get `class="win"` (outline plus tint, readable without colour). Their label adds ", winning line" (FR-019).
- **State hooks** *(added in implementation; used by the browser checks)*: the board has `data-state="idle" | "playing" | "over"` and `data-turn="human"` while it waits for the visitor. Each square has `data-mark`. The controls card has `data-training="idle" | "running"`.

## Status line and live region

| Message kind | Visible | Spoken (`aria-live="polite"`) |
| --- | --- | --- |
| "MENACE is shaking a box…" / "‹Opponent› is thinking…" | yes | **no** |
| "MENACE drew a bead and played board square n." / "‹Opponent› played board square n." | yes | yes |
| Result: "MENACE wins on board squares 1, 5, 9. +3 beads to every box it used." / draw / loss / resignation | yes | yes |
| Opening box empty (FR-006) | yes, persistent until reset or load | yes |
| Training: start, "Training finished: N games." / "Training stopped after k of N games." / auto-stop reason | yes | yes (start and end only) |
| Save, load and rejection messages | yes | yes |

## Box panel ("The boxes MENACE used this game")

- **Position code**: written with ◯ (MENACE), ✕ (opponent) and · (empty), with a legend line: "◯ MENACE · ✕ opponent · · empty" (FR-007).
- **Orientation notice**: shown when `transformIndex ≠ 0`. "This box shows the board ‹transform name›. The bead for box square c was played on board square r." (FR-008)
- **Shared-colour notice** *(added in Convergence, T080)*: shown when `transformIndex = 0` but the drawn bead stands for several squares (Michie 1963). "The bead for box square c (same as d, e) was played on board square r." (US6/AC4). The drawn bead's ledger row has `class="drawn"`.
- **Ledger**: one row per move group: "box square c (same as d, e) — k beads", plus the ± badge after commit. Badge text uses the `--status-*-ink` tokens.
- **Resigned box**: an entry with the existing message. An empty *opening* box adds the reset/load hint.

## Stats row

- The existing tiles stay.
- A **new tile** reads "Bead rule: Michie 1963" or "Bead rule: one per square" (FR-025).
- "Boxes discovered" counts committed boxes only.

## Learning curve

- Drawn at the container's real pixel width. Labels are 11 px, and never under 10 px at widths ≥ 320 px (FR-015).
- The eyebrow reads "Rolling last 20 games · ‹rule› rule".
- **Table toggle**: a button with `aria-expanded`. Its state persists across re-renders. The button and the table are created once; an update redraws only the last partial row and appends the new rows (Convergence, T078), so keyboard focus stays on the toggle.
- **Table**: `<caption>` "Rolling 20-game rates, as at the last game in each range". Headers: Games · Win rate · Draw rate · Loss rate (FR-020).

## Drawer view *(new)*

| Part | Semantics |
| --- | --- |
| Section | `<section aria-labelledby>` with the heading "The drawer" |
| Disclosure | Button "Open the drawer · n boxes" ("Close the drawer · n boxes" while open) with `aria-expanded` and `aria-controls`. Collapsed by default. |
| Move filter | `<fieldset>` with `<legend>`Move`</legend>` and radio buttons All / 1st / 3rd / 5th / 7th |
| Empty filter | Checkbox "Only empty boxes" |
| Sort | `<label>` + `<select>`: Discovery order / Most beads / Fewest beads |
| Count | "Showing n of m discovered boxes". Announced politely only after a filter or sort change. |
| List | `<ul>` of `<li>` cards (`content-visibility: auto`, so off-screen cards cost nothing to lay out). Each card has a heading "Box #i · kth move · b beads", a mini-board (`aria-hidden`) with an sr-only bead list, and badges "Used last game" and "Empty: MENACE resigns here". |
| Empty states | "MENACE opens a box the first time it meets a position. Play or train a game to fill the drawer." / "No boxes match these filters. MENACE opens a box the first time it meets a position, so more appear as it plays." (FR-033) |

## Visual tokens (contrast)

Every text colour meets ≥ 4.5:1 against its rendered background in light and dark appearance (FR-010).

- The new tokens and the adjusted bead colours are listed in [research R6](../research.md#r6-contrast-fr-010-sc-002). Each is defined in all three theme blocks: the default, `prefers-color-scheme: dark` and `[data-theme]`.
- Disabled controls are exempt, as WCAG allows, but they stay at least 3:1.

## Footer

"Nothing here is sent anywhere. The drawer lives in this tab and resets on reload, unless you save it to a file on your device with *Save MENACE*." (FR-039)
