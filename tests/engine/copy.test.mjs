// The simple-words copy deck (contracts/copy-deck.md; FR-013–FR-015, SC-006).
//
// Every string the page can show in simple-words mode lives in <script id="menace-copy">. These
// tests hold it to the reading-level rules, so the rules cannot drift as the text changes.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  loadCopy, copyStrings, placeholdersIn, expand, sentences, wordCount, termsIn,
} from "../helpers/load-copy.mjs";

const MAX_WORDS = 15;

/** Rule 1: every sentence, placeholders expanded (one word each), has at most 15 words. */
function longSentences(copy) {
  const out = [];
  for (const { path, text } of copyStrings(copy)) {
    for (const s of sentences(expand(text, copy.placeholders, { oneWord: true }))) {
      const n = wordCount(s);
      if (n > MAX_WORDS) out.push(`${path}: ${n} words: "${s}"`);
    }
  }
  return out;
}

/** Rule 2: no word-list term, unless the deck's `explains` covers it. */
function unexplainedTerms(copy) {
  const explained = new Set(Object.keys(copy.explains || {}).map((t) => t.toLowerCase()));
  const out = [];
  for (const { path, text } of copyStrings(copy)) {
    if (path.startsWith("explains.")) continue; // an explanation may name its own term
    for (const term of termsIn(text, copy.wordList)) {
      if (!explained.has(term.toLowerCase())) out.push(`${path}: "${term}"`);
    }
  }
  return out;
}

const SAMPLE = {
  placeholders: { colour: "blue", opponent: "Random mover" },
  wordList: ["resign", "resigns", "rate"],
  explains: {},
  steps: { ok: { text: "MENACE picks the {colour} bead. {opponent} plays next." } },
};

describe("copy-deck helpers (synthetic deck)", () => {
  test("a placeholder counts as one word, even when its sample has two", () => {
    assert.deepEqual(longSentences(SAMPLE), []);
    const [s] = sentences(expand("{opponent} plays next.", SAMPLE.placeholders, { oneWord: true }));
    assert.equal(wordCount(s), 3);
  });

  test("a 16-word sentence fails rule 1 and a 15-word one passes", () => {
    const fifteen = Array.from({ length: 15 }, (_, i) => "w" + i).join(" ") + ".";
    const sixteen = Array.from({ length: 16 }, (_, i) => "w" + i).join(" ") + ".";
    assert.deepEqual(longSentences({ ...SAMPLE, steps: { a: fifteen } }), []);
    assert.equal(longSentences({ ...SAMPLE, steps: { a: sixteen } }).length, 1);
  });

  test("sentences split at . ! and ?", () => {
    assert.deepEqual(sentences("One two. Three! Four? "), ["One two", "Three", "Four"]);
  });

  test('"resigns" fails rule 2 unless explained, and "gives up" passes', () => {
    assert.deepEqual(unexplainedTerms({ ...SAMPLE, steps: { a: "MENACE gives up." } }), []);
    assert.equal(unexplainedTerms({ ...SAMPLE, steps: { a: "MENACE resigns." } }).length, 1);
    assert.deepEqual(
      unexplainedTerms({ ...SAMPLE, steps: { a: "MENACE resigns." }, explains: { resigns: "Resigns means it gives up." } }),
      [],
    );
  });

  test("terms match whole words only", () => {
    assert.deepEqual(termsIn("It is accurate and separate.", ["rate"]), []);
    assert.deepEqual(termsIn("The Rate went up.", ["rate"]), ["rate"]);
  });
});

describe("the page's copy deck", () => {
  const copy = loadCopy();

  test("parses as an object with placeholders and a word list", () => {
    assert.equal(typeof copy, "object");
    assert.equal(typeof copy.placeholders, "object");
    assert.ok(Array.isArray(copy.wordList) && copy.wordList.length > 0);
  });

  test("the word list holds the contract's terms", () => {
    for (const term of ["reinforcement", "symmetry", "canonical", "orientation", "rolling", "rate", "resign", "resigns"]) {
      assert.ok(copy.wordList.includes(term), `wordList is missing "${term}"`);
    }
  });

  test("every {placeholder} used is defined in placeholders", () => {
    const missing = [];
    for (const { path, text } of copyStrings(copy)) {
      for (const name of placeholdersIn(text)) {
        if (!Object.prototype.hasOwnProperty.call(copy.placeholders, name)) missing.push(`${path}: {${name}}`);
      }
    }
    assert.deepEqual(missing, []);
  });

  test("rule 1: every sentence has at most 15 words", () => {
    assert.deepEqual(longSentences(copy), []);
  });

  test("rule 2: no unexplained word-list term", () => {
    assert.deepEqual(unexplainedTerms(copy), []);
  });

  test("no string is empty", () => {
    assert.deepEqual(copyStrings(copy).filter(({ text }) => text.trim() === "").map(({ path }) => path), []);
  });
});

