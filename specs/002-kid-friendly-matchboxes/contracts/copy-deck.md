# Contract: the copy deck (`<script type="application/json" id="menace-copy">`)

All text shown in simple-words mode lives in this one inline JSON block inside `index.html`.

- **Readers.** The UI reads it with `JSON.parse(document.getElementById("menace-copy").textContent)`. The tests read the same block from the file with `tests/helpers/load-copy.mjs` ([research K8](../research.md#k8-simple-words-a-testable-copy-deck-fr-013fr-015-sc-006)).
- **Simple words off.** The page uses feature 001's own text, which is not in the deck.

## Shape

```json
{
  "placeholders": {
    "colour": "blue",
    "shape": "star",
    "n": "3",
    "box": "7",
    "board": "5",
    "opponent": "Random mover"
  },
  "wordList": ["reinforcement", "reinforce", "symmetry", "symmetric", "canonical", "orientation", "transform",
               "rolling", "rate", "resign", "resigns", "resigned", "stabiliser", "algorithm", "probability",
               "representative"],
  "steps": {
    "find":   { "text": "…", "newBox": "…" },
    "shake":  { "text": "…" },
    "tilt":   { "text": "…" },
    "lookup": { "text": "…", "turned": "…", "shared": "…" },
    "play":   { "text": "…" },
    "forced": { "text": "…" },
    "empty":  { "text": "…", "opening": "…" }
  },
  "learning": { "win": "…", "draw": "…", "loss": "…" },
  "status":   { "yourTurn": "…", "menaceWins": "…", "youWin": "…", "opponentWins": "…", "draw": "…", "trainingDone": "…", "trainingStopped": "…" },
  "tips": {
    "new-box":    { "title": "…", "text": "…" },
    "first-win":  { "title": "…", "text": "…" },
    "first-draw": { "title": "…", "text": "…" },
    "first-loss": { "title": "…", "text": "…" },
    "turned-box": { "title": "…", "text": "…" },
    "empty-box":  { "title": "…", "text": "…" }
  },
  "story": [ { "picture": "drawer", "sentences": ["…", "…"], "alt": "…" } ],
  "compare": { "gained": "…", "lost": "…", "nothing": "…", "newBox": "…" },
  "boxPanel": { "gaveUp": "…" },
  "explains": { "<word-list term>": "<one plain sentence>" }
}
```

- **Placeholders.** Each placeholder in a sentence is written `{name}`. The `placeholders` object gives the sample value used when tests measure sentence length. Each placeholder counts as one word.
- **`explains`.** Optional. A text may use a word-list term only if the deck's `explains` entry for that term is shown in the same place. In practice the deck avoids the terms; "gives up" is used, never "resigns".

## Rules (checked by `tests/engine/copy.test.mjs`; FR-013–FR-015, SC-006)

1. **Sentence length.** Every sentence in every string, with placeholders expanded, has 15 words or fewer. Sentences are split at `.`, `!` and `?`.
2. **Word list.** No word from `wordList` appears in any string, case-insensitively and as a whole word, unless it is covered by `explains`.
3. **Story size.** `story` has 1–6 panels. Each has 1–2 sentences, a `picture` id from the known scenes and a non-empty `alt`.
4. **Story content.** Taken together, the story's text covers finding a box, drawing a bead, playing the square, and the bead changes for a win, a draw and a loss.
5. **Tip coverage.** Every FR-014 event has a tip, and each tip text has 2 sentences or fewer.
6. **Sourced facts.** Every factual statement matches the sources in [research K13](../research.md#k13-historical-statements-used-by-the-help-fr-020). This is checked by reading, at review time.
7. **Step captions** (added by T067, T069 and T070). Every caption of the five steps (`steps.find`, `shake`, `tilt`, `lookup`, `play`) is exactly one sentence (FR-006). Both shared-colour captions say the squares are the same move and that MENACE picks one of them (US4/AC2). Every `learning` caption says the move gets more or less likely or often (US3/AC4).
