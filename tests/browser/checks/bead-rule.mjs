import { readdir, rm } from "node:fs/promises";

// Bead-rule choice (US6; FR-021–FR-025; SC-008; quickstart §3).

function readRule() {
  const pressed = document.querySelector('#rule-select [aria-pressed="true"]');
  const dialog = document.querySelector("#confirm-dialog");
  const first = document.querySelector("#box-panel .box-entry");
  const chips = first ? first.querySelectorAll(".mini-board .bead-chip:not(.member):not(.empty-color)").length : null;
  return {
    pressed: pressed ? pressed.dataset.rule : null,
    tile: document.querySelector('[data-stat="rule"] .value')?.textContent.trim() || null,
    eyebrow: document.querySelector("#chart-eyebrow")?.textContent.trim() || null,
    games: Number(document.querySelector('[data-stat="games"] .value').textContent.replace(/[^0-9]/g, "")),
    dialogOpen: Boolean(dialog && dialog.open),
    dialogText: dialog ? dialog.textContent.replace(/\s+/g, " ").trim() : null,
    focusedRule: document.activeElement?.dataset?.rule || null,
    focusedAction: document.activeElement?.dataset?.action || null,
    firstBoxColours: chips,
    firstBoxEyebrow: first ? first.querySelector(".box-entry-eyebrow").textContent.trim() : null,
  };
}

export default [
  {
    name: "rule-switch",
    spec: "FR-021–FR-025, SC-008",
    timeout: 90000,
    async run(ctx) {
      // FR-022: Michie 1963 on first load; the opening box (shown after MENACE's first move) has 3 colours.
      let s = await ctx.eval(readRule);
      ctx.assert(s.pressed === "michie1963", `Initial rule: ${s.pressed}`);
      ctx.assert(s.tile === "Michie 1963", `Rule tile: ${s.tile}`);
      ctx.assert(s.firstBoxColours === 3, `The opening box shows ${s.firstBoxColours} colours under Michie 1963`);

      await ctx.selectOpponent("random");
      await ctx.train(20);
      s = await ctx.eval(readRule);
      ctx.assert(s.games === 20, `Expected 20 games, found ${s.games}`);
      ctx.assert(/Michie 1963 rule/.test(s.eyebrow), `Chart eyebrow: ${s.eyebrow}`);

      // Switch → dialog → Cancel: nothing changes.
      await ctx.click('[data-rule="perSquare"]');
      s = await ctx.eval(readRule);
      ctx.assert(s.dialogOpen, "No confirmation dialog for a trained MENACE");
      ctx.assert(/20 games of training will be lost unless you save first/.test(s.dialogText), `Dialog: ${s.dialogText}`);
      ctx.assert(s.focusedAction === "cancel", `Initial focus is on ${s.focusedAction}, expected Cancel`);
      await ctx.click('#confirm-dialog [data-action="cancel"]');
      s = await ctx.eval(readRule);
      ctx.assert(!s.dialogOpen, "Cancel did not close the dialog");
      ctx.assert(s.games === 20 && s.pressed === "michie1963" && s.tile === "Michie 1963", "Cancel changed the MENACE");
      ctx.assert(s.focusedRule === "perSquare", "Focus did not return to the rule button");

      // Esc also cancels.
      await ctx.click('[data-rule="perSquare"]');
      await ctx.page.press("Escape");
      s = await ctx.eval(readRule);
      ctx.assert(!s.dialogOpen && s.games === 20 && s.pressed === "michie1963", "Esc did not cancel the switch");

      // "Save MENACE…" in the dialog saves and keeps the dialog open (FR-024).
      const dir = await ctx.tmpDir("menace-rule-save-");
      try {
        await ctx.page.setDownloadDir(dir);
        await ctx.click('[data-rule="perSquare"]');
        await ctx.click('#confirm-dialog [data-action="save"]');
        let files = [];
        for (let i = 0; i < 50 && !files.length; i++) {
          files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
          if (!files.length) await ctx.sleep(100);
        }
        ctx.assert(files.length === 1, "Save MENACE… in the dialog did not download a file");
        s = await ctx.eval(readRule);
        ctx.assert(s.dialogOpen, "Saving closed the dialog");
        ctx.assert(/Saved MENACE: 20 games/.test(await ctx.status()), "No save message");
        await ctx.click('#confirm-dialog [data-action="cancel"]');
      } finally {
        await rm(dir, { recursive: true, force: true });
      }

      // Switch and confirm: a fresh MENACE under the new rule.
      await ctx.click('[data-rule="perSquare"]');
      await ctx.click('#confirm-dialog [data-action="switch"]');
      s = await ctx.eval(readRule);
      ctx.assert(!s.dialogOpen, "The dialog stayed open after confirming");
      ctx.assert(s.games === 0, `Expected a fresh MENACE, found ${s.games} games`);
      ctx.assert(s.pressed === "perSquare", `Pressed rule: ${s.pressed}`);
      ctx.assert(s.tile === "One per square", `Rule tile: ${s.tile}`);
      ctx.assert(/one per square rule/i.test(s.eyebrow), `Chart eyebrow: ${s.eyebrow}`);
      ctx.assert(/1st move/.test(s.firstBoxEyebrow) && s.firstBoxColours === 9, `The opening box shows ${s.firstBoxColours} colours under one per square`);

      // From a fresh MENACE the switch back needs no confirmation.
      await ctx.click('[data-rule="michie1963"]');
      s = await ctx.eval(readRule);
      ctx.assert(!s.dialogOpen && s.pressed === "michie1963", "A fresh MENACE should switch without a dialog");
    },
  },
];
