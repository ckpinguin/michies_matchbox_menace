// Simple-words, tips, story and comparison checks (feature 002: US5, US6, FR-012–FR-016, FR-021).
//
//   tips-once, simple-words-text, story, compare, help-identical, help-perf
//
// The checks read the shared DOM hooks listed in specs/002-kid-friendly-matchboxes/tasks.md.

import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const TIP_EVENTS = ["new-box", "first-win", "first-draw", "first-loss", "turned-box", "empty-box"];

// In the page: records every tip that appears, and whether it took focus.
function watchTips() {
  window.__tips = [];
  const slot = document.querySelector("#tip-slot");
  new MutationObserver((records) => {
    for (const r of records) {
      for (const node of r.addedNodes) {
        if (node.nodeType === 1 && node.matches(".tip")) {
          window.__tips.push({ copy: node.dataset.copy, focused: node.contains(document.activeElement) });
        }
      }
    }
  }).observe(slot, { childList: true });
}

// Closes any open tip: the first with Esc from inside it, the others with "Got it".
async function closeTips(ctx, state) {
  for (;;) {
    const open = await ctx.eval(() => {
      const tip = document.querySelector("#tip-slot .tip");
      return tip ? tip.dataset.copy : null;
    });
    if (!open) return;
    if (!state.escTried) {
      state.escTried = true;
      await ctx.eval(() => document.querySelector("#tip-slot .tip button").focus());
      await ctx.page.press("Escape");
      const closed = await ctx.eval((copy) => !document.querySelector(`#tip-slot .tip[data-copy="${copy}"]`), open);
      ctx.assert(closed, "Esc did not close the tip");
    } else {
      await ctx.click("#tip-slot .tip button");
    }
    await ctx.sleep(30);
  }
}

async function loadFile(ctx, file) {
  await ctx.page.setFileInput("#load-input", file);
  await ctx.sleep(200);
  // A MENACE that has played asks before it is replaced.
  await ctx.eval(() => {
    const dialog = document.querySelector("#confirm-dialog");
    if (dialog && dialog.open) [...dialog.querySelectorAll("button")].find((b) => /replace/i.test(b.textContent)).click();
  });
}

// In the page: whether a shown text is exactly the deck entries named in data-copy, and passes
// the reading rules (FR-013). Returns a list of problems.
function checkShownText(records) {
  const deck = JSON.parse(document.getElementById("menace-copy").textContent);
  const lookup = (key) => key.split(".").reduce((v, k) => (v == null ? v : v[k]), deck);
  const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const explained = new Set(Object.keys(deck.explains || {}).map((t) => t.toLowerCase()));
  const problems = [];
  for (const { where, text, copy } of records) {
    if (!text) continue;
    if (!copy) { problems.push(`${where} shows text that is not from the deck: "${text}"`); continue; }
    const templates = copy.split(" ").map(lookup);
    if (templates.some((t) => typeof t !== "string")) { problems.push(`${where}: unknown deck key in "${copy}"`); continue; }
    const pattern = new RegExp("^" + templates.map((t) => escape(t.replace(/\s+/g, " ").trim()).replace(/\\\{[a-zA-Z]+\\\}/g, "(.+?)")).join(" ") + "$");
    if (!pattern.test(text)) problems.push(`${where}: "${text}" is not ${copy}`);
    for (const sentence of text.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean)) {
      const words = sentence.split(/\s+/).filter((w) => w && w !== "—" && w !== "–").length;
      if (words > 15) problems.push(`${where}: ${words} words: "${sentence}"`);
    }
    for (const term of deck.wordList) {
      if (new RegExp(`(^|[^\\p{L}])${term}([^\\p{L}]|$)`, "iu").test(text) && !explained.has(term)) {
        problems.push(`${where}: uses "${term}": "${text}"`);
      }
    }
  }
  return problems;
}

