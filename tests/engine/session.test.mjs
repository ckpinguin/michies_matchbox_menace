// Game sessions: abandonment, the single commit, training counts and the empty opening box
// (contracts/engine-api.md §Playing a game, guarantees 1–3; FR-001–FR-006; SC-001).

import { test } from "node:test";
import assert from "node:assert/strict";
import { loadEngine, plain } from "../helpers/load-engine.mjs";
import { mulberry32 } from "../helpers/rng.mjs";

const E = loadEngine();
const noPause = () => Promise.resolve();
const randomOpponent = (rng) => (board) => Promise.resolve(E.randomMove(board, rng));

async function trained(games, { beadRule = "perSquare", seed = 1 } = {}) {
  const rng = mulberry32(seed);
  const menace = E.createMenace({ beadRule });
  for (let i = 0; i < games; i++) {
    await E.playGame({ menace, opponent: randomOpponent(rng), rng, pause: noPause });
  }
  return { menace, rng };
}

for (const beadRule of ["perSquare", "michie1963"]) {
  test(`${beadRule}: 25 finished games add exactly 25 to the record`, async () => {
    const { menace } = await trained(25, { beadRule, seed: 11 });
    const r = menace.record;
    assert.equal(r.gamesPlayed, 25);
    assert.equal(r.win + r.draw + r.loss, 25);
    assert.equal(r.outcomes.length, 25);
    assert.equal(menace.discoveryCount, menace.boxes.size);
  });
}

test("aborting during any pause leaves the Menace exactly as it was", async () => {
  for (let k = 1; k <= 7; k++) {
    const { menace, rng } = await trained(15, { seed: 20 + k });
    const before = plain(menace);
    const controller = new AbortController();
    let pauses = 0;
    const pause = () => {
      pauses++;
      if (pauses === k) controller.abort();
      return Promise.resolve();
    };
    const result = await E.playGame({
      menace,
      opponent: randomOpponent(rng),
      rng,
      signal: controller.signal,
      pause,
    });
    if (pauses < k) {
      // The game ended before the k-th pause: it must have been committed normally.
      assert.equal(result.status, "finished");
      continue;
    }
    assert.equal(result.status, "abandoned");
    assert.equal(result.game.status, "abandoned");
    assert.deepEqual(plain(menace), before);
  }
});

test("aborting during a pending human move resolves it and leaves the Menace unchanged", async () => {
  const { menace, rng } = await trained(10, { seed: 3 });
  const before = plain(menace);
  const controller = new AbortController();
  const human = (board, signal) =>
    new Promise((resolve) => {
      signal.addEventListener("abort", () => resolve(null), { once: true });
      setTimeout(() => controller.abort(), 5);
    });
  const result = await E.playGame({ menace, opponent: human, rng, signal: controller.signal, pause: noPause });
  assert.equal(result.status, "abandoned");
  assert.deepEqual(plain(menace), before);
});

test("aborting before the opponent's reply is applied abandons the game", async () => {
  const { menace, rng } = await trained(10, { seed: 4 });
  const before = plain(menace);
  const controller = new AbortController();
  const opponent = (board) => {
    controller.abort();
    return Promise.resolve(E.randomMove(board, rng));
  };
  const result = await E.playGame({ menace, opponent, rng, signal: controller.signal, pause: noPause });
  assert.equal(result.status, "abandoned");
  assert.ok(!result.game.board.includes("O"), "the opponent's move must not be applied");
  assert.deepEqual(plain(menace), before);
});

