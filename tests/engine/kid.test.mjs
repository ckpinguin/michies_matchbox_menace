// Engine additions for feature 002, "Matchboxes a Kid Can Follow"
// (specs/002-kid-friendly-matchboxes/contracts/engine-additions.md). Pure helpers that the matchbox
// pictures, the turning boxes and the before/after comparison are drawn from.

import { test } from "node:test";
import assert from "node:assert/strict";
import { loadEngine, plain } from "../helpers/load-engine.mjs";
import { mulberry32 } from "../helpers/rng.mjs";

const E = loadEngine();
const toBoard = (key) => [...key].map((c) => (c === "." ? null : c));

/* ---------- US1: bead marks and tray layout ---------- */

// research K4, in colour order.
const K4 = [
  ["blue", "star"], ["teal", "heart"], ["yellow", "triangle"],
  ["green", "square"], ["brown", "diamond"], ["purple", "moon"],
  ["red", "plus"], ["pink", "flower"], ["orange", "arrow"],
];

test("BEAD_MARKS: 9 frozen entries in research K4 order, unique names and shapes", () => {
  assert.equal(E.BEAD_MARKS.length, 9);
  assert.ok(Object.isFrozen(E.BEAD_MARKS));
  E.BEAD_MARKS.forEach((mark, i) => {
    assert.ok(Object.isFrozen(mark), `entry ${i} is not frozen`);
    assert.deepEqual(plain(mark), { colorIdx: i, colourName: K4[i][0], shape: K4[i][1] });
  });
  assert.equal(new Set(E.BEAD_MARKS.map((m) => m.colourName)).size, 9);
  assert.equal(new Set(E.BEAD_MARKS.map((m) => m.shape)).size, 9);
  for (const m of E.BEAD_MARKS) {
    assert.ok(!["circle", "nought", "cross", "x", "o", "ring"].includes(m.shape), `${m.shape} looks like ◯ or ✕`);
  }
});

test("BEAD_DISPLAY_LIMIT is 12", () => {
  assert.equal(E.BEAD_DISPLAY_LIMIT, 12);
});

test("beadLayout: totals kept, heap above the limit, only representatives with beads, in order", () => {
  const rng = mulberry32(2002);
  let boxes = 0;
  for (const rule of E.BEAD_RULES) {
    for (const key of E.reachablePositions()) {
      const groups = plain(E.moveGroups(toBoard(key), rule));
      const beads = Array(9).fill(0);
      for (const g of groups) beads[g[0]] = Math.floor(rng() * 41); // 0–40 on representatives only
      const tray = plain(E.beadLayout(beads, groups));
      boxes++;

      const reps = groups.map((g) => g[0]).filter((r) => beads[r] > 0);
      assert.deepEqual(tray.map((t) => t.colorIdx), reps, `${key}: wrong groups or order`);
      assert.equal(
        tray.reduce((s, t) => s + t.count, 0),
        beads.reduce((s, b) => s + b, 0),
        `${key}: the total changed`,
      );
      for (const t of tray) {
        assert.equal(t.count, beads[t.colorIdx]);
        assert.equal(t.display, t.count <= 12 ? "beads" : "heap");
        assert.equal(t.shown, t.display === "beads" ? t.count : 1);
      }
    }
  }
  assert.ok(boxes >= 600);
});

test("beadLayout: 12 beads are drawn one by one, 13 become a heap; the limit can be changed", () => {
  const groups = [[0, 2, 6, 8], [1, 3, 5, 7], [4]];
  const beads = [12, 13, 0, 0, 1, 0, 0, 0, 0];
  assert.deepEqual(plain(E.beadLayout(beads, groups)), [
    { colorIdx: 0, count: 12, display: "beads", shown: 12 },
    { colorIdx: 1, count: 13, display: "heap", shown: 1 },
    { colorIdx: 4, count: 1, display: "beads", shown: 1 },
  ]);
  assert.deepEqual(plain(E.beadLayout(beads, groups, 5)).map((t) => t.display), ["heap", "heap", "beads"]);
  assert.deepEqual(plain(E.beadLayout(Array(9).fill(0), groups)), [], "an empty box has an empty tray");
});

/* ---------- US4: turning the box picture to match the board ---------- */

test("PICTURE_MATRICES: 8 frozen matrices that move each box square onto TRANSFORMS[t][i]", () => {
  assert.equal(E.PICTURE_MATRICES.length, 8);
  assert.ok(Object.isFrozen(E.PICTURE_MATRICES));
  // Centres of the 9 squares, origin at the board's centre, y pointing down (CSS matrix order).
  const centre = (i) => [(i % 3) - 1, Math.floor(i / 3) - 1];
  for (let t = 0; t < 8; t++) {
    const m = E.PICTURE_MATRICES[t];
    assert.ok(Object.isFrozen(m) && m.length === 4, `matrix ${t} is not a frozen [a, b, c, d]`);
    const [a, b, c, d] = m;
    for (let i = 0; i < 9; i++) {
      const [x, y] = centre(i);
      const moved = [a * x + c * y, b * x + d * y].map((v) => v + 0); // turn −0 into 0
      assert.deepEqual(moved, centre(E.TRANSFORMS[t][i]), `t=${t}: box square ${i + 1} lands in the wrong place`);
    }
  }
  assert.deepEqual(plain(E.PICTURE_MATRICES[0]), [1, 0, 0, 1], "the identity comes first");
});

/* ---------- US6: what changed in a box ---------- */

test("beadChanges: largest gain and largest loss among representatives, ties to the lower colour", () => {
  const groups = [[0, 2, 6, 8], [1, 3, 5, 7], [4]]; // Michie 1963 opening box
  const at = (r0, r1, r4, junk = 0) => [r0, r1, junk, junk, r4, junk, junk, junk, junk];
  const changes = (before, after) => plain(E.beadChanges(before, after, groups));

  // a gain only
  assert.deepEqual(changes(at(4, 4, 4), at(10, 4, 4)), { gained: { colorIdx: 0, by: 6 }, lost: null });
  // a loss only (`by` is the number of beads lost)
  assert.deepEqual(changes(at(4, 4, 4), at(4, 1, 4)), { gained: null, lost: { colorIdx: 1, by: 3 } });
  // both
  assert.deepEqual(changes(at(4, 4, 4), at(5, 0, 13)), { gained: { colorIdx: 4, by: 9 }, lost: { colorIdx: 1, by: 4 } });
  // neither
  assert.deepEqual(changes(at(4, 4, 4), at(4, 4, 4)), { gained: null, lost: null });
  // ties go to the lower colour
  assert.deepEqual(changes(at(4, 4, 4), at(7, 7, 1)), { gained: { colorIdx: 0, by: 3 }, lost: { colorIdx: 4, by: 3 } });
  assert.deepEqual(changes(at(4, 4, 4), at(1, 1, 4)), { gained: null, lost: { colorIdx: 0, by: 3 } });
  // non-representatives are not compared, whatever they hold
  assert.deepEqual(changes(at(4, 4, 4, 0), at(4, 4, 4, 50)), { gained: null, lost: null });
});
