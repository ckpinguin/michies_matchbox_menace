// Step-by-step help checks (feature 002: US2, US3; FR-006–FR-008, FR-011, FR-018).
//
//   steps-order, steps-auto, steps-interrupt, learning-beads, reduced-motion
//
// The checks read the shared DOM hooks listed in specs/002-kid-friendly-matchboxes/tasks.md.

const ORDER = ["find", "shake", "tilt", "lookup", "play"];

// Sentences in a caption, split at . ! and ? as the copy-deck rules do (FR-006: one per step).
const sentenceCount = (text) => text.split(/[.!?]+/).filter((s) => /[\p{L}\p{N}]/u.test(s)).length;

// In the page: what the step area shows now, or null when it is hidden.
function readStep() {
  const area = document.querySelector("#step-area");
  if (!area || area.hidden) return null;
  return {
    step: area.dataset.step,
    indicator: document.querySelector("#step-indicator").textContent.trim(),
    caption: document.querySelector("#step-caption").textContent.replace(/\s+/g, " ").trim(),
    menaceMarks: document.querySelectorAll('#board button[data-mark="X"]').length,
    markers: document.querySelectorAll("#board .bead-marker").length,
  };
}

// In the page: a visitor's square that never wins, blocks MENACE's immediate win if it can,
// and otherwise follows the perfect player. It keeps games going to MENACE's fifth move.
function visitorSquare() {
  const board = [...document.querySelectorAll("#board button[data-idx]")].map((b) => b.dataset.mark || null);
  const E = window.MenaceEngine;
  const free = board.flatMap((m, i) => (m ? [] : [i]));
  const completes = (i, mark) => E.LINES.some((line) =>
    line.includes(i) && line.every((j) => j === i || board[j] === mark));
  const safe = free.filter((i) => !completes(i, "O"));
  const pool = safe.length ? safe : free;
  const block = pool.find((i) => completes(i, "X"));
  if (block !== undefined) return block;
  const perfect = E.perfectMove(board, () => 0);
  return pool.includes(perfect) ? perfect : pool[0];
}

async function turnOnSteps(ctx, pacing) {
  await ctx.click("#help-steps");
  await ctx.click(`#help-pacing [data-pacing="${pacing}"]`);
  const state = await ctx.eval(() => ({
    pressed: document.querySelector("#help-steps").getAttribute("aria-pressed"),
    pacing: document.querySelector(`#help-pacing [aria-pressed="true"]`)?.dataset.pacing,
  }));
  ctx.assert(state.pressed === "true", "Step by step did not turn on");
  ctx.assert(state.pacing === pacing, `Pacing is ${state.pacing}, not ${pacing}`);
}

async function waitForStep(ctx, step, message) {
  return ctx.waitFor((s) => {
    const area = document.querySelector("#step-area");
    return area && !area.hidden && area.dataset.step === s;
  }, { timeout: 8000, message: message || `The step area never showed "${step}"` }, step);
}

// In the page: one learning frame against the box panel's ledger for the same box.
function readLearningFrame() {
  const area = document.querySelector("#step-area");
  if (area.hidden || area.dataset.step !== "learning") return null;
  const svg = area.querySelector("svg.matchbox");
  const key = svg ? svg.dataset.positionKey : null;
  const entrySvg = [...document.querySelectorAll("#box-panel svg.matchbox")].find((s) => s.dataset.positionKey === key);
  const entry = entrySvg ? entrySvg.closest(".box-entry") : null;
  const drawnRow = entry ? entry.querySelector(".bead-ledger li.drawn") : null;
  const status = document.querySelector("#status-line").textContent;
  const square = drawnRow ? Number(/box square ([1-9])/.exec(drawnRow.textContent)[1]) - 1 : null;
  const group = svg && square !== null ? svg.querySelector(`.tray-group[data-color="${square}"]`) : null;
  return {
    key,
    caption: document.querySelector("#step-caption").textContent.trim(),
    result: /MENACE wins/.test(status) ? "win" : /draw/i.test(status) ? "draw" : "loss",
    drops: svg ? svg.querySelectorAll(".bead-drop").length : -1,
    outs: svg ? svg.querySelectorAll(".bead-out").length : -1,
    trayCount: group ? Number(group.dataset.count) : 0,
    ledgerCount: drawnRow ? Number(/(\d+) bead/.exec(drawnRow.querySelector(".count").textContent)[1]) : null,
    delta: drawnRow && drawnRow.querySelector(".delta") ? drawnRow.querySelector(".delta").textContent.trim() : null,
  };
}

