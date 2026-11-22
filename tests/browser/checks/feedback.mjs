// Feedback checks (US4; FR-019, FR-020).

export default [
  {
    name: "win-line",
    spec: "FR-019",
    timeout: 120000,
    async run(ctx) {
      await ctx.selectOpponent("random");
      let result = null;
      for (let game = 0; game < 12 && !result; game++) {
        if (game > 0) await ctx.click("#new-game-btn");
        await ctx.waitGameOver();
        result = await ctx.eval(() => {
          const squares = [...document.querySelectorAll("#board button[data-idx]")];
          const win = squares.filter((s) => s.classList.contains("win"));
          const status = document.querySelector("#status-line").textContent.replace(/\s+/g, " ").trim();
          if (/draw|resign|can’t start/i.test(status)) return null; // no winning line this game
          return {
            status,
            win: win.map((s) => Number(s.dataset.idx) + 1),
            marks: win.map((s) => s.dataset.mark),
            labels: win.map((s) => s.getAttribute("aria-label")),
            others: squares.filter((s) => !s.classList.contains("win")).map((s) => s.getAttribute("aria-label")),
          };
        });
      }
      ctx.assert(result, "No game ended with a winning line in 12 games");
      ctx.assert(result.win.length === 3, `${result.win.length} squares are marked as the winning line`);
      ctx.assert(new Set(result.marks).size === 1 && result.marks[0], "The winning squares do not share one mark");
      const named = /on board squares ([1-9]), ([1-9]), ([1-9])/.exec(result.status);
      ctx.assert(named, `The result does not name the squares: ${result.status}`);
      ctx.assert(
        named.slice(1).map(Number).join() === result.win.join(),
        `The result names ${named.slice(1).join(", ")} but squares ${result.win.join(", ")} are highlighted`,
      );
      const winner = result.marks[0] === "X" ? /^MENACE wins/ : /^Random mover wins/;
      ctx.assert(winner.test(result.status), `The result does not name the winner: ${result.status}`);
      ctx.assert(result.labels.every((l) => l.endsWith(", winning line")), `Labels: ${result.labels.join(" | ")}`);
      ctx.assert(!result.others.some((l) => l.includes("winning line")), "A square outside the line is labelled as winning");
    },
  },
  {
    name: "table-persist",
    spec: "FR-020",
    timeout: 90000,
    async run(ctx) {
      await ctx.selectOpponent("random");
      await ctx.train(20);
      await ctx.click("#table-toggle-btn");
      const readTable = () => ({
        expanded: document.querySelector("#table-toggle-btn")?.getAttribute("aria-expanded"),
        hidden: document.querySelector("#chart-table-wrap")?.hidden,
        caption: document.querySelector("#chart-table-wrap caption")?.textContent.trim() || null,
        headers: [...document.querySelectorAll("#chart-table-wrap thead th")].map((th) => th.textContent.trim()),
        rows: [...document.querySelectorAll("#chart-table-wrap tbody tr")].map((tr) => tr.firstElementChild.textContent.trim()),
      });
      const before = await ctx.eval(readTable);
      ctx.assert(before.expanded === "true" && before.hidden === false, "The table did not open");
      ctx.assert(before.rows.at(-1) === "11–20", `Last row before: ${before.rows.at(-1)}`);
      ctx.assert(
        before.caption === "Rolling 20-game rates, as at the last game in each range",
        `Caption: ${before.caption}`,
      );
      ctx.assert(
        before.headers.join("|") === "Games|Win rate|Draw rate|Loss rate",
        `Headers: ${before.headers.join(", ")}`,
      );
      await ctx.click("#new-game-btn");
      await ctx.waitGameOver();
      const after = await ctx.eval(readTable);
      ctx.assert(after.expanded === "true" && after.hidden === false, "The table closed after a new game");
      ctx.assert(after.rows.at(-1) === "21–21", `The table did not update: last row ${after.rows.at(-1)}`);
    },
  },
];