test("an abandoned game settles as soon as the pending promise resolves (guarantee 3)", async () => {
  const menace = E.createMenace();
  const controller = new AbortController();
  let release;
  const pause = () => new Promise((resolve) => (release = resolve));
  const pending = E.playGame({
    menace,
    opponent: randomOpponent(mulberry32(5)),
    rng: mulberry32(5),
    signal: controller.signal,
    pause,
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  controller.abort();
  release();
  const timeout = new Promise((resolve) => setTimeout(() => resolve("timed out"), 0));
  const winner = await Promise.race([pending, timeout]);
  assert.notEqual(winner, "timed out");
  assert.equal(winner.status, "abandoned");
});

test("provisional boxes join the drawer only at commit, numbered in discovery order", async () => {
  const menace = E.createMenace({ beadRule: "perSquare" });
  const rng = mulberry32(9);
  const seen = [];
  const result = await E.playGame({
    menace,
    opponent: randomOpponent(rng),
    rng,
    pause: noPause,
    onEvent(event) {
      if (event.type === "menace" && event.choice.kind === "bead") {
        assert.equal(menace.boxes.size, 0, "no box joins the drawer before commit");
        assert.equal(event.choice.provisional, true);
        seen.push({ key: event.choice.positionKey, tentative: event.choice.box.discoveryIndex });
      }
    },
  });
  assert.equal(result.status, "finished");
  assert.equal(menace.boxes.size, seen.length);
  seen.forEach((s, k) => {
    assert.equal(s.tentative, k + 1);
    assert.equal(menace.boxes.get(s.key).discoveryIndex, k + 1);
  });
  assert.equal(menace.discoveryCount, seen.length);
});

test("chooseMove never mutates the Menace", async () => {
  const { menace, rng } = await trained(30, { seed: 6 });
  const before = plain(menace);
  const game = E.newGame({ opponent: "random" });
  const choice = E.chooseMove(menace, game, rng);
  assert.equal(choice.kind, "bead");
  assert.equal(game.steps.length, 1);
  assert.deepEqual(plain(menace), before);
});

test("bead changes are +3 / +1 / −1 per box used, with a floor at 0", async () => {
  const rng = mulberry32(12);
  const menace = E.createMenace({ beadRule: "perSquare" });
  const delta = { win: 3, draw: 1, loss: -1 };
  const outcomes = new Set();
  for (let i = 0; i < 200; i++) {
    const result = await E.playGame({ menace, opponent: randomOpponent(rng), rng, pause: noPause });
    const { outcome, steps } = result.game;
    outcomes.add(outcome);
    assert.equal(result.deltas.length, steps.length);
    for (const d of result.deltas) {
      assert.equal(d.after, Math.max(0, d.before + delta[outcome]));
      assert.equal(menace.boxes.get(d.positionKey).beads[d.colorIdx], d.after);
    }
  }
  assert.deepEqual([...outcomes].sort(), ["draw", "loss", "win"]);

  // Floor: a loss never takes a count below 0.
  const game = E.newGame({ opponent: "random" });
  const choice = E.chooseMove(menace, game, rng);
  const box = menace.boxes.get(choice.positionKey) || game.provisional.get(choice.positionKey);
  box.beads[choice.colorIdx] = 0;
  game.status = "finished";
  game.outcome = "loss";
  const [change] = E.commit(menace, game);
  assert.equal(change.before, 0);
  assert.equal(change.after, 0);
});

test("an empty opening box makes MENACE resign at move 1, recorded as a loss", async () => {
  const { menace, rng } = await trained(5, { seed: 8 });
  menace.boxes.get(".........").beads.fill(0);
  const losses = menace.record.loss;
  const result = await E.playGame({ menace, opponent: randomOpponent(rng), rng, pause: noPause });
  assert.equal(result.status, "finished");
  assert.equal(result.game.outcome, "loss");
  assert.deepEqual(plain(result.game.resignedAt), { positionKey: ".........", moveNumber: 1 });
  assert.equal(result.game.steps.length, 0);
  assert.equal(menace.record.loss, losses + 1);
  assert.ok(menace.record.outcomes.endsWith("L"));
});

test("commit throws unless the game has finished, and commits only once", async () => {
  const menace = E.createMenace();
  const game = E.newGame({ opponent: "random" });
  assert.throws(() => E.commit(menace, game), /finished/);
  const rng = mulberry32(2);
  const result = await E.playGame({ menace, opponent: randomOpponent(rng), rng, pause: noPause });
  assert.throws(() => E.commit(menace, result.game));
  assert.equal(menace.record.gamesPlayed, 1);
});

// ---------- Michie's 1963 rule (US6; FR-023; SC-008) ----------

test("michie1963: beads are drawn only from representatives and the representative is played", async () => {
  const rng = mulberry32(63);
  const menace = E.createMenace({ beadRule: "michie1963" });
  let merged = 0;
  for (let g = 0; g < 300; g++) {
    const result = await E.playGame({ menace, opponent: randomOpponent(rng), rng, pause: noPause });
    for (const step of result.game.steps) {
      const box = menace.boxes.get(step.positionKey);
      const group = box.groups.find((gr) => gr.includes(step.colorIdx));
      assert.equal(group[0], step.colorIdx, "only a representative's bead can be drawn");
      assert.deepEqual(plain(step.groupSquares), plain(group));
      assert.equal(step.realIdx, E.TRANSFORMS[step.transformIndex][step.colorIdx]);
      if (group.length > 1) merged++;
    }
  }
  assert.ok(merged > 0, "no shared-colour bead was ever drawn");
  // Reinforcement only ever touches representatives: every other square stays at 0.
  for (const box of menace.boxes.values()) {
    const reps = new Set(box.groups.map((gr) => gr[0]));
    box.beads.forEach((n, i) => {
      if (!reps.has(i)) assert.equal(n, 0, `${box.positionKey}: beads on non-representative ${i}`);
    });
  }
  const opening = menace.boxes.get(".........");
  assert.equal(opening.groups.length, 3);
});

test("perSquare: each step's group is just the square drawn", async () => {
  const rng = mulberry32(64);
  const menace = E.createMenace({ beadRule: "perSquare" });
  for (let g = 0; g < 100; g++) {
    const result = await E.playGame({ menace, opponent: randomOpponent(rng), rng, pause: noPause });
    for (const step of result.game.steps) assert.deepEqual(plain(step.groupSquares), [step.colorIdx]);
  }
  assert.equal(menace.boxes.get(".........").groups.length, 9);
});
