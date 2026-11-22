// Game-record integrity (US1; SC-001, FR-001–FR-005; quickstart §3).
//
// Each interrupt check runs 25 trials against the Random mover: wait a random 100–700 ms
// into an animated game, then interrupt it. In the same page turn it notes whether the game
// had already finished, so it knows exactly how many games should have been recorded. An
// abandoned game that later counts itself (the old race) makes the totals disagree.

const TRIALS = 25;

function randomWait(ctx) {
  return 100 + Math.floor(ctx.rng() * 600);
}

// Runs in the page: note whether the shown game had finished, interrupt it, read the record.
function interruptInPage(kind, option) {
  const finished = document.querySelector("#board").dataset.state === "over";
  const click = (selector) => document.querySelector(selector).click();
  if (kind === "new-game") {
    for (let i = 0; i < option; i++) click("#new-game-btn"); // rapid repeated clicks
  } else if (kind === "opponent") {
    click(`[data-opponent="${option}"]`);
  } else if (kind === "reset") {
    click("#reset-btn");
    click("#reset-btn"); // the "click again" confirmation
  } else if (kind === "train") {
    click('[data-train="20"]');
  }
  const value = document.querySelector('[data-stat="games"] .value').textContent;
  return { finished, games: Number(value.replace(/[^0-9]/g, "")) };
}

function waitTrainingIdle(ctx, timeout = 30000) {
  return ctx.waitFor(() => document.querySelector("#controls")?.dataset.training === "idle", {
    timeout,
    message: "The training run did not finish",
  });
}

function interruptCheck(name, kind) {
  return {
    name,
    spec: "SC-001",
    timeout: 180000,
    async run(ctx) {
      await ctx.selectOpponent("random");
      let expected = await ctx.gamesPlayed();
      ctx.assert(expected === 0, `Expected a fresh MENACE, found ${expected} games`);
      let nextOpponent = "perfect";

      for (let trial = 1; trial <= TRIALS; trial++) {
        if (kind === "train") await ctx.click("#new-game-btn");
        await ctx.sleep(randomWait(ctx));

        const option = kind === "opponent" ? nextOpponent : kind === "new-game" ? 1 + (trial % 3) : null;
        const r = await ctx.eval(interruptInPage, kind, option);
        if (kind === "opponent") nextOpponent = nextOpponent === "perfect" ? "random" : "perfect";

        if (r.finished) expected += 1; // committed before the interrupt
        if (kind === "reset") expected = 0;

        if (kind === "train") {
          await waitTrainingIdle(ctx);
          const status = await ctx.status();
          const m = /Training finished: (\d+) games/.exec(status);
          ctx.assert(m, `Trial ${trial}: unexpected status after training: ${status}`);
          expected += Number(m[1]);
          const games = await ctx.gamesPlayed();
          ctx.assert(games === expected, `Trial ${trial}: ${games} games recorded after training, expected ${expected}`);
        } else {
          ctx.assert(
            r.games === expected,
            `Trial ${trial}: ${r.games} games recorded right after the interrupt, expected ${expected}`,
          );
        }
      }

      if (kind !== "train") {
        await ctx.waitGameOver({ timeout: 30000 });
        expected += 1; // the last game was left to finish
      }
      await ctx.sleep(kind === "train" ? 4500 : 1500); // a stray abandoned game would have counted by now
      const games = await ctx.gamesPlayed();
      ctx.assert(games === expected, `${games} games recorded at the end, but ${expected} games finished`);
    },
  };
}

export default [
  interruptCheck("interrupt-new-game", "new-game"),
  interruptCheck("interrupt-opponent", "opponent"),
  interruptCheck("interrupt-reset", "reset"),
  interruptCheck("interrupt-train", "train"),
  {
    name: "training-stop",
    spec: "FR-004, FR-005",
    async run(ctx) {
      await ctx.selectOpponent("random");
      const before = await ctx.gamesPlayed();
      // 500 games against the Random mover can finish within one 12 ms slice, so Stop is
      // clicked in the same page turn as Run: "stop at once".
      await ctx.eval(() => {
        document.querySelector('[data-train="500"]').click();
        document.querySelector("#train-cancel").click();
      });
      await waitTrainingIdle(ctx);
      const status = await ctx.status();
      const m = /Training stopped after (\d+) of 500 games/.exec(status);
      ctx.assert(m, `Expected "Training stopped after k of 500 games", got: ${status}`);
      const k = Number(m[1]);
      ctx.assert(k < 500, `Stop was ignored: ${k} of 500 games ran`);
      const after = await ctx.gamesPlayed();
      ctx.assert(after - before === k, `The record rose by ${after - before}, but the status says ${k} games ran`);
    },
  },
];
