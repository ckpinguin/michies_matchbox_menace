// The drawer view (US7; FR-028–FR-033; SC-011; quickstart §3).

function readDrawer() {
  const items = [...document.querySelectorAll("#drawer-list > li")].map((li) => {
    const title = li.querySelector(".drawer-box-title").textContent.trim();
    const m = /^Box #(\d+) · (\d)(?:st|rd|th) move · (\d+) beads?$/.exec(title);
    return {
      title,
      box: m ? Number(m[1]) : null,
      move: m ? Number(m[2]) : null,
      beads: m ? Number(m[3]) : null,
      used: li.textContent.includes("Used last game"),
      empty: li.textContent.includes("Empty: MENACE resigns here"),
      hasMiniBoard: Boolean(li.querySelector('[aria-hidden="true"] .mini-cell')),
      srText: li.querySelector(".sr-only")?.textContent.trim() || "",
      code: li.querySelector(".code")?.textContent.trim() || "",
    };
  });
  const toggle = document.querySelector("#drawer-toggle");
  return {
    expanded: toggle.getAttribute("aria-expanded"),
    toggleText: toggle.textContent.trim(),
    bodyHidden: document.querySelector("#drawer-body").hidden,
    count: document.querySelector("#drawer-count").textContent.trim(),
    message: (() => {
      const el = document.querySelector("#drawer-message");
      return el && !el.hidden ? el.textContent.trim() : "";
    })(),
    items,
    statBoxes: Number(document.querySelector('[data-stat="boxes"] .value').textContent.split("/")[0].trim()),
    panelBoxes: [...document.querySelectorAll("#box-panel .box-id > span:first-child")].map((s) => Number(s.textContent.replace(/[^0-9]/g, ""))),
    live: document.querySelector("#live-status").textContent.trim(),
  };
}

function setFilter(move, emptyOnly, sort) {
  const radio = document.querySelector(`input[name="drawer-move"][value="${move}"]`);
  radio.checked = true;
  radio.dispatchEvent(new Event("change", { bubbles: true }));
  const check = document.querySelector("#drawer-empty");
  if (check.checked !== emptyOnly) {
    check.checked = emptyOnly;
    check.dispatchEvent(new Event("change", { bubbles: true }));
  }
  const select = document.querySelector("#drawer-sort");
  if (select.value !== sort) {
    select.value = sort;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

const COUNT = /^Showing (\d+) of (\d+) discovered boxes$/;

export default [
  {
    name: "drawer",
    spec: "FR-028–FR-033",
    timeout: 120000,
    async run(ctx) {
      // Collapsed by default; empty state before any game has finished.
      let d = await ctx.eval(readDrawer);
      ctx.assert(d.expanded === "false" && d.bodyHidden, "The drawer should start collapsed");
      ctx.assert(/^Open the drawer · 0 boxes$/.test(d.toggleText), `Toggle: ${d.toggleText}`);
      await ctx.click("#drawer-toggle");
      d = await ctx.eval(readDrawer);
      ctx.assert(d.expanded === "true" && !d.bodyHidden, "The drawer did not open");
      ctx.assert(/opens a box the first time it meets a position/.test(d.message), `Empty state: ${d.message}`);

      // Train with the drawer open: it updates as games finish.
      await ctx.selectOpponent("random");
      await ctx.train(500);
      d = await ctx.eval(readDrawer);
      let m = COUNT.exec(d.count);
      ctx.assert(m, `Count line: ${d.count}`);
      ctx.assert(Number(m[2]) === d.statBoxes && Number(m[1]) === d.statBoxes, `Count ${d.count} vs ${d.statBoxes} discovered`);
      ctx.assert(d.items.length === d.statBoxes, `${d.items.length} cards for ${d.statBoxes} boxes`);
      ctx.assert(d.items.every((i) => i.box !== null && i.hasMiniBoard && /^[◯✕·]{9}$/.test(i.code)), "Malformed card");
      ctx.assert(d.items.every((i) => /Beads:/.test(i.srText)), "Cards need a spoken bead list");
      ctx.assert(d.items.every((it, k) => k === 0 || it.box > d.items[k - 1].box), "Default order is not discovery order");

      // "Used last game" marks the boxes shown in the box panel.
      const used = d.items.filter((i) => i.used).map((i) => i.box).sort((a, b) => a - b);
      const panel = [...new Set(d.panelBoxes)].sort((a, b) => a - b);
      ctx.assert(used.join() === panel.join(), `Used last game: ${used.join()} but the panel shows ${panel.join()}`);

      // 7th move, most beads first.
      await ctx.eval(setFilter, "7", false, "most");
      d = await ctx.eval(readDrawer);
      m = COUNT.exec(d.count);
      ctx.assert(m && Number(m[1]) === d.items.length, `Count ${d.count} vs ${d.items.length} cards`);
      ctx.assert(d.items.length > 0 && d.items.every((i) => i.move === 7), "The 7th-move filter shows other moves");
      ctx.assert(d.items.every((it, k) => k === 0 || it.beads <= d.items[k - 1].beads), "Not sorted by most beads");
      ctx.assert(COUNT.test(d.live), `The count was not announced after the filter change: ${d.live}`);

      // ...and only empty ones.
      await ctx.eval(setFilter, "7", true, "most");
      d = await ctx.eval(readDrawer);
      m = COUNT.exec(d.count);
      ctx.assert(m && Number(m[1]) === d.items.length, `Count ${d.count} vs ${d.items.length} cards`);
      ctx.assert(d.items.every((i) => i.move === 7 && i.beads === 0 && i.empty), "Non-empty or non-7th boxes shown");

      // Fewest beads first.
      await ctx.eval(setFilter, "all", false, "fewest");
      d = await ctx.eval(readDrawer);
      ctx.assert(d.items.every((it, k) => k === 0 || it.beads >= d.items[k - 1].beads), "Not sorted by fewest beads");

      // A filter that matches nothing says so.
      await ctx.eval(setFilter, "1", true, "discovery");
      d = await ctx.eval(readDrawer);
      ctx.assert(d.items.length === 0, "The opening box should not be empty after training against the Random mover");
      ctx.assert(/No boxes match these filters/.test(d.message), `No-match message: ${d.message}`);
      ctx.assert(/opens a box the first time it meets a position/.test(d.message), `The no-match message does not explain how boxes are discovered (FR-033): ${d.message}`);
    },
  },
];
