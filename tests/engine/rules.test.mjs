// MENACE's verified rules (constitution Principle III, FR-040, SC-008) and the board helpers
// (contracts/engine-api.md §Constants, §Board helpers, §Menace).

import { test } from "node:test";
import assert from "node:assert/strict";
import { loadEngine, plain } from "../helpers/load-engine.mjs";
import { mulberry32 } from "../helpers/rng.mjs";

const E = loadEngine();
const toBoard = (key) => [...key].map((c) => (c === "." ? null : c));
const marks = (key) => [...key].filter((c) => c !== ".").length;
const freeSquares = (key) => [...key].flatMap((c, i) => (c === "." ? [i] : []));

test("constants match the contract", () => {
  assert.equal(E.TOTAL_BOXES, 304);
  assert.deepEqual(plain(E.BEAD_RULES), ["michie1963", "perSquare"]);
  assert.equal(E.DEFAULT_BEAD_RULE, "michie1963");
  assert.deepEqual(plain(E.START_BEADS), { 1: 4, 3: 3, 5: 2, 7: 1 });
  assert.deepEqual(plain(E.REINFORCE), { win: 3, draw: 1, loss: -1 });
  assert.equal(E.TRANSFORMS.length, 8);
  assert.deepEqual(plain(E.TRANSFORMS[0]), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(E.TRANSFORM_NAMES.length, 8);
  assert.equal(E.SAVE_FORMAT, "menace-drawer");
  assert.equal(E.SAVE_VERSION, 1);
});

test("reachablePositions: 304 canonical boxes, split 1/12/108/183 by move", () => {
  const positions = E.reachablePositions();
  assert.equal(positions.size, 304);
  const byMove = { 1: 0, 3: 0, 5: 0, 7: 0 };
  for (const key of positions) {
    byMove[marks(key) + 1]++;
    assert.equal(E.canonicalize(toBoard(key)).key, key, `${key} is not canonical`);
    assert.ok(freeSquares(key).length >= 2, `${key} has a forced move and needs no box`);
  }
  assert.deepEqual(byMove, { 1: 1, 3: 12, 5: 108, 7: 183 });
  assert.equal(E.reachablePositions(), positions, "the set is computed once and cached");
});

test("canonicalize: smallest key, ties broken by the lowest transform index", () => {
  const empty = E.canonicalize(Array(9).fill(null));
  assert.equal(empty.key, ".........");
  assert.equal(empty.transformIndex, 0);

  // MENACE in the top-left corner: transforms 2 (rotate 180°) and 7 (↙ diagonal) both give
  // "........X"; the lower index wins.
  const corner = E.canonicalize(toBoard("X........"));
  assert.equal(corner.key, "........X");
  assert.equal(corner.transformIndex, 2);
  assert.deepEqual(plain(corner.T), plain(E.TRANSFORMS[2]));
  assert.deepEqual(plain(corner.board), toBoard("........X"));

  const rng = mulberry32(7);
  for (let n = 0; n < 500; n++) {
    const board = Array.from({ length: 9 }, () => [null, "X", "O"][Math.floor(rng() * 3)]);
    const keys = E.TRANSFORMS.map((T) => T.map((i) => board[i] ?? ".").join(""));
    const min = [...keys].sort()[0];
    const result = E.canonicalize(board);
    assert.equal(result.key, min);
    assert.equal(result.transformIndex, keys.indexOf(min));
    // board[T[i]] is shown at canonical square i.
    for (let i = 0; i < 9; i++) assert.equal(result.board[i], board[result.T[i]]);
  }
});

test("checkWinner returns { winner, line }", () => {
  assert.deepEqual(plain(E.checkWinner(toBoard("XXXOO...."))), { winner: "X", line: [0, 1, 2] });
  assert.deepEqual(plain(E.checkWinner(toBoard("XXO.O.OX."))), { winner: "O", line: [2, 4, 6] });
  assert.deepEqual(plain(E.checkWinner(toBoard("XOXXOOOXX"))), { winner: "draw", line: null });
  assert.deepEqual(plain(E.checkWinner(Array(9).fill(null))), { winner: null, line: null });
});

test("moveGroups under perSquare: every free square is its own group", () => {
  for (const key of E.reachablePositions()) {
    const groups = plain(E.moveGroups(toBoard(key), "perSquare"));
    assert.deepEqual(groups, freeSquares(key).map((i) => [i]));
  }
});

test("moveGroups under michie1963: 56 boxes merge moves; groups are stabiliser orbits", () => {
  let merged = 0;
  for (const key of E.reachablePositions()) {
    const board = toBoard(key);
    const groups = plain(E.moveGroups(board, "michie1963"));
    if (groups.some((g) => g.length > 1)) merged++;

    // The groups partition the free squares, representative first and lowest, sorted by it.
    assert.deepEqual(groups.flat().sort((a, b) => a - b), freeSquares(key));
    for (const g of groups) assert.equal(g[0], Math.min(...g));
    assert.deepEqual(groups.map((g) => g[0]), [...groups.map((g) => g[0])].sort((a, b) => a - b));

    // Two squares share a group exactly when a symmetry of the position maps one onto the other.
    const stabiliser = E.TRANSFORMS.filter((T) => T.every((src, i) => board[src] === board[i]));
    for (const g of groups) {
      const orbit = new Set(stabiliser.map((T) => T[g[0]]));
      assert.deepEqual([...orbit].sort((a, b) => a - b), [...g].sort((a, b) => a - b), `orbit of ${g[0]} in ${key}`);
    }
  }
  assert.equal(merged, 56);
  assert.deepEqual(plain(E.moveGroups(toBoard("........."), "michie1963")), [[0, 2, 6, 8], [1, 3, 5, 7], [4]]);
  assert.deepEqual(plain(E.moveGroups(toBoard("....O...X"), "michie1963")), [[0], [1, 3], [2, 6], [5, 7]]);
});

test("startingBeads: 4/3/2/1 on representatives (michie1963) or every free square (perSquare)", () => {
  for (const key of E.reachablePositions()) {
    const moveNumber = marks(key) + 1;
    const start = { 1: 4, 3: 3, 5: 2, 7: 1 }[moveNumber];
    const per = plain(E.startingBeads(key, moveNumber, "perSquare"));
    const michie = plain(E.startingBeads(key, moveNumber, "michie1963"));
    const reps = new Set(plain(E.moveGroups(toBoard(key), "michie1963")).map((g) => g[0]));
    for (let i = 0; i < 9; i++) {
      if (key[i] !== ".") {
        assert.equal(per[i], 0);
        assert.equal(michie[i], 0);
      } else {
        assert.equal(per[i], start);
        assert.equal(michie[i], reps.has(i) ? start : 0);
      }
    }
  }
  // The opening box holds 3 colours × 4 beads under Michie's rule and 9 × 4 one per square.
  assert.deepEqual(plain(E.startingBeads(".........", 1, "michie1963")), [4, 4, 0, 0, 4, 0, 0, 0, 0]);
  assert.deepEqual(plain(E.startingBeads(".........", 1, "perSquare")), Array(9).fill(4));
});

test("createMenace: Michie 1963 by default, empty drawer, zero record", () => {
  const m = E.createMenace();
  assert.equal(m.beadRule, "michie1963");
  assert.equal(m.boxes.size, 0);
  assert.equal(m.discoveryCount, 0);
  assert.deepEqual(plain(m.record), { gamesPlayed: 0, win: 0, draw: 0, loss: 0, outcomes: "" });
  assert.equal(E.createMenace({ beadRule: "perSquare" }).beadRule, "perSquare");
  assert.throws(() => E.createMenace({ beadRule: "bogus" }));
});

// ---------- Orientation (US2; FR-008; research R4) ----------

// Real boards whose canonical form uses each transform, built by undoing the transform.
function realBoardsByTransform() {
  const byTransform = new Map();
  for (const key of E.reachablePositions()) {
    const canonical = toBoard(key);
    for (const T of E.TRANSFORMS) {
      const real = new Array(9);
      for (let i = 0; i < 9; i++) real[T[i]] = canonical[i];
      const t = E.canonicalize(real).transformIndex;
      if (!byTransform.has(t)) byTransform.set(t, []);
      byTransform.get(t).push(real);
    }
  }
  return byTransform;
}

test("chooseMove plays T[colorIdx] on the real board, for every transform", () => {
  const byTransform = realBoardsByTransform();
  assert.deepEqual([...byTransform.keys()].sort(), [0, 1, 2, 3, 4, 5, 6, 7]);
  const rng = mulberry32(31);
  for (const beadRule of ["perSquare", "michie1963"]) {
    for (const [t, boards] of byTransform) {
      for (const real of boards.slice(0, 40)) {
        const menace = E.createMenace({ beadRule });
        const game = E.newGame({ opponent: "random" });
        real.forEach((mark, i) => (game.board[i] = mark));
        const choice = E.chooseMove(menace, game, rng);
        assert.equal(choice.kind, "bead");
        assert.equal(choice.transformIndex, t);
        assert.equal(choice.realIdx, E.TRANSFORMS[t][choice.colorIdx]);
        assert.equal(real[choice.realIdx], null, "the played square must be empty on the real board");
        const step = game.steps.at(-1);
        assert.deepEqual(
          plain({ t: step.transformIndex, c: step.colorIdx, r: step.realIdx }),
          { t, c: choice.colorIdx, r: choice.realIdx },
        );
      }
    }
  }
});

test("each TRANSFORM_NAMES entry describes how the box picture shows the real board", () => {
  // Box square (r, c) shows the real square returned by each function.
  const geometry = {
    "in the same orientation": (r, c) => [r, c],
    "rotated 90° clockwise": (r, c) => [2 - c, r],
    "rotated 180°": (r, c) => [2 - r, 2 - c],
    "rotated 90° anticlockwise": (r, c) => [c, 2 - r],
    "mirrored left–right": (r, c) => [r, 2 - c],
    "mirrored top–bottom": (r, c) => [2 - r, c],
    "mirrored along the ↘ diagonal": (r, c) => [c, r],
    "mirrored along the ↙ diagonal": (r, c) => [2 - c, 2 - r],
  };
  E.TRANSFORM_NAMES.forEach((name, t) => {
    const fn = geometry[name];
    assert.ok(fn, `unexpected transform name: ${name}`);
    for (let box = 0; box < 9; box++) {
      const [rr, rc] = fn(Math.floor(box / 3), box % 3);
      assert.equal(E.TRANSFORMS[t][box], rr * 3 + rc, `${name}: box square ${box + 1}`);
    }
  });
  // The example from tasks.md: under transform 1 the real bottom-left square is box square 1.
  assert.equal(E.TRANSFORMS[1][0], 6);
  assert.equal(E.TRANSFORM_NAMES[1], "rotated 90° clockwise");
});