// In the page: the opening box's counts per representative, from the box panel's first entry.
function openingLedger() {
  const entry = document.querySelector("#box-panel .box-entry");
  if (!entry) return null;
  const counts = {};
  for (const li of entry.querySelectorAll(".bead-ledger li")) {
    const square = Number(/box square ([1-9])/.exec(li.querySelector(".sq-label").textContent)[1]) - 1;
    counts[square] = Number(/(\d+) bead/.exec(li.querySelector(".count").textContent)[1]);
  }
  return { key: entry.querySelector("svg.matchbox").dataset.positionKey, counts };
}

// In the page: the tray counts of a matchbox picture, as { square: count } for colours with beads.
function trayCounts(selector) {
  const svg = document.querySelector(selector);
  if (!svg) return null;
  return Object.fromEntries([...svg.querySelectorAll(".tray-group")].map((g) => [g.dataset.color, Number(g.dataset.count)]));
}

function waitForDownload(dir, timeout = 10000) {
  const deadline = Date.now() + timeout;
  return (async () => {
    while (Date.now() < deadline) {
      const files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
      if (files.length) {
        const file = path.join(dir, files[0]);
        if ((await stat(file)).size > 0) return file;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error("No file was downloaded");
  })();
}

// 5 animated games against the Random mover, then Run 100, then Save. With the helps on, the
// check presses Next through every step and learning sequence and closes every tip.
async function playAndSave(ctx, helpsOn, dir) {
  if (helpsOn) {
    await ctx.click("#help-steps");
    await ctx.click('#help-pacing [data-pacing="manual"]');
    await ctx.click("#help-words");
  }
  await ctx.selectOpponent("random");
  for (let game = 0; game < 5; game++) {
    if (game > 0) await ctx.click("#new-game-btn");
    for (let guard = 0; guard < 3000; guard++) {
      const s = await ctx.eval(() => ({
        steps: !document.querySelector("#step-area").hidden,
        tip: Boolean(document.querySelector("#tip-slot .tip")),
        over: document.querySelector("#board").dataset.state === "over",
      }));
      if (s.tip) await ctx.click("#tip-slot .tip button");
      if (s.steps) { await ctx.click("#step-next"); await ctx.sleep(20); continue; }
      if (s.over) break;
      await ctx.sleep(30);
    }
  }
  await ctx.train(100);
  await ctx.page.setDownloadDir(dir);
  await ctx.click("#save-btn");
  const saved = JSON.parse(await readFile(await waitForDownload(dir), "utf8"));
  delete saved.savedAt;
  return saved;
}

// In the page: presses Run 500 `runs` times in a row and returns the total time. The end of each
// run is caught exactly, by watching the controls card's data-training attribute.
async function timeRuns(runs) {
  const controls = document.querySelector("#controls");
  let total = 0;
  for (let k = 0; k < runs; k++) {
    total += await new Promise((resolve) => {
      const t0 = performance.now();
      const observer = new MutationObserver(() => {
        if (controls.dataset.training === "idle") {
          observer.disconnect();
          resolve(performance.now() - t0);
        }
      });
      observer.observe(controls, { attributes: true, attributeFilter: ["data-training"] });
      document.querySelector('[data-train="500"]').click();
    });
  }
  return total;
}

async function resetMenace(ctx) {
  await ctx.click("#reset-btn");
  await ctx.click("#reset-btn");
}

export default [
  {
    name: "help-identical",
    spec: "FR-021, SC-008",
    timeout: 300000,
    async run(ctx) {
      const dirOn = await ctx.tmpDir("menace-help-on-");
      const dirOff = await ctx.tmpDir("menace-help-off-");
      const on = await playAndSave(ctx, true, dirOn);
      await ctx.page.reload(); // the same seed is applied to the new document
      const off = await playAndSave(ctx, false, dirOff);
      ctx.assert(on.record && on.record.gamesPlayed === 105, `Expected 105 games, saved ${on.record && on.record.gamesPlayed}`);
      const a = JSON.stringify(on), b = JSON.stringify(off);
      if (a !== b) {
        const at = [...a].findIndex((c, i) => c !== b[i]);
        ctx.assert(false, `The saves differ with the help on and off, from: …${a.slice(Math.max(0, at - 60), at + 60)}… vs …${b.slice(Math.max(0, at - 60), at + 60)}…`);
      }
    },
  },
  {
    name: "help-perf",
    spec: "FR-012, SC-005",
    timeout: 120000,
    async run(ctx) {
      await ctx.selectOpponent("random");
      const helps = async (on) => {
        const pressed = await ctx.eval(() => document.querySelector("#help-steps").getAttribute("aria-pressed") === "true");
        if (pressed !== on) {
          await ctx.click("#help-steps");
          await ctx.click("#help-words");
        }
      };
      // Alternate, and keep the best of three each, so the comparison is not just noise. Training
      // is fast (500 games take tens of ms), so each measurement is four runs of 500.
      const times = { on: [], off: [] };
      for (let round = 0; round < 3; round++) {
        for (const mode of ["off", "on"]) {
          await resetMenace(ctx);
          await helps(mode === "on");
          times[mode].push(await ctx.eval(timeRuns, 4)); // 2,000 games: long enough to measure
        }
      }
      ctx.assert(await ctx.gamesPlayed() === 2000, `The last measurement recorded ${await ctx.gamesPlayed()} games, not 2,000`);
      const best = (list) => Math.min(...list);
      const ratio = best(times.on) / best(times.off);
      console.log(`     2,000 games vs random mover: helps off ${Math.round(best(times.off))} ms, on ${Math.round(best(times.on))} ms (×${ratio.toFixed(2)})`);
      ctx.assert(ratio <= 1.1, `With the helps on, training took ×${ratio.toFixed(2)} as long (budget ×1.10)`);

      // A matchbox picture draws in under 2 ms: switch the "What changed?" box 50 times
      // (two pictures each).
      const ms = await ctx.eval(() => {
        const select = document.querySelector("#compare-select");
        const t0 = performance.now();
        for (let k = 0; k < 50; k++) {
          select.selectedIndex = k % select.options.length;
          select.dispatchEvent(new Event("change"));
        }
        return (performance.now() - t0) / 100;
      });
      console.log(`     one matchbox picture: ${ms.toFixed(2)} ms`);
      ctx.assert(ms < 2, `A matchbox picture took ${ms.toFixed(2)} ms to draw (budget 2 ms)`);
    },
  },
  {
    name: "compare",
    spec: "FR-016, US6/AC1–AC2",
    timeout: 120000,
    async run(ctx) {
      await ctx.selectOpponent("random");
      await ctx.waitGameOver();
      const hiddenFirst = await ctx.eval(() => document.querySelector("#compare-section").hidden);
      ctx.assert(hiddenFirst, "“What changed?” shows before any training run");
      const before = await ctx.eval(openingLedger);
      ctx.assert(before, "No opening box in the box panel");
      await ctx.train(100);
      const after = await ctx.eval(openingLedger);
      const r = await ctx.eval(() => {
        const section = document.querySelector("#compare-section");
        const select = section.querySelector("select");
        return {
          hidden: section.hidden,
          title: document.querySelector("#compare-title").textContent,
          label: select && select.labels.length ? select.labels[0].textContent.trim() : null,
          firstOption: select ? select.options[0].value : null,
          selected: select ? select.value : null,
          summary: document.querySelector("#compare-summary").textContent.trim(),
          names: window.MenaceEngine.BEAD_MARKS.map((m) => m.colourName + " " + m.shape),
        };
      });
      ctx.assert(!r.hidden, "“What changed?” did not appear after the training run");
      ctx.assert(/What changed in the last training run\?/.test(r.title), `Heading: ${r.title}`);
      ctx.assert(r.label, "The box picker has no label");
      ctx.assert(r.firstOption === before.key && r.selected === before.key, "The opening box is not listed and chosen first");

      const shownBefore = await ctx.eval(trayCounts, "#compare-before svg.matchbox");
      const shownAfter = await ctx.eval(trayCounts, "#compare-after svg.matchbox");
      const nonZero = (counts) => Object.fromEntries(Object.entries(counts).filter(([, n]) => n > 0).map(([k, n]) => [String(k), n]));
      ctx.assert(JSON.stringify(shownBefore) === JSON.stringify(nonZero(before.counts)),
        `Before shows ${JSON.stringify(shownBefore)}, the box had ${JSON.stringify(before.counts)}`);
      ctx.assert(JSON.stringify(shownAfter) === JSON.stringify(nonZero(after.counts)),
        `After shows ${JSON.stringify(shownAfter)}, the box has ${JSON.stringify(after.counts)}`);

      // The sentence names the colour that grew most (ties to the lower square).
      let best = null;
      for (const sq of Object.keys(after.counts).map(Number).sort((a, b) => a - b)) {
        const by = after.counts[sq] - (before.counts[sq] || 0);
        if (by > 0 && (!best || by > best.by)) best = { sq, by };
      }
      ctx.assert(best, "The opening box did not grow in 100 games");
      ctx.assert(r.summary.includes(r.names[best.sq]), `Summary "${r.summary}" does not name the ${r.names[best.sq]} move`);

      // A game played after the run is not a change made by the run: "After" and the summary
      // stay as the run left them, though the box itself has changed again.
      const games = await ctx.gamesPlayed();
      await ctx.click("#new-game-btn");
      await ctx.waitFor((n) => Number(document.querySelector('[data-stat="games"] .value').textContent.replace(/[^0-9]/g, "")) === n,
        { timeout: 20000, message: "The game after the run did not finish" }, games + 1);
      const later = await ctx.eval(openingLedger);
      ctx.assert(later && later.key === before.key, "The game after the run did not use the opening box");
      ctx.assert(JSON.stringify(later.counts) !== JSON.stringify(after.counts), "The game after the run did not change the opening box");
      const afterLater = await ctx.eval(trayCounts, "#compare-after svg.matchbox");
      const summaryLater = await ctx.eval(() => document.querySelector("#compare-summary").textContent.trim());
      ctx.assert(JSON.stringify(afterLater) === JSON.stringify(shownAfter),
        `After a later game, “After” shows ${JSON.stringify(afterLater)}, not the run's ${JSON.stringify(shownAfter)}`);
      ctx.assert(summaryLater === r.summary, `After a later game, the summary changed to "${summaryLater}"`);

      // Reset clears it.
      await ctx.click("#reset-btn");
      await ctx.click("#reset-btn");
      const hiddenAfterReset = await ctx.eval(() => document.querySelector("#compare-section").hidden);
      ctx.assert(hiddenAfterReset, "“What changed?” stayed after Reset");
    },
  },
  {
    name: "tips-once",
    spec: "FR-014, US5/AC2–AC3",
    timeout: 360000,
    async run(ctx) {
      await ctx.eval(watchTips);
      await ctx.click("#help-words");
      const state = { escTried: false };
      await ctx.selectOpponent("random");
      const seen = () => ctx.eval(() => window.__tips.map((t) => t.copy));
      const needed = ["tips.new-box", "tips.first-win", "tips.first-draw", "tips.first-loss", "tips.turned-box"];
      for (let game = 0; game < 50; game++) {
        if (game > 0) await ctx.click("#new-game-btn");
        for (let guard = 0; guard < 500; guard++) {
          await closeTips(ctx, state);
          if (await ctx.eval(() => document.querySelector("#board").dataset.state === "over")) break;
          await ctx.sleep(40);
        }
        await closeTips(ctx, state);
        const shown = await seen();
        if (needed.every((k) => shown.includes(k)) && game >= 3) break;
      }

      // An empty box makes MENACE give up: twice, but one tip.
      const empty = path.join(ctx.fixturesDir, "valid/empty-opening.json");
      for (let k = 0; k < 2; k++) {
        await loadFile(ctx, empty);
        await ctx.waitFor(() => document.querySelector("#board").dataset.state === "over", { timeout: 5000 });
        await ctx.sleep(100);
        await closeTips(ctx, state);
      }

      const tips = await ctx.eval(() => window.__tips);
      const counts = Object.fromEntries(TIP_EVENTS.map((e) => [e, tips.filter((t) => t.copy === `tips.${e}`).length]));
      for (const e of TIP_EVENTS) ctx.assert(counts[e] === 1, `Tip "${e}" appeared ${counts[e]} times: ${JSON.stringify(counts)}`);
      ctx.assert(tips.every((t) => !t.focused), "A tip took keyboard focus by itself");
      ctx.assert(state.escTried, "No tip was closed with Esc");
    },
  },
  {
    name: "simple-words-text",
    spec: "FR-013, SC-006",
    timeout: 180000,
    async run(ctx) {
      await ctx.eval(() => {
        window.__shown = [];
        const watch = (el, where) => new MutationObserver(() => {
          window.__shown.push({ where, text: el.textContent.replace(/\s+/g, " ").trim(), copy: el.dataset.copy || null });
        }).observe(el, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["data-copy"] });
        watch(document.querySelector("#status-line"), "status line");
        watch(document.querySelector("#step-caption"), "step caption");
      });
      await ctx.click("#help-words");
      await ctx.click("#help-steps");
      await ctx.click('#help-pacing [data-pacing="manual"]');
      await ctx.selectOpponent("random");
      for (let guard = 0; guard < 3000; guard++) {
        const busy = await ctx.eval(() => !document.querySelector("#step-area").hidden);
        if (busy) {
          await ctx.click("#step-next");
          await ctx.sleep(30);
          continue;
        }
        if (await ctx.eval(() => document.querySelector("#board").dataset.state === "over")) break;
        await ctx.sleep(30);
      }
      await ctx.train(20);
      await ctx.click('[data-opponent="human"]');
      await ctx.sleep(1500);
      const records = await ctx.eval(() => window.__shown);
      ctx.assert(records.length >= 10, `Only ${records.length} texts were shown`);
      const problems = await ctx.eval(checkShownText, records);
      ctx.assert(problems.length === 0, [...new Set(problems)].slice(0, 12).join("\n"));
    },
  },
  {
    name: "story",
    spec: "FR-015, US5/AC4",
    async run(ctx) {
      const before = await ctx.eval(() => {
        const btn = document.querySelector("#story-toggle");
        return btn ? { expanded: btn.getAttribute("aria-expanded"), hidden: document.querySelector("#story-body").hidden } : null;
      });
      ctx.assert(before, "No picture-story disclosure button");
      ctx.assert(before.expanded === "false" && before.hidden, "The story is not collapsed at first");
      await ctx.click("#story-toggle");
      const r = await ctx.eval(() => {
        const heading = document.querySelector("#story-title");
        const section = heading ? heading.closest("section") : null;
        const next = section ? section.nextElementSibling : null;
        return {
          expanded: document.querySelector("#story-toggle").getAttribute("aria-expanded"),
          title: heading ? heading.textContent.replace(/\s+/g, " ").trim() : "",
          beforeHowItWorks: Boolean(next && next.classList.contains("how-it-works")),
          panels: [...document.querySelectorAll("#story-body li")].map((li) => ({
            img: li.querySelector('svg[role="img"]')?.getAttribute("aria-label") || null,
            sentences: li.querySelectorAll("p").length,
            text: li.textContent.replace(/\s+/g, " ").trim(),
          })),
        };
      });
      ctx.assert(r.expanded === "true", "The disclosure button did not expand");
      ctx.assert(/How MENACE learns/.test(r.title), `Story heading: "${r.title}"`);
      ctx.assert(r.beforeHowItWorks, "The story is not placed just before “How MENACE works”");
      ctx.assert(r.panels.length >= 1 && r.panels.length <= 6, `${r.panels.length} panels`);
      r.panels.forEach((p, i) => {
        ctx.assert(p.img && p.img.length > 10, `Panel ${i + 1} has no labelled picture`);
        ctx.assert(p.sentences >= 1 && p.sentences <= 2, `Panel ${i + 1} has ${p.sentences} sentences`);
      });
    },
  },
];