export default [
  {
    name: "reduced-motion",
    spec: "FR-018, SC-007",
    timeout: 180000,
    async before(ctx) {
      await ctx.page.emulate({ reducedMotion: "reduce" });
    },
    async run(ctx) {
      const reduced = await ctx.eval(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
      ctx.assert(reduced, "Reduced motion is not being emulated");
      await ctx.eval(() => {
        window.__maxAnimations = 0;
        window.__animated = [];
        const sample = () => {
          const list = document.getAnimations();
          if (list.length > window.__maxAnimations) window.__maxAnimations = list.length;
          for (const a of list) {
            const t = a.effect && a.effect.target;
            window.__animated.push(t ? t.tagName + "." + String(t.getAttribute("class") || "") : "?");
          }
        };
        setInterval(sample, 50);
      });
      await turnOnSteps(ctx, "manual");
      await ctx.selectOpponent("random");
      const captions = [];
      let turned = false;
      for (let game = 0; game < 4; game++) {
        if (game > 0) await ctx.click("#new-game-btn");
        for (let guard = 0; guard < 3000; guard++) {
          const s = await ctx.eval(readStep);
          if (s) {
            captions.push(s);
            if (await ctx.eval(() => Boolean(document.querySelector("#step-picture .face[data-transform]")))) turned = true;
            await ctx.sleep(120);
            await ctx.click("#step-next");
            continue;
          }
          if (await ctx.eval(() => document.querySelector("#board").dataset.state === "over")) break;
          await ctx.sleep(40);
        }
      }
      const r = await ctx.eval(() => ({ max: window.__maxAnimations, animated: [...new Set(window.__animated)].slice(0, 5) }));
      ctx.assert(r.max === 0, `${r.max} animations ran with reduced motion: ${r.animated.join(", ")}`);
      ctx.assert(captions.some((c) => c.step === "learning"), "No learning step was shown");
      const blank = captions.filter((c) => c.caption.length < 5);
      ctx.assert(blank.length === 0, `Steps without a caption: ${blank.map((c) => c.step).join(", ")}`);
      if (turned) console.log("     a turned box came up: its face was drawn turned, with no animation");
    },
  },
  {
    name: "learning-beads",
    spec: "FR-008, US3/AC1–AC4",
    timeout: 240000,
    async run(ctx) {
      await turnOnSteps(ctx, "manual");
      await ctx.selectOpponent("random");
      const results = new Set();
      const problems = [];
      let frames = 0;
      for (let game = 0; game < 30 && !(results.has("win") && results.has("loss")); game++) {
        if (game > 0) await ctx.click("#new-game-btn");
        for (let guard = 0; guard < 3000; guard++) {
          const f = await ctx.eval(readLearningFrame);
          if (f) {
            frames++;
            results.add(f.result);
            const expected = f.result === "win" ? "+3" : f.result === "draw" ? "+1" : "−1";
            if (f.delta !== expected) problems.push(`${f.key}: ledger delta ${f.delta} after a ${f.result}`);
            if (f.result === "loss") {
              if (f.outs !== 1 || f.drops !== 0) problems.push(`${f.key}: a loss shows ${f.outs} beads out and ${f.drops} in`);
            } else if (f.drops !== Number(expected) || f.outs !== 0) {
              problems.push(`${f.key}: a ${f.result} shows ${f.drops} beads dropping in and ${f.outs} out`);
            }
            if (f.trayCount !== f.ledgerCount) problems.push(`${f.key}: tray shows ${f.trayCount}, ledger ${f.ledgerCount}`);
            const sentences = f.caption.split(/[.!?]+/).filter((s) => s.trim()).length;
            if (sentences < 1 || sentences > 2) problems.push(`${f.key}: caption has ${sentences} sentences: "${f.caption}"`);
            await ctx.click("#step-next");
            await ctx.sleep(30);
            continue;
          }
          const s = await ctx.eval(readStep);
          if (s) {
            await ctx.click("#step-next");
            await ctx.sleep(30);
            continue;
          }
          const over = await ctx.eval(() => document.querySelector("#board").dataset.state === "over");
          if (over) break;
          await ctx.sleep(30);
        }
      }
      ctx.assert(results.has("win") && results.has("loss"), `Only saw: ${[...results].join(", ") || "no learning frames"}`);
      ctx.assert(problems.length === 0, problems.slice(0, 10).join("\n"));
      ctx.assert(frames >= 4, `Only ${frames} learning frames were seen`);
    },
  },
  {
    name: "steps-order",
    spec: "FR-006, FR-007, US2/AC1–AC2, AC4–AC6",
    timeout: 180000,
    async run(ctx) {
      // Help off: no steps, and MENACE's ◯ follows within a second (US2/AC6).
      await ctx.waitFor(() => document.querySelector('#board button[data-mark="X"]'), { timeout: 3000 });
      const off = await ctx.eval(() => new Promise((resolve) => {
        const t = performance.now();
        let sawArea = false;
        document.querySelector("#new-game-btn").click();
        (function poll() {
          if (!document.querySelector("#step-area").hidden) sawArea = true;
          if (document.querySelector('#board button[data-mark="X"]')) return resolve({ ms: performance.now() - t, sawArea });
          if (performance.now() - t > 3000) return resolve({ ms: Infinity, sawArea });
          requestAnimationFrame(poll);
        })();
      }));
      ctx.assert(!off.sawArea, "The step area showed while the help was off");
      ctx.assert(off.ms <= 1000, `With the help off MENACE's ◯ took ${Math.round(off.ms)} ms`);

      // Help on, one step at a time: five steps in order; the ◯ only at step 5 (US2/AC1–AC2).
      await turnOnSteps(ctx, "manual");
      await ctx.click("#new-game-btn");
      await waitForStep(ctx, "find");
      const seen = [];
      for (let k = 1; k <= 5; k++) {
        const s = await ctx.eval(readStep);
        ctx.assert(s, `The step area hid before step ${k}`);
        seen.push(s.step);
        ctx.assert(s.indicator === `Step ${k} of 5`, `Step ${k} indicator reads "${s.indicator}"`);
        ctx.assert(s.caption.length > 10, `Step ${k} (${s.step}) has no caption`);
        // FR-006, US2/AC1: one sentence per step, in the standard words and in the simple words.
        ctx.assert(sentenceCount(s.caption) === 1, `Step ${k} (${s.step}) caption is not one sentence: "${s.caption}"`);
        await ctx.click("#help-words");
        const simple = await ctx.eval(() => ({
          caption: document.querySelector("#step-caption").textContent.replace(/\s+/g, " ").trim(),
          copy: document.querySelector("#step-caption").dataset.copy || "",
        }));
        await ctx.click("#help-words");
        ctx.assert(simple.copy.startsWith("steps."), `Step ${k} (${s.step}) shows no copy-deck caption with Simple words on`);
        ctx.assert(sentenceCount(simple.caption) === 1, `Step ${k} (${s.step}) simple caption is not one sentence: "${simple.caption}"`);
        if (s.step !== "play") ctx.assert(s.menaceMarks === 0, `MENACE's ◯ is on the board at step ${s.step}`);
        if (s.step === "lookup") ctx.assert(s.markers >= 1, "No bead marker at the look-up step");
        if (s.step === "play") {
          ctx.assert(s.menaceMarks === 1, "MENACE's ◯ is not on the board at step 5");
          // Markers on squares that share the colour fade out; none may remain.
          await ctx.waitFor(() => document.querySelectorAll("#board .bead-marker").length === 0, {
            timeout: 1500, message: "A bead marker is still on the board after step 5",
          });
        }
        if (k === 1) ctx.assert(/new|never/i.test(s.caption), `A new box's first step does not say so: "${s.caption}"`);
        await ctx.click("#step-next");
        if (k < 5) await waitForStep(ctx, ORDER[k]);
      }
      ctx.assert(seen.join() === ORDER.join(), `Steps came as ${seen.join(", ")}`);
      await ctx.waitFor(() => document.querySelector("#step-area").hidden, { message: "The step area stayed after step 5" });

      // The last free square: one caption instead of five steps (US2/AC5).
      let forced = null;
      for (let game = 0; game < 20 && !forced; game++) {
        if (game > 0) await ctx.click("#new-game-btn");
        const steps = [];
        for (let guard = 0; guard < 2000; guard++) {
          const state = await ctx.eval(() => document.querySelector("#board").dataset.state);
          const s = await ctx.eval(readStep);
          if (s) {
            if (steps.at(-1) !== s.step || s.step === "find") steps.push(s.step);
            if (s.step === "forced") {
              forced = { ...s, before: steps.slice(-2) };
              await ctx.click("#step-next");
              await ctx.sleep(100);
              forced.after = await ctx.eval(readStep);
              break;
            }
            await ctx.click("#step-next");
            await ctx.sleep(30);
            continue;
          }
          if (state === "over") break;
          const human = await ctx.eval(() => document.querySelector("#board").dataset.turn === "human");
          if (human) {
            const square = await ctx.eval(visitorSquare);
            await ctx.click(`#board button[data-idx="${square}"]`);
          }
          await ctx.sleep(30);
        }
      }
      ctx.assert(forced, "No game reached MENACE's last, forced move in 20 games");
      ctx.assert(forced.indicator === "", `The forced move shows "${forced.indicator}"`);
      ctx.assert(/one|only/i.test(forced.caption), `Forced-move caption: "${forced.caption}"`);
      // The game is over after the last square, so only the end-of-game learning may follow.
      ctx.assert(
        forced.after === null || forced.after.step === "learning",
        `After the forced-move caption came step "${forced.after && forced.after.step}"`,
      );
    },
  },
  {
    name: "steps-auto",
    spec: "FR-007, US2/AC3",
    timeout: 90000,
    async run(ctx) {
      await turnOnSteps(ctx, "auto");
      await ctx.eval(() => {
        window.__stepLog = [];
        const area = document.querySelector("#step-area");
        new MutationObserver(() => {
          const step = area.hidden ? "hidden" : area.dataset.step;
          const log = window.__stepLog;
          if (!log.length || log.at(-1).step !== step) log.push({ step, t: performance.now() });
        }).observe(area, { attributes: true, attributeFilter: ["hidden", "data-step"] });
      });
      await ctx.click("#new-game-btn");
      await waitForStep(ctx, "shake");
      await ctx.sleep(400);
      await ctx.click("#step-playpause");
      const paused = await ctx.eval(() => document.querySelector("#step-playpause").getAttribute("aria-pressed"));
      ctx.assert(paused === "true", "Pause is not shown as pressed");
      await ctx.sleep(3000);
      const still = await ctx.eval(readStep);
      ctx.assert(still && still.step === "shake", `Pause did not hold the step (now: ${still && still.step})`);
      await ctx.click("#step-playpause");
      await ctx.waitFor(() => window.__stepLog.some((e) => e.step === "play"), { timeout: 15000, message: "Play did not resume the steps" });
      await ctx.waitFor(() => window.__stepLog.at(-1).step === "hidden", { timeout: 6000, message: "The steps did not finish" });
      const log = await ctx.eval(() => window.__stepLog);
      const order = log.map((e) => e.step).filter((s) => s !== "hidden");
      ctx.assert(order.slice(0, 5).join() === ORDER.join(), `Steps came as ${order.join(", ")}`);
      for (let k = 0; k < 5; k++) {
        const ms = log[k + 1].t - log[k].t;
        const min = log[k].step === "shake" ? 5000 : 2000;
        ctx.assert(ms >= min - 30, `Step "${log[k].step}" showed for only ${Math.round(ms)} ms (needs ${min})`);
      }
    },
  },
  {
    name: "steps-interrupt",
    spec: "FR-011",
    timeout: 90000,
    async run(ctx) {
      await turnOnSteps(ctx, "manual");
      await ctx.click("#new-game-btn");
      await waitForStep(ctx, "find");
      await ctx.click("#step-next");
      await waitForStep(ctx, "shake");
      await ctx.click("#step-next");
      await waitForStep(ctx, "tilt");
      const before = await ctx.gamesPlayed();

      // New game during step 3: the old steps vanish and a new game starts at step 1.
      const r = await ctx.eval(() => {
        document.querySelector("#new-game-btn").click();
        const area = document.querySelector("#step-area");
        return { step: area.hidden ? null : area.dataset.step, marks: document.querySelectorAll('#board button[data-mark="X"]').length };
      });
      ctx.assert(r.step === null || r.step === "find", `After New game the step area shows "${r.step}"`);
      ctx.assert(r.marks === 0, "The abandoned game's ◯ is still on the board");
      ctx.assert(await ctx.gamesPlayed() === before, "The interrupted game was recorded");

      // Training during step 3: the steps vanish at once and only the trained games count.
      await ctx.selectOpponent("random");
      await waitForStep(ctx, "find");
      await ctx.click("#step-next");
      await ctx.click("#step-next");
      await waitForStep(ctx, "tilt");
      const hidden = await ctx.eval(() => {
        document.querySelector('[data-train="20"]').click();
        return document.querySelector("#step-area").hidden;
      });
      ctx.assert(hidden, "Starting training left the step area on screen");
      await ctx.waitFor(() => document.querySelector("#controls").dataset.training === "idle", { timeout: 30000 });
      ctx.assert(await ctx.gamesPlayed() === before + 20, "Training recorded more or fewer than its 20 games");
      ctx.assert(await ctx.eval(() => document.querySelector("#step-area").hidden), "The step area showed during or after training");
    },
  },
];
