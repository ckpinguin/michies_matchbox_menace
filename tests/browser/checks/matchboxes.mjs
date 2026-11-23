// Matchbox picture checks (feature 002: US1, US4; FR-001–FR-004, FR-009, FR-010, SC-004).
//
//   matchbox-counts, bead-marks, matchbox-empty, turned-box, shared-colour-markers
//
// The checks read the shared DOM hooks listed in specs/002-kid-friendly-matchboxes/tasks.md.

import path from "node:path";

// Sentences in a caption, split at . ! and ? as the copy-deck rules do (FR-006: one per step).
const sentenceCount = (text) => text.split(/[.!?]+/).filter((s) => /[\p{L}\p{N}]/u.test(s)).length;

// In the page: every box-panel entry's matchbox against the same entry's ledger (SC-004).
// Returns { entries, heaps, problems }.
function compareTraysWithLedgers() {
  const problems = [];
  let entries = 0, heaps = 0;
  for (const entry of document.querySelectorAll("#box-panel .box-entry:not(.box-entry-resigned)")) {
    const svg = entry.querySelector("svg.matchbox");
    const ledger = [...entry.querySelectorAll(".bead-ledger li")];
    if (!ledger.length) continue;
    entries++;
    if (!svg) { problems.push("an entry has no matchbox"); continue; }
    const ledgerCounts = new Map();
    for (const li of ledger) {
      const square = Number(/box square ([1-9])/.exec(li.querySelector(".sq-label").textContent)[1]) - 1;
      const count = Number(/(\d+) bead/.exec(li.querySelector(".count").textContent)[1]);
      ledgerCounts.set(square, count);
    }
    const drawn = svg.querySelector(".bead-drawn");
    const drawnColor = drawn ? Number(drawn.dataset.color) : null;
    const groups = [...svg.querySelectorAll(".tray-group")];
    const trayColors = new Set(groups.map((g) => Number(g.dataset.color)));
    for (const [square, count] of ledgerCounts) {
      if (count > 0 && !trayColors.has(square)) problems.push(`box square ${square + 1}: ${count} beads in the ledger, none in the tray`);
    }
    for (const g of groups) {
      const color = Number(g.dataset.color);
      const count = Number(g.dataset.count);
      const extra = drawnColor === color ? 1 : 0;
      if (ledgerCounts.get(color) !== count) {
        problems.push(`box square ${color + 1}: tray says ${count}, ledger says ${ledgerCounts.get(color)}`);
      }
      if (g.dataset.display === "beads") {
        const shown = g.querySelectorAll(".bead").length + extra;
        if (shown !== count) problems.push(`box square ${color + 1}: ${shown} beads drawn for a count of ${count}`);
      } else {
        heaps++;
        const heap = g.querySelector(".heap");
        const m = heap ? /×\s*(\d+)/.exec(heap.textContent) : null;
        if (!m) problems.push(`box square ${color + 1}: a heap without a "× n" count`);
        else if (Number(m[1]) + extra !== count) problems.push(`box square ${color + 1}: heap reads × ${m[1]} for a count of ${count}`);
        if (count <= 12) problems.push(`box square ${color + 1}: a heap for only ${count} beads`);
      }
    }
  }
  return { entries, heaps, problems };
}

// Samples the panel every `interval` ms until the game is over, then once more.
async function sampleGame(ctx, report) {
  for (;;) {
    const over = await ctx.eval(() => document.querySelector("#board").dataset.state === "over");
    const result = await ctx.eval(compareTraysWithLedgers);
    report.samples++;
    report.entries = Math.max(report.entries, result.entries);
    report.heaps += result.heaps;
    for (const p of result.problems) report.problems.add(p);
    if (over) return;
    await ctx.sleep(60);
  }
}

// Drives animated games with Step by step on ("One step at a time"), pressing Next at every
// frame and calling onFrame(step) first. Stops when onFrame returns true or after `games` games.
async function driveSteps(ctx, games, onFrame) {
  for (let game = 0; game < games; game++) {
    if (game > 0) await ctx.click("#new-game-btn");
    for (let guard = 0; guard < 3000; guard++) {
      const step = await ctx.eval(() => {
        const area = document.querySelector("#step-area");
        return area.hidden ? null : area.dataset.step;
      });
      if (step) {
        if (await onFrame(step)) return true;
        await ctx.click("#step-next");
        await ctx.sleep(30);
        continue;
      }
      if (await ctx.eval(() => document.querySelector("#board").dataset.state === "over")) break;
      await ctx.sleep(30);
    }
  }
  return false;
}

