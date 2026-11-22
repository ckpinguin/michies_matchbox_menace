// Performance budgets (plan.md Performance Goals; constitution Technical Constraints).

import { rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadEngine } from "../../helpers/load-engine.mjs";
import { mulberry32 } from "../../helpers/rng.mjs";

const NOW = "2026-11-22T12:00:00.000Z";

// A valid save holding every one of the 304 boxes: the drawer's worst case.
function fullDrawerSave() {
  const E = loadEngine();
  const menace = E.createMenace({ beadRule: "perSquare" });
  let index = 0;
  for (const key of E.reachablePositions()) {
    const board = E.keyToBoard(key);
    const moveNumber = board.filter(Boolean).length + 1;
    menace.boxes.set(key, {
      positionKey: key,
      canonicalBoard: board,
      moveNumber,
      groups: E.moveGroups(board, "perSquare"),
      beads: E.startingBeads(key, moveNumber, "perSquare"),
      discoveryIndex: ++index,
    });
  }
  menace.discoveryCount = index;
  return E.serialize(menace, { now: NOW });
}

async function tenThousandGameSave() {
  const E = loadEngine();
  const rng = mulberry32(10000);
  const menace = E.createMenace();
  const opponent = (board) => Promise.resolve(rng() < 0.5 ? E.randomMove(board, rng) : E.perfectMove(board, rng));
  for (let i = 0; i < 10000; i++) await E.playGame({ menace, opponent, rng });
  return E.serialize(menace, { now: NOW });
}

// A MENACE with a long record: the table then has thousands of rows.
async function longRecordSave(games) {
  const E = loadEngine();
  const rng = mulberry32(games);
  const menace = E.createMenace();
  const opponent = (board) => Promise.resolve(rng() < 0.5 ? E.randomMove(board, rng) : E.perfectMove(board, rng));
  for (let i = 0; i < games; i++) await E.playGame({ menace, opponent, rng });
  return E.serialize(menace, { now: NOW });
}

