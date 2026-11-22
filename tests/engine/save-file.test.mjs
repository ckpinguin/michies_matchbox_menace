// Saving and loading a MENACE (US8; FR-034–FR-038; SC-009, SC-010; contracts/save-file.md).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { loadEngine, plain } from "../helpers/load-engine.mjs";
import { mulberry32 } from "../helpers/rng.mjs";

const E = loadEngine();
const fixtures = fileURLToPath(new URL("../fixtures/saves/", import.meta.url));
const read = (rel) => readFileSync(path.join(fixtures, rel), "utf8");
const NOW = "2026-11-22T14:03:11.000Z";

async function trained(games, beadRule, seed) {
  const rng = mulberry32(seed);
  const menace = E.createMenace({ beadRule });
  const opponent = (board) => Promise.resolve(rng() < 0.5 ? E.randomMove(board, rng) : E.perfectMove(board, rng));
  for (let i = 0; i < games; i++) await E.playGame({ menace, opponent, rng });
  return menace;
}

for (const beadRule of ["michie1963", "perSquare"]) {
  test(`${beadRule}: after 1,000 games, parseSave(serialize(m)) reproduces m exactly`, async () => {
    const menace = await trained(1000, beadRule, beadRule === "perSquare" ? 1 : 2);
    const text = E.serialize(menace, { now: NOW });
    const result = E.parseSave(text);
    assert.equal(result.ok, true, result.message);
    assert.deepStrictEqual(plain(result.menace), plain(menace));
    assert.equal(result.savedAt, NOW);
  });
}

test("serialize writes the documented, readable format", async () => {
  const menace = await trained(25, "michie1963", 3);
  const text = E.serialize(menace, { now: NOW });
  const json = JSON.parse(text);
  assert.equal(json.format, "menace-drawer");
  assert.equal(json.version, 1);
  assert.equal(json.savedAt, NOW);
  assert.equal(json.beadRule, "michie1963");
  assert.deepEqual(Object.keys(json.record), ["gamesPlayed", "win", "draw", "loss", "outcomes"]);
  assert.equal(json.record.outcomes, menace.record.outcomes);
  assert.equal(json.boxes.length, menace.boxes.size);
  json.boxes.forEach((b, i) => {
    assert.deepEqual(Object.keys(b), ["position", "moveNumber", "discoveryIndex", "beads"]);
    assert.equal(b.discoveryIndex, i + 1, "boxes are written in discovery order");
  });
  assert.match(text, /^\{\n {2}"format": "menace-drawer",\n/, "two-space indentation");
  assert.ok(text.endsWith("}\n"));
});

test("an untrained MENACE can be saved and loaded (edge case: saving early)", () => {
  const result = E.parseSave(E.serialize(E.createMenace(), { now: NOW }));
  assert.equal(result.ok, true);
  assert.equal(result.menace.boxes.size, 0);
  assert.equal(result.menace.record.gamesPlayed, 0);
});

test("the valid fixtures are accepted", () => {
  for (const file of readdirSync(path.join(fixtures, "valid"))) {
    const result = E.parseSave(read(`valid/${file}`));
    assert.equal(result.ok, true, `${file}: ${result.message}`);
  }
  const example = E.parseSave(read("valid/example-michie1963.json")).menace;
  assert.equal(example.beadRule, "michie1963");
  assert.equal(example.boxes.size, 2);
  assert.equal(example.discoveryCount, 2);
  assert.deepEqual(plain(example.boxes.get("....O...X").groups), [[0], [1, 3], [2, 6], [5, 7]]);
  assert.deepEqual(plain(example.record), { gamesPlayed: 3, win: 1, draw: 1, loss: 1, outcomes: "LDW" });
});

test("every invalid fixture is rejected with the code its name gives", () => {
  const files = readdirSync(path.join(fixtures, "invalid"));
  assert.ok(files.length >= 12, `only ${files.length} invalid fixtures`);
  for (const file of files) {
    const expected = file.split("--")[0];
    const result = E.parseSave(read(`invalid/${file}`));
    assert.equal(result.ok, false, `${file} was accepted`);
    assert.equal(result.code, expected, `${file}: got ${result.code}`);
    assert.ok(typeof result.message === "string" && result.message.length > 10, `${file}: no plain message`);
    assert.equal(result.menace, undefined);
  }
  assert.match(E.parseSave(read("invalid/unsupported-version--version-2.json")).message, /newer version/);
});

test("text over 5 MB is rejected as too-large", () => {
  const valid = read("valid/example-michie1963.json");
  const padded = valid.replace("{", "{" + " ".repeat(5 * 1024 * 1024));
  assert.equal(E.parseSave(padded).code, "too-large");
  // Multi-byte characters count as bytes, not characters.
  const wide = "{" + "é".repeat(2.7 * 1024 * 1024) + "}";
  assert.equal(E.parseSave(wide).code, "too-large");
});

test("parseSave never throws, whatever it is given (200 seeded mutations)", () => {
  const rng = mulberry32(99);
  const base = JSON.parse(read("valid/example-michie1963.json"));
  const junk = [null, -1, 1.5, 1e9, "", "x", [], {}, true, [1, 2], { a: 1 }, NaN, "........."];
  const pick = (list) => list[Math.floor(rng() * list.length)];

  function paths(value, prefix = []) {
    if (value === null || typeof value !== "object") return [prefix];
    return [prefix, ...Object.keys(value).flatMap((k) => paths(value[k], [...prefix, k]))];
  }

  for (let n = 0; n < 200; n++) {
    let text;
    const kind = n % 4;
    if (kind === 3) {
      const valid = JSON.stringify(base, null, 2);
      text = valid.slice(0, Math.floor(rng() * valid.length)); // truncated
    } else {
      const copy = structuredClone(base);
      const target = pick(paths(copy).filter((p) => p.length > 0));
      const parent = target.slice(0, -1).reduce((o, k) => o[k], copy);
      const key = target.at(-1);
      if (kind === 0) parent[key] = pick(junk);
      else if (kind === 1) delete parent[key];
      else parent[key] = Array.isArray(parent[key]) ? [...parent[key], pick(junk)] : pick(junk);
      text = JSON.stringify(copy);
    }
    let result;
    assert.doesNotThrow(() => {
      result = E.parseSave(text);
    }, `mutation ${n}`);
    assert.equal(typeof result.ok, "boolean");
    if (!result.ok) assert.equal(typeof result.code, "string");
  }
  for (const input of [undefined, null, 42, {}, "null", "[]", "42", '"text"']) {
    assert.doesNotThrow(() => E.parseSave(input));
    assert.equal(E.parseSave(input).ok, false);
  }
});
