// Box panel checks (US2; FR-007–FR-009).

const NOTICE = /This box shows the board (.+?)\. The bead for box square ([1-9]) was played on board square ([1-9])\./;

// For every box whose drawn bead stands for several squares, the panel must name the board square
// MENACE played, whether or not the box is shown rotated (US6/AC4; edge case: symmetric positions).
function sharedColourEntries() {
  const nought = new Set(
    [...document.querySelectorAll("#board button[data-idx]")].filter((s) => s.dataset.mark === "X").map((s) => Number(s.dataset.idx) + 1),
  );
  return [...document.querySelectorAll("#box-panel .box-entry")]
    .map((entry) => {
      const drawn = entry.querySelector(".bead-ledger li.drawn");
      if (!drawn || !drawn.textContent.includes("(same as")) return null;
      const text = entry.textContent.replace(/\s+/g, " ");
      const named = /played on board square ([1-9])\./.exec(text);
      return {
        rotated: text.includes("This box shows the board"),
        drawnRow: drawn.textContent.replace(/\s+/g, " ").trim(),
        named: named ? Number(named[1]) : null,
        isMenaceSquare: named ? nought.has(Number(named[1])) : false,
      };
    })
    .filter(Boolean);
}

export default [
  {
    name: "shared-colour",
    spec: "US6/AC4, FR-023",
    timeout: 90000,
    async run(ctx) {
      await ctx.selectOpponent("random");
      let unrotated = 0;
      let checked = 0;
      for (let game = 0; game < 10 && unrotated === 0; game++) {
        if (game > 0) await ctx.click("#new-game-btn");
        await ctx.waitGameOver();
        for (const entry of await ctx.eval(sharedColourEntries)) {
          checked++;
          if (!entry.rotated) unrotated++;
          ctx.assert(entry.named !== null, `No board square is named for the shared-colour bead "${entry.drawnRow}"`);
          ctx.assert(entry.isMenaceSquare, `The panel names board square ${entry.named}, which MENACE did not play`);
        }
      }
      ctx.assert(unrotated > 0, `No unrotated box with a shared-colour bead came up in 10 games (${checked} rotated ones checked)`);
    },
  },
  {
    name: "orientation",
    spec: "FR-008, FR-009",
    timeout: 90000,
    async run(ctx) {
      await ctx.selectOpponent("random");
      let found = null;
      for (let game = 0; game < 8 && !found; game++) {
        if (game > 0) await ctx.click("#new-game-btn");
        await ctx.waitGameOver();
        found = await ctx.eval(() => {
          const note = [...document.querySelectorAll("#box-panel .orientation-note")].find((n) =>
            n.textContent.includes("This box shows the board"),
          );
          if (!note) return null;
          const squares = [...document.querySelectorAll("#board button[data-idx]")];
          return {
            text: note.textContent.replace(/\s+/g, " ").trim(),
            labels: squares.map((s) => s.getAttribute("aria-label")),
            names: [...window.MenaceEngine.TRANSFORM_NAMES],
            transforms: window.MenaceEngine.TRANSFORMS.map((T) => [...T]),
          };
        });
      }
      ctx.assert(found, "No rotated or mirrored box was shown in 8 games");
      const m = NOTICE.exec(found.text);
      ctx.assert(m, `Unexpected orientation notice: ${found.text}`);
      const [, name, boxSquare, boardSquare] = m;
      const t = found.names.indexOf(name);
      ctx.assert(t > 0, `The notice names an unknown transform: ${name}`);
      ctx.assert(
        found.transforms[t][Number(boxSquare) - 1] === Number(boardSquare) - 1,
        `Box square ${boxSquare} ${name} is not board square ${boardSquare}`,
      );
      const label = found.labels[Number(boardSquare) - 1];
      ctx.assert(label.includes("MENACE's nought"), `Board square ${boardSquare} does not hold MENACE's mark: ${label}`);
    },
  },
  {
    name: "glyphs",
    spec: "FR-007",
    async run(ctx) {
      await ctx.selectOpponent("random");
      await ctx.train(20);
      const info = await ctx.eval(() => ({
        codes: [...document.querySelectorAll(".code")].map((c) => c.textContent.trim()),
        legend: document.querySelector("#box-panel .box-legend")?.textContent.replace(/\s+/g, " ").trim() || null,
        ledger: [...document.querySelectorAll("#box-panel .bead-ledger .sq-label")].map((l) => l.textContent.trim()),
      }));
      ctx.assert(info.codes.length > 0, "No position codes are shown");
      const bad = info.codes.filter((c) => /[XO]/.test(c));
      ctx.assert(bad.length === 0, `Position codes still use X/O: ${bad.join(", ")}`);
      ctx.assert(info.codes.every((c) => /^[◯✕·]{9}$/.test(c)), `Unexpected codes: ${info.codes.join(", ")}`);
      ctx.assert(info.legend && /◯ MENACE/.test(info.legend) && /✕ opponent/.test(info.legend), `Missing legend: ${info.legend}`);
      ctx.assert(info.ledger.every((l) => /^box square [1-9]/.test(l)), `Unqualified ledger rows: ${info.ledger.join(" | ")}`);
    },
  },
];
