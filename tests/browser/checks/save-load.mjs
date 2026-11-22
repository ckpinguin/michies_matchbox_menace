// Save and restore (US8; FR-034–FR-038; SC-009, SC-010; quickstart §3).

import { readdir, rm, stat } from "node:fs/promises";
import path from "node:path";

// Everything a restored MENACE must reproduce: record, rule, curve, table and drawer.
async function snapshot(ctx) {
  await ctx.eval(() => {
    const table = document.querySelector("#table-toggle-btn");
    if (table && table.getAttribute("aria-expanded") !== "true") table.click();
    const drawer = document.querySelector("#drawer-toggle");
    if (drawer.getAttribute("aria-expanded") !== "true") drawer.click();
  });
  return ctx.eval(() => ({
    stats: [...document.querySelectorAll("#stats-row .stat-tile")].map((t) => t.textContent.replace(/\s+/g, " ").trim()),
    rule: document.querySelector('#rule-select [aria-pressed="true"]').dataset.rule,
    eyebrow: document.querySelector("#chart-eyebrow").textContent.trim(),
    curve: document.querySelector("#chart-root svg")?.getAttribute("aria-label") || null,
    table: [...document.querySelectorAll("#chart-table-wrap tbody tr")].map((tr) => tr.textContent),
    drawer: [...document.querySelectorAll("#drawer-list > li")].map(
      (li) => li.querySelector(".drawer-box-title").textContent + " | " + li.querySelector(".sr-only").textContent,
    ),
  }));
}

function waitForDownload(dir, timeout = 10000) {
  const deadline = Date.now() + timeout;
  return (async () => {
    while (Date.now() < deadline) {
      const files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
      if (files.length) {
        const file = path.join(dir, files[0]);
        const { size } = await stat(file);
        if (size > 0) return file;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error("No file was downloaded");
  })();
}

function dialogState() {
  const dialog = document.querySelector("#confirm-dialog");
  return { open: dialog.open, text: dialog.textContent.replace(/\s+/g, " ").trim() };
}

export default [
  {
    name: "save-load",
    spec: "FR-034–FR-038, SC-009",
    timeout: 120000,
    async run(ctx) {
      const dir = await ctx.tmpDir("menace-save-");
      try {
        // Train a one-per-square MENACE for 200 games and save it.
        await ctx.click('[data-rule="perSquare"]'); // fresh, so no confirmation
        await ctx.selectOpponent("random");
        await ctx.train(100);
        await ctx.train(100);
        const before = await snapshot(ctx);
        ctx.assert(before.stats[0].includes("200"), `Expected 200 games: ${before.stats[0]}`);

        await ctx.page.setDownloadDir(dir);
        await ctx.click("#save-btn");
        const file = await waitForDownload(dir);
        const name = path.basename(file);
        ctx.assert(/^menace-perSquare-200-games-\d{4}-\d{2}-\d{2}\.json$/.test(name), `File name: ${name}`);
        const status = await ctx.status();
        ctx.assert(/Saved MENACE: 200 games/.test(status), `Status after saving: ${status}`);

        // A freshly opened page (Michie 1963 by default) with some training of its own.
        await ctx.page.reload();
        await ctx.selectOpponent("random");
        await ctx.train(20);
        await ctx.page.setFileInput("#load-input", file);
        await ctx.waitFor(() => document.querySelector("#confirm-dialog").open, { message: "No confirmation before replacing a trained MENACE" });
        const dialog = await ctx.eval(dialogState);
        ctx.assert(/20 games, Michie 1963/.test(dialog.text) && /200 games, one per square/.test(dialog.text), `Dialog: ${dialog.text}`);
        await ctx.click('#confirm-dialog [data-action="replace"]');
        await ctx.sleep(100);

        const loadedStatus = await ctx.status();
        ctx.assert(/Loaded MENACE: 200 games/.test(loadedStatus), `Status after loading: ${loadedStatus}`);
        ctx.assert(/bead rule is now one per square/i.test(loadedStatus), `The rule switch was not reported: ${loadedStatus}`);
        const after = await snapshot(ctx);
        for (const key of ["stats", "rule", "eyebrow", "curve", "table", "drawer"]) {
          ctx.assert(
            JSON.stringify(after[key]) === JSON.stringify(before[key]),
            `${key} differs after loading:\n  before ${JSON.stringify(before[key]).slice(0, 300)}\n  after  ${JSON.stringify(after[key]).slice(0, 300)}`,
          );
        }
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
  },
  {
    name: "load-reject",
    spec: "FR-037, SC-010",
    timeout: 90000,
    async run(ctx) {
      await ctx.selectOpponent("random");
      await ctx.train(20);
      const before = await snapshot(ctx);
      const dir = path.join(ctx.fixturesDir, "invalid");
      const files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
      ctx.assert(files.length >= 12, `Only ${files.length} invalid fixtures`);
      for (const file of files) {
        await ctx.eval(() => (document.querySelector("#status-line").textContent = ""));
        await ctx.page.setFileInput("#load-input", path.join(dir, file));
        const status = await ctx.waitFor(() => document.querySelector("#status-line").textContent.trim(), {
          message: `No message after loading ${file}`,
        });
        ctx.assert(/^Couldn’t load .+ Your MENACE hasn’t changed\.$/.test(status), `${file}: ${status}`);
        ctx.assert(!(await ctx.eval(dialogState)).open, `${file}: a rejected file opened the dialog`);
        const now = await snapshot(ctx);
        ctx.assert(JSON.stringify(now) === JSON.stringify(before), `${file}: the MENACE changed`);
      }
    },
  },
  {
    name: "opening-empty",
    spec: "FR-004, FR-006",
    async run(ctx) {
      // A fresh page: a load needs no confirmation.
      await ctx.page.setFileInput("#load-input", path.join(ctx.fixturesDir, "valid/empty-opening.json"));
      await ctx.waitFor(() => /can’t start a game/.test(document.querySelector("#status-line").textContent), {
        message: "No explanation that MENACE can't start a game",
      });
      const status = await ctx.status();
      ctx.assert(/Reset MENACE or load a saved MENACE/.test(status), `Status: ${status}`);
      await ctx.selectOpponent("random");
      const trainStatus = await ctx.train(100);
      ctx.assert(/can’t start a game/.test(trainStatus) && /Training stopped after 1 of 100 games/.test(trainStatus), `Status: ${trainStatus}`);
    },
  },
];