export default [
  {
    name: "perf-training",
    spec: "plan: 500 games < 3 s, no task > 50 ms",
    timeout: 60000,
    async run(ctx) {
      await ctx.selectOpponent("perfect");
      const result = await ctx.eval(async () => {
        const long = [];
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) long.push(Math.round(entry.duration));
        });
        observer.observe({ type: "longtask" });
        const t0 = performance.now();
        document.querySelector('[data-train="500"]').click();
        while (document.querySelector("#controls").dataset.training !== "idle") {
          await new Promise((r) => setTimeout(r, 5));
        }
        const ms = performance.now() - t0;
        await new Promise((r) => setTimeout(r, 100)); // let the observer deliver
        observer.disconnect();
        return { ms: Math.round(ms), long, status: document.querySelector("#status-line").textContent };
      });
      ctx.assert(/Training finished: 500 games/.test(result.status), `Status: ${result.status}`);
      ctx.assert(result.ms < 3000, `500 games against the perfect player took ${result.ms} ms (budget 3000 ms)`);
      ctx.assert(result.long.length === 0, `Long tasks during training: ${result.long.join(", ")} ms (budget: none over 50 ms)`);
      console.log(`     500 games vs perfect player: ${result.ms} ms; long tasks: none`);
    },
  },
  {
    name: "perf-drawer",
    spec: "plan: drawer render < 16 ms",
    timeout: 60000,
    async run(ctx) {
      const file = path.join(await ctx.tmpDir("menace-perf-"), "full-drawer.json");
      try {
        await writeFile(file, fullDrawerSave());
        await ctx.page.setFileInput("#load-input", file);
        await ctx.waitFor(() => /Loaded MENACE/.test(document.querySelector("#status-line").textContent));
        const result = await ctx.eval(() => {
          const toggle = document.querySelector("#drawer-toggle");
          const timings = [];
          for (let run = 0; run < 5; run++) {
            const t0 = performance.now();
            toggle.click(); // open: render every card
            void document.body.offsetHeight; // include style and layout
            timings.push(performance.now() - t0);
            toggle.click(); // close again
          }
          toggle.click();
          return { cards: document.querySelectorAll("#drawer-list > li").length, timings: timings.map((t) => +t.toFixed(1)) };
        });
        ctx.assert(result.cards === 304, `Expected 304 cards, rendered ${result.cards}`);
        const median = [...result.timings].sort((a, b) => a - b)[2];
        ctx.assert(median < 16, `Opening the full drawer took ${median} ms (median of ${result.timings.join(", ")}); budget 16 ms`);
        console.log(`     full drawer (304 boxes): median ${median} ms of ${result.timings.join(", ")}`);
      } finally {
        await rm(path.dirname(file), { recursive: true, force: true });
      }
    },
  },
  {
    name: "perf-long-session",
    spec: "constitution: no task > 50 ms; edge case: long sessions",
    timeout: 180000,
    async run(ctx) {
      const file = path.join(await ctx.tmpDir("menace-perf-"), "long-record.json");
      try {
        await writeFile(file, await longRecordSave(50000));
        await ctx.page.setFileInput("#load-input", file);
        await ctx.waitFor(() => /Loaded MENACE: 50000 games/.test(document.querySelector("#status-line").textContent), {
          timeout: 20000,
        });
        await ctx.selectOpponent("random");
        await ctx.eval(() => {
          document.querySelector("#table-toggle-btn").click();
          document.querySelector("#drawer-toggle").click();
        });
        await ctx.sleep(300);
        const result = await ctx.eval(async () => {
          const long = [];
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) long.push(Math.round(entry.duration));
          });
          observer.observe({ type: "longtask" });
          document.querySelector('[data-train="500"]').click();
          while (document.querySelector("#controls").dataset.training !== "idle") {
            await new Promise((r) => setTimeout(r, 5));
          }
          await new Promise((r) => setTimeout(r, 150));
          observer.disconnect();
          const rows = [...document.querySelectorAll("#chart-table-wrap tbody tr")].map((tr) => tr.textContent);
          return { long, rows, status: document.querySelector("#status-line").textContent };
        });
        ctx.assert(/Training finished: 500 games/.test(result.status), `Status: ${result.status}`);
        ctx.assert(result.long.length === 0, `Long tasks during training with a 50,000-game record: ${result.long.join(", ")} ms`);
        // The table kept up with training, and matches a table rebuilt from scratch.
        ctx.assert(result.rows.length === 5050, `The table has ${result.rows.length} rows, expected 5050`);
        ctx.assert(result.rows.at(-1).startsWith("50491–50500"), `Last row: ${result.rows.at(-1)}`);
        const rebuilt = await ctx.eval(() => {
          const toggle = document.querySelector("#table-toggle-btn");
          toggle.click();
          toggle.click();
          return [...document.querySelectorAll("#chart-table-wrap tbody tr")].map((tr) => tr.textContent);
        });
        ctx.assert(JSON.stringify(rebuilt) === JSON.stringify(result.rows), "The incrementally updated table differs from a rebuilt one");
      } finally {
        await rm(path.dirname(file), { recursive: true, force: true });
      }
    },
  },
  {
    name: "perf-save-load",
    spec: "plan: 10,000-game save/load < 200 ms",
    timeout: 120000,
    async run(ctx) {
      const text = await tenThousandGameSave();
      const result = await ctx.eval((saveText, now) => {
        const E = window.MenaceEngine;
        const t0 = performance.now();
        const parsed = E.parseSave(saveText);
        const t1 = performance.now();
        const again = E.serialize(parsed.menace, { now });
        const t2 = performance.now();
        return { ok: parsed.ok, same: again === saveText, load: +(t1 - t0).toFixed(1), save: +(t2 - t1).toFixed(1), games: parsed.menace.record.gamesPlayed };
      }, text, NOW);
      ctx.assert(result.ok && result.games === 10000, "The 10,000-game save did not load");
      ctx.assert(result.same, "Saving the loaded MENACE did not reproduce the file");
      ctx.assert(result.load < 200, `Loading took ${result.load} ms (budget 200 ms)`);
      ctx.assert(result.save < 200, `Saving took ${result.save} ms (budget 200 ms)`);
      console.log(`     10,000 games: load ${result.load} ms, save ${result.save} ms`);
    },
  },
];