async function stepsOn(ctx) {
  await ctx.click("#help-steps");
  await ctx.click('#help-pacing [data-pacing="manual"]');
}

const markersNow = () => [...document.querySelectorAll("#board .bead-marker")].map((m) => ({
  square: Number(m.closest("button[data-idx]").dataset.idx),
  color: m.dataset.color,
  shape: m.dataset.shape,
  fading: m.classList.contains("fading"),
}));

export default [
  {
    name: "turned-box",
    spec: "FR-009, US4/AC1, US4/AC3",
    timeout: 240000,
    async run(ctx) {
      await stepsOn(ctx);
      await ctx.selectOpponent("random");
      let found = null;
      await driveSteps(ctx, 30, async (step) => {
        if (step !== "lookup") return false;
        const t = await ctx.eval(() => Number(document.querySelector("#step-picture .face")?.dataset.transform || 0));
        if (!t) return false;
        found = { t, caption: await ctx.eval(() => document.querySelector("#step-caption").textContent.replace(/\s+/g, " ").trim()) };
        return true;
      });
      ctx.assert(found, "No turned box came up in 30 games");
      ctx.assert(sentenceCount(found.caption) === 1, `The turned box's caption is not one sentence (FR-006): "${found.caption}"`);

      // The bead's square lands on the board once the picture has turned.
      const markers = await ctx.waitFor(() => {
        const list = [...document.querySelectorAll("#board .bead-marker")];
        return list.length ? list.map((m) => Number(m.closest("button[data-idx]").dataset.idx)) : null;
      }, { timeout: 3000, message: "No bead marker after the box turned" });
      const replay = await ctx.eval(() => !document.querySelector("#step-replay").hidden);
      ctx.assert(replay, "Replay turn is not offered for a turned box");
      await ctx.sleep(1400);
      const replayed = await ctx.eval(() => {
        document.querySelector("#step-replay").click();
        return document.getAnimations().some((a) => a.effect && a.effect.target && a.effect.target.classList.contains("face"));
      });
      ctx.assert(replayed, "Replay turn did not turn the picture again");
      await ctx.sleep(1400);

      const before = await ctx.eval(() => [...document.querySelectorAll('#board button[data-mark="X"]')].map((b) => Number(b.dataset.idx)));
      await ctx.click("#step-next");
      const atPlay = await ctx.eval(() => {
        const face = document.querySelector("#step-picture .face");
        const m = /matrix\(([^)]+)\)/.exec(getComputedStyle(face).transform);
        return {
          step: document.querySelector("#step-area").dataset.step,
          matrix: m ? m[1].split(",").map(Number) : null,
          expected: [...window.MenaceEngine.PICTURE_MATRICES[Number(face.dataset.transform)]],
          marks: [...document.querySelectorAll('#board button[data-mark="X"]')].map((b) => Number(b.dataset.idx)),
        };
      });
      ctx.assert(atPlay.step === "play", `Expected step 5, got ${atPlay.step}`);
      ctx.assert(atPlay.matrix, "The face has no transform at step 5");
      const close = atPlay.matrix.slice(0, 4).every((v, k) => Math.abs(v - atPlay.expected[k]) < 1e-6) &&
        Math.abs(atPlay.matrix[4]) < 1e-6 && Math.abs(atPlay.matrix[5]) < 1e-6;
      ctx.assert(close, `Face transform ${atPlay.matrix.join(", ")} but PICTURE_MATRICES[${found.t}] is ${atPlay.expected.join(", ")}`);
      const placed = atPlay.marks.filter((i) => !before.includes(i));
      ctx.assert(placed.length === 1, `${placed.length} new ◯ after step 5`);
      ctx.assert(markers.includes(placed[0]), `The ◯ went to board square ${placed[0] + 1}, but the marker was on ${markers.map((i) => i + 1).join(", ")}`);
    },
  },
  {
    name: "shared-colour-markers",
    spec: "FR-010, US4/AC2",
    timeout: 180000,
    async run(ctx) {
      await stepsOn(ctx);
      await ctx.selectOpponent("random"); // starts a new game; nobody has to answer MENACE's moves
      let found = null;
      await driveSteps(ctx, 20, async (step) => {
        if (step !== "lookup") return false;
        const r = await ctx.waitFor(() => {
          const list = document.querySelectorAll("#board .bead-marker");
          if (!list.length) return null;
          const entries = document.querySelectorAll("#box-panel .box-entry");
          const drawn = entries[entries.length - 1].querySelector(".bead-ledger li.drawn");
          const same = /\(same as ([^)]+)\)/.exec(drawn ? drawn.textContent : "");
          return { group: same ? 1 + same[1].split(",").length : 1, caption: document.querySelector("#step-caption").textContent };
        }, { timeout: 3000 });
        if (r.group < 2) return false;
        found = { ...r, markers: await ctx.eval(markersNow) };
        return true;
      });
      ctx.assert(found, "No shared-colour bead came up in 20 games");
      ctx.assert(found.markers.length === found.group, `${found.markers.length} markers for a group of ${found.group} squares`);
      ctx.assert(new Set(found.markers.map((m) => m.color + "/" + m.shape)).size === 1, "The markers do not share one colour and shape");
      ctx.assert(/same move/i.test(found.caption), `The caption does not say the squares are the same move: "${found.caption}"`);
      ctx.assert(/one of them/i.test(found.caption), `The caption does not say MENACE picks one of the squares: "${found.caption}"`);
      ctx.assert(sentenceCount(found.caption) === 1, `The shared-colour caption is not one sentence (FR-006): "${found.caption}"`);

      const before = await ctx.eval(() => [...document.querySelectorAll('#board button[data-mark="X"]')].map((b) => Number(b.dataset.idx)));
      await ctx.click("#step-next");
      await ctx.waitFor(() => document.querySelectorAll("#board .bead-marker").length === 0, {
        timeout: 2000, message: "Markers stayed on the board after step 5",
      });
      const after = await ctx.eval(() => [...document.querySelectorAll('#board button[data-mark="X"]')].map((b) => Number(b.dataset.idx)));
      const placed = after.filter((i) => !before.includes(i));
      ctx.assert(placed.length === 1, `${placed.length} new ◯ after step 5`);
      ctx.assert(found.markers.some((m) => m.square === placed[0]), "The ◯ is not on one of the marked squares");
    },
  },
  {
    name: "matchbox-counts",
    spec: "FR-001, FR-002, SC-004",
    timeout: 240000,
    async run(ctx) {
      await ctx.selectOpponent("random");
      const report = { samples: 0, entries: 0, heaps: 0, problems: new Set() };
      for (let game = 0; game < 10; game++) {
        if (game > 0) await ctx.click("#new-game-btn");
        await sampleGame(ctx, report);
      }
      ctx.assert(report.entries > 0, "No box-panel entry was seen");
      ctx.assert(report.problems.size === 0, `Matchboxes disagree with the ledger:\n${[...report.problems].slice(0, 10).join("\n")}`);

      // Many wins grow the opening box past 12 beads of a colour: it must become a heap.
      await ctx.train(500, { timeout: 120000 });
      const afterTraining = await ctx.eval(compareTraysWithLedgers);
      ctx.assert(afterTraining.problems.length === 0, `After training:\n${afterTraining.problems.join("\n")}`);
      report.heaps = 0;
      await ctx.click("#new-game-btn");
      await sampleGame(ctx, report);
      ctx.assert(report.problems.size === 0, `Matchboxes disagree with the ledger:\n${[...report.problems].slice(0, 10).join("\n")}`);
      ctx.assert(report.heaps > 0, "No heap was shown after 500 training games");
    },
  },
  {
    name: "bead-marks",
    spec: "FR-003, FR-004",
    timeout: 120000,
    async run(ctx) {
      await ctx.selectOpponent("random");
      const seen = [];
      const problems = new Set();
      for (let game = 0; game < 6 && seen.length < 4; game++) {
        await ctx.click("#new-game-btn");
        for (;;) {
          const r = await ctx.eval(() => {
            const marker = document.querySelector("#board .bead-marker");
            const over = document.querySelector("#board").dataset.state === "over";
            if (!marker) return { over };
            const square = marker.closest("button[data-idx]");
            const entries = document.querySelectorAll("#box-panel .box-entry");
            const drawn = entries.length ? entries[entries.length - 1].querySelector(".bead-drawn") : null;
            return {
              over,
              marker: { color: marker.dataset.color, shape: marker.dataset.shape },
              squareMark: square.dataset.mark,
              label: square.getAttribute("aria-label"),
              drawn: drawn ? { color: drawn.dataset.color, shape: drawn.dataset.shape } : null,
            };
          });
          if (r.marker) {
            const key = JSON.stringify(r);
            if (!seen.includes(key)) seen.push(key);
            if (!r.drawn) problems.add("The board shows a bead marker but the box shows no drawn bead");
            else if (r.drawn.color !== r.marker.color || r.drawn.shape !== r.marker.shape) {
              problems.add(`Drawn bead ${r.drawn.color}/${r.drawn.shape} but board marker ${r.marker.color}/${r.marker.shape}`);
            }
            if (r.squareMark) problems.add("MENACE's mark is drawn while its bead marker still shows");
            if (!/MENACE's bead points here$/.test(r.label)) problems.add(`Marker square label: ${r.label}`);
          }
          if (r.over) break;
          await ctx.sleep(20);
        }
      }
      ctx.assert(seen.length >= 3, `Only ${seen.length} bead markers were seen`);
      ctx.assert(problems.size === 0, [...problems].join("\n"));

      // Colour and shape go together everywhere: no two colours share a shape.
      const clash = await ctx.eval(() => {
        const shapeOf = new Map(), colourOf = new Map(), out = [];
        for (const bead of document.querySelectorAll(".bead[data-color]")) {
          const c = bead.dataset.color, s = bead.dataset.shape;
          if (shapeOf.has(c) && shapeOf.get(c) !== s) out.push(`colour ${c} drawn as ${shapeOf.get(c)} and ${s}`);
          if (colourOf.has(s) && colourOf.get(s) !== c) out.push(`shape ${s} used by colours ${colourOf.get(s)} and ${c}`);
          shapeOf.set(c, s);
          colourOf.set(s, c);
        }
        return out;
      });
      ctx.assert(clash.length === 0, clash.join("\n"));
    },
  },
  {
    name: "matchbox-empty",
    spec: "US1/AC6",
    async run(ctx) {
      await ctx.page.setFileInput("#load-input", path.join(ctx.fixturesDir, "valid/empty-opening.json"));
      await ctx.waitFor(() => /can’t start a game/.test(document.querySelector("#status-line").textContent), {
        message: "The empty opening box was not reported",
      });
      const r = await ctx.eval(() => {
        const entry = document.querySelector("#box-panel .box-entry-resigned");
        if (!entry) return null;
        const svg = entry.querySelector("svg.matchbox");
        return {
          hasPicture: Boolean(svg),
          beads: svg ? svg.querySelectorAll(".bead").length : -1,
          role: svg ? svg.getAttribute("role") : null,
          label: svg ? svg.getAttribute("aria-label") : "",
          text: entry.textContent.replace(/\s+/g, " "),
        };
      });
      ctx.assert(r, "No resigned entry in the box panel");
      ctx.assert(r.hasPicture, "The empty box has no matchbox picture");
      ctx.assert(r.beads === 0, `The empty box shows ${r.beads} beads`);
      ctx.assert(r.role === "img" && /no beads/i.test(r.label), `Picture label: ${r.label}`);
      ctx.assert(/nothing (left )?to draw/i.test(r.text), `No "nothing to draw" caption: ${r.text.slice(0, 200)}`);

      // With Simple words on, the caption uses the copy deck's plain words: MENACE gives up, and
      // no word-list term such as "resigned" (FR-013). Turning it off restores feature 001's text.
      const readEntry = () => {
        const entry = document.querySelector("#box-panel .box-entry-resigned");
        const note = entry && entry.querySelector(".box-note");
        return entry ? {
          html: entry.innerHTML,
          text: entry.textContent.replace(/\s+/g, " "),
          copy: note ? note.dataset.copy || "" : "",
        } : null;
      };
      const standard = await ctx.eval(readEntry);
      await ctx.click("#help-words");
      const simple = await ctx.eval(readEntry);
      ctx.assert(simple, "The resigned entry disappeared when Simple words was turned on");
      ctx.assert(simple.copy === "steps.empty.text steps.empty.opening", `Simple-words caption keys: "${simple.copy}"`);
      ctx.assert(/nothing to draw/i.test(simple.text) && /gives up/i.test(simple.text), `Simple-words caption: ${simple.text.slice(0, 240)}`);
      ctx.assert(!/\bresign/i.test(simple.text), `The simple-words entry still says "resign": ${simple.text.slice(0, 240)}`);
      await ctx.click("#help-words");
      const back = await ctx.eval(readEntry);
      ctx.assert(back && back.html === standard.html, "Turning Simple words off did not restore the standard entry exactly");
    },
  },
];