describe("the deck's story, tips, status and learning entries (rules 3–5)", () => {
  const copy = loadCopy();
  const SCENES = ["drawer", "find", "shake", "lookup", "win", "loss"];
  const TIP_EVENTS = ["new-box", "first-win", "first-draw", "first-loss", "turned-box", "empty-box"];
  const STATUS_KEYS = ["yourTurn", "menaceWins", "youWin", "opponentWins", "draw", "trainingDone", "trainingStopped"];
  const count = (text) => sentences(expand(text, copy.placeholders, { oneWord: true })).length;

  test("rule 3: the story has 1–6 panels, each with a known picture, 1–2 sentences and alt text", () => {
    assert.ok(Array.isArray(copy.story) && copy.story.length >= 1 && copy.story.length <= 6, `${copy.story.length} panels`);
    copy.story.forEach((panel, i) => {
      assert.ok(SCENES.includes(panel.picture), `panel ${i + 1}: unknown picture "${panel.picture}"`);
      assert.ok(Array.isArray(panel.sentences) && panel.sentences.length >= 1 && panel.sentences.length <= 2,
        `panel ${i + 1}: ${panel.sentences.length} sentences`);
      for (const s of panel.sentences) assert.equal(count(s), 1, `panel ${i + 1}: "${s}" is not one sentence`);
      assert.ok(typeof panel.alt === "string" && panel.alt.trim().length > 10, `panel ${i + 1}: no alt text`);
    });
  });

  test("rule 4: together the story covers the box, shaking, the bead, the square, and win, draw and loss", () => {
    const text = copy.story.flatMap((p) => p.sentences).join(" ").toLowerCase();
    for (const [what, re] of [
      ["a box", /\bbox(es)?\b/], ["shaking or tilting", /\b(shake|shakes|tilt|tilts)\b/], ["a bead", /\bbeads?\b/],
      ["a square", /\bsquares?\b/], ["a win", /\bwins?\b|\bwon\b/], ["a draw", /\bdraw\b/], ["a loss", /\bloss(es)?\b|\blos(e|es|t)\b/],
    ]) {
      assert.match(text, re, `the story never mentions ${what}`);
    }
  });

  test("rule 5: every FR-014 event has a tip with a title and at most 2 sentences", () => {
    assert.deepEqual(Object.keys(copy.tips).sort(), [...TIP_EVENTS].sort());
    for (const event of TIP_EVENTS) {
      const tip = copy.tips[event];
      assert.ok(tip.title && tip.title.trim(), `${event}: no title`);
      const n = count(tip.text);
      assert.ok(n >= 1 && n <= 2, `${event}: ${n} sentences`);
    }
  });

  test("every status message of the contract exists", () => {
    for (const key of STATUS_KEYS) assert.equal(typeof copy.status[key], "string", `status.${key} is missing`);
  });

  test("each learning caption has 1–2 sentences, one per result", () => {
    assert.deepEqual(Object.keys(copy.learning).sort(), ["draw", "loss", "win"]);
    for (const [result, text] of Object.entries(copy.learning)) {
      const n = count(text);
      assert.ok(n >= 1 && n <= 2, `learning.${result}: ${n} sentences`);
    }
  });

  test("each learning caption says how the move's chances change (US3/AC4)", () => {
    const change = /\b(more|less)\s+(likely|often)\b/i;
    for (const [result, text] of Object.entries(copy.learning)) {
      assert.match(text, change, `learning.${result} does not say the move gets more or less likely: "${text}"`);
    }
  });
});

describe("the step captions (FR-006, US2/AC1, US4/AC2)", () => {
  const copy = loadCopy();
  const FIVE = ["find", "shake", "tilt", "lookup", "play"];
  const count = (text) => sentences(expand(text, copy.placeholders, { oneWord: true })).length;

  test("every caption of the five steps is exactly one sentence", () => {
    const long = [];
    for (const step of FIVE) {
      for (const [variant, text] of Object.entries(copy.steps[step])) {
        if (count(text) !== 1) long.push(`steps.${step}.${variant}: ${count(text)} sentences: "${text}"`);
      }
    }
    assert.deepEqual(long, []);
  });

  test("a shared-colour caption says the squares are one move and MENACE picks one of them", () => {
    for (const variant of ["shared", "turnedShared"]) {
      const text = copy.steps.lookup[variant];
      assert.match(text, /\bsame move\b/, `steps.lookup.${variant} does not say the squares are the same move`);
      assert.match(text, /\bone of them\b/, `steps.lookup.${variant} does not say MENACE picks one of the squares`);
    }
  });
});
