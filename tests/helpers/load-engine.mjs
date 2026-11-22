// Loads the MENACE engine straight out of index.html, so the code under test is the code shipped.
//
// The engine lives in <script id="menace-engine"> and defines one global, MenaceEngine
// (contracts/engine-api.md). It is evaluated with node:vm in a fresh context that has no DOM,
// no timers and no host APIs. Math.random and Date are poisoned there, because the engine must
// take randomness and time as injected parameters (constitution Principle V).

import { readFileSync } from "node:fs";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

export const INDEX_HTML = fileURLToPath(new URL("../../index.html", import.meta.url));

const ENGINE_BLOCK = /(<script\b[^>]*\bid=["']menace-engine["'][^>]*>)([\s\S]*?)<\/script>/i;

/** Returns { source, lineOffset } for the engine block, or throws if it is missing. */
export function engineSource(html = readFileSync(INDEX_HTML, "utf8")) {
  const m = ENGINE_BLOCK.exec(html);
  if (!m) {
    throw new Error(
      `No <script id="menace-engine"> block found in ${INDEX_HTML}. ` +
        "The engine has not been split out of the page yet (tasks T010–T015).",
    );
  }
  const before = html.slice(0, m.index + m[1].length);
  return { source: m[2], lineOffset: before.split("\n").length - 1 };
}

const PRELUDE = `
  "use strict";
  Math.random = function () {
    throw new Error("MenaceEngine must use the injected rng, not Math.random");
  };
  globalThis.Date = undefined;
`;

/** Evaluates the engine in a fresh, DOM-free context and returns MenaceEngine. */
export function loadEngine() {
  const { source, lineOffset } = engineSource();
  const context = vm.createContext({});
  vm.runInContext(PRELUDE, context, { filename: "engine-prelude" });
  const script = new vm.Script(`${source}\n;MenaceEngine;`, {
    filename: INDEX_HTML,
    lineOffset,
  });
  const engine = script.runInContext(context);
  if (!engine || typeof engine !== "object") {
    throw new Error("The menace-engine block did not define a MenaceEngine object.");
  }
  return engine;
}

/**
 * Copies a value from the engine's realm into this one, so that assert.deepStrictEqual
 * (which compares prototypes) can compare it with literals written in a test.
 */
export function plain(value) {
  return structuredClone(value);
}
