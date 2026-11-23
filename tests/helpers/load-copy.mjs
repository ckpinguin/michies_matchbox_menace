// Loads the simple-words copy deck straight out of index.html (contracts/copy-deck.md).
//
// The deck lives in <script type="application/json" id="menace-copy">. It is plain data, read by
// the page with JSON.parse and by the tests through this helper, so the text that is checked
// against the reading-level rules is the text that ships.

import { readFileSync } from "node:fs";
import { INDEX_HTML } from "./load-engine.mjs";

const COPY_BLOCK = /<script\b(?=[^>]*\bid=["']menace-copy["'])(?=[^>]*\btype=["']application\/json["'])[^>]*>([\s\S]*?)<\/script>/i;

/** Returns the raw JSON text of the copy deck, or throws if the block is missing. */
export function copySource(html = readFileSync(INDEX_HTML, "utf8")) {
  const m = COPY_BLOCK.exec(html);
  if (!m) {
    throw new Error(
      `No <script type="application/json" id="menace-copy"> block found in ${INDEX_HTML} ` +
        "(contracts/copy-deck.md; task T005).",
    );
  }
  return m[1];
}

/** Parses and returns the copy deck. */
export function loadCopy(html) {
  return JSON.parse(copySource(html));
}

// Keys whose values are never shown as sentences.
const SKIP_TOP = new Set(["placeholders", "wordList"]);

/**
 * Every string the page can show, as [{ path, text }], with dotted paths such as
 * "steps.find.text" or "story.0.sentences.1". Skips `placeholders`, `wordList` and each story
 * panel's `picture` id. The keys of `explains` are word-list terms, not text; their values are.
 */
export function copyStrings(copy) {
  const out = [];
  const walk = (value, path) => {
    if (typeof value === "string") {
      out.push({ path: path.join("."), text: value });
    } else if (Array.isArray(value)) {
      value.forEach((v, i) => walk(v, [...path, String(i)]));
    } else if (value && typeof value === "object") {
      for (const [key, v] of Object.entries(value)) {
        if (path.length === 0 && SKIP_TOP.has(key)) continue;
        if (path[0] === "story" && path.length === 2 && key === "picture") continue;
        walk(v, [...path, key]);
      }
    }
  };
  walk(copy, []);
  return out;
}

/** The placeholder names used in a text, e.g. ["colour", "board"]. */
export function placeholdersIn(text) {
  return [...text.matchAll(/\{([a-zA-Z]+)\}/g)].map((m) => m[1]);
}

/**
 * Replaces every {name} with its sample value from `placeholders`. With `oneWord`, a value of
 * several words is joined with "_", because the contract counts each placeholder as one word.
 */
export function expand(text, placeholders, { oneWord = false } = {}) {
  return text.replace(/\{([a-zA-Z]+)\}/g, (whole, name) => {
    if (!Object.prototype.hasOwnProperty.call(placeholders, name)) return whole;
    const value = String(placeholders[name]);
    return oneWord ? value.replace(/\s+/g, "_") : value;
  });
}

/** Splits a text into sentences at ".", "!" and "?" (rule 1). Empty pieces are dropped. */
export function sentences(text) {
  return text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => /[\p{L}\p{N}]/u.test(s));
}

/** Words in a sentence: whitespace-separated tokens, not counting lone dashes. Symbols such as ◯ count. */
export function wordCount(sentence) {
  return sentence.split(/\s+/).filter((w) => w.length > 0 && w !== "—" && w !== "–").length;
}

/** The word-list terms a text uses, as whole words, case-insensitively. */
export function termsIn(text, wordList) {
  const lower = text.toLowerCase();
  return wordList.filter((term) => new RegExp(`(^|[^\\p{L}])${term.toLowerCase()}([^\\p{L}]|$)`, "u").test(lower));
}
