// The perfect player (FR-017, FR-018, SC-005; research R5) and the learning-curve table (FR-020).

import { test } from "node:test";
import assert from "node:assert/strict";
import { loadEngine, plain } from "../helpers/load-engine.mjs";
import { mulberry32 } from "../helpers/rng.mjs";

const E = loadEngine();
const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
const winner = (b) => {
  for (const [a, c, d] of LINES) if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a];
  return b.every(Boolean) ? "draw" : null;
};

// Independent reference: the game value with depth. A win counts for more the sooner it comes.
const memo = new Map();
function value(board, toMove) {
  const key = board.map((c) => c || ".").join("") + toMove;
  if (memo.has(key)) return memo.get(key);
  const w = winner(board);
  const marks = board.filter(Boolean).length;
  let v;
  if (w === "X") v = 10 - marks;
  else if (w === "O") v = -(10 - marks);
  else if (w === "draw") v = 0;
  else {
    v = toMove === "X" ? -Infinity : Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i]) continue;
      board[i] = toMove;
      const child = value(board, toMove === "X" ? "O" : "X");
      board[i] = null;
      v = toMove === "X" ? Math.max(v, child) : Math.min(v, child);
    }
  }
  memo.set(key, v);
  return v;
}

function bestReplies(board) {
  let best = Infinity;
  const moves = [];
  for (let i = 0; i < 9; i++) {
    if (board[i]) continue;
    board[i] = "O";
    const v = value(board, "X");
    board[i] = null;
    if (v < best) {
      best = v;
      moves.length = 0;
    }
    if (v === best) moves.push(i);
  }
  return moves;
}

// Every non-terminal position where the opponent (O) is to move.
function opponentPositions() {
  const found = new Map();
  const board = Array(9).fill(null);
  (function walk(player) {
    if (winner(board)) return;
    if (player === "O") {
      const key = board.map((c) => c || ".").join("");
      if (found.has(key)) return;
      found.set(key, board.slice());
    }
    for (let i = 0; i < 9; i++) {
      if (board[i]) continue;
      board[i] = player;
      walk(player === "X" ? "O" : "X");
      board[i] = null;
    }
  })("X");
  return [...found.values()];
}

const immediateWins = (board) =>
  [...Array(9).keys()].filter((i) => {
    if (board[i]) return false;
    const next = board.slice();
    next[i] = "O";
    return winner(next) === "O";
  });

test("the perfect player always picks an optimal reply, preferring the quickest win", () => {
  const rng = mulberry32(42);
  for (const board of opponentPositions()) {
    const choice = E.perfectMove(board.slice(), rng);
    const best = bestReplies(board.slice());
    assert.ok(best.includes(choice), `${board.map((c) => c || ".").join("")}: played ${choice}, optimal ${best}`);
    const wins = immediateWins(board);
    if (wins.length) assert.ok(wins.includes(choice), "an immediate win was available");
  }
});

test("over 500 seeded games the perfect player never misses an immediate win", async () => {
  const rng = mulberry32(500);
  let menace = E.createMenace();
  let chances = 0;
  for (let g = 0; g < 500; g++) {
    if (g % 50 === 0) menace = E.createMenace(); // a fresh, careless MENACE leaves more openings
    const opponent = (board) => {
      const wins = immediateWins(board);
      const square = E.perfectMove(board, rng);
      if (wins.length) {
        chances++;
        assert.ok(wins.includes(square), `missed an immediate win in game ${g + 1}`);
      }
      return Promise.resolve(square);
    };
    await E.playGame({ menace, opponent, rng, pause: () => Promise.resolve() });
  }
  assert.ok(chances > 20, `only ${chances} immediate wins came up`);
});

test("where several replies are equally good, the choice varies (≥ 2 different in 50 encounters)", () => {
  const rng = mulberry32(7);
  let tiedPositions = 0;
  for (const board of opponentPositions()) {
    const best = bestReplies(board.slice());
    if (best.length < 2) continue;
    tiedPositions++;
    const seen = new Set();
    for (let k = 0; k < 50; k++) seen.add(E.perfectMove(board.slice(), rng));
    assert.ok(seen.size >= 2, `${board.map((c) => c || ".").join("")}: always plays ${[...seen]}`);
  }
  assert.ok(tiedPositions > 100, `only ${tiedPositions} positions with ties`);
});

test("tableRows reports each range of 10 games as at its last game", () => {
  const outcomes = "WWDLWLLDDWWWWDLLWWWWDDL"; // 23 games
  const series = E.rollingSeries(outcomes, 20);
  const rows = plain(E.tableRows(series, 10));
  assert.deepEqual(
    rows.map((r) => [r.from, r.to]),
    [[1, 10], [11, 20], [21, 23]],
  );
  rows.forEach((row) => {
    const last = series[row.to - 1];
    assert.equal(row.win, last.win);
    assert.equal(row.draw, last.draw);
    assert.equal(row.loss, last.loss);
  });
  assert.deepEqual(plain(E.tableRows([], 10)), []);
});

// ---------- Incremental record helpers (long sessions; tasks T078) ----------

test("extendRollingSeries continues a series exactly as rollingSeries would compute it", () => {
  const rng = mulberry32(78);
  const outcomes = Array.from({ length: 2000 }, () => "WDL"[Math.floor(rng() * 3)]).join("");
  const full = plain(E.rollingSeries(outcomes, 20));
  for (const cut of [0, 1, 5, 19, 20, 21, 777, 1999, 2000]) {
    const series = E.rollingSeries(outcomes.slice(0, cut), 20);
    const extended = E.extendRollingSeries(series, outcomes, 20);
    assert.equal(extended, series, "extends in place");
    assert.deepStrictEqual(plain(extended), full, `cut at ${cut}`);
  }
});

test("tableRows can start at a later row, numbered as in the full table", () => {
  const series = E.rollingSeries("WDLWWDLLWDWWWDDLLLWWDWDLW", 20); // 25 games
  const all = plain(E.tableRows(series, 10));
  assert.deepStrictEqual(plain(E.tableRows(series, 10, 1)), all.slice(1));
  assert.deepStrictEqual(plain(E.tableRows(series, 10, 2)), all.slice(2));
  assert.deepStrictEqual(plain(E.tableRows(series, 10, 3)), []);
});
