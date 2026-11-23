// Accessibility checks (US3; FR-010–FR-016, FR-041; SC-002, SC-003, SC-007; quickstart §3).

// ---------- Contrast audit (runs in the page) ----------

function auditContrast(rootSelector) {
  const parse = (value) => {
    let m = /^rgba?\(([^)]+)\)$/.exec(value);
    if (m) {
      const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
    }
    m = /^color\(srgb\s+([^)]+)\)$/.exec(value);
    if (m) {
      const p = m[1].split(/[\s/]+/).filter(Boolean).map(Number);
      return { r: p[0] * 255, g: p[1] * 255, b: p[2] * 255, a: p.length > 3 ? p[3] : 1 };
    }
    return null;
  };
  // Source-over compositing onto an opaque backdrop.
  const over = (top, bottom) => {
    if (!top || top.a === 0) return bottom;
    const a = top.a;
    return { r: top.r * a + bottom.r * (1 - a), g: top.g * a + bottom.g * (1 - a), b: top.b * a + bottom.b * (1 - a), a: 1 };
  };
  const mix = (inner, backdrop, opacity) => ({
    r: inner.r * opacity + backdrop.r * (1 - opacity),
    g: inner.g * opacity + backdrop.g * (1 - opacity),
    b: inner.b * opacity + backdrop.b * (1 - opacity),
    a: 1,
  });
  const luminance = (c) => {
    const ch = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b);
  };
  const ratio = (a, b) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  const hex = (c) => "#" + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

  function colours(el, textValue) {
    const chain = [];
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) chain.unshift(n);
    const styles = chain.map((n) => getComputedStyle(n));
    // Opacity groups: the colour inside the group is mixed with the backdrop outside it.
    let backdrop = { r: 255, g: 255, b: 255, a: 1 };
    let start = 0;
    let opacity = 1;
    const firstGroup = styles.findIndex((s) => parseFloat(s.opacity) < 1);
    if (firstGroup >= 0) {
      for (let k = 0; k < firstGroup; k++) backdrop = over(parse(styles[k].backgroundColor), backdrop);
      start = firstGroup;
      for (let k = firstGroup; k < styles.length; k++) opacity *= parseFloat(styles[k].opacity);
    }
    let bg = backdrop;
    for (let k = start; k < styles.length; k++) bg = over(parse(styles[k].backgroundColor), bg);
    // SVG text drawn on an SVG shape (feature 002's matchbox): the shape, not an HTML ancestor,
    // is the background. The page names the shape's colour token in data-contrast-bg.
    const svgBg = el instanceof SVGElement ? el.closest("[data-contrast-bg]") : null;
    if (svgBg) {
      const probe = document.createElement("span");
      probe.style.backgroundColor = `var(${svgBg.dataset.contrastBg})`;
      document.body.appendChild(probe);
      bg = over(parse(getComputedStyle(probe).backgroundColor), bg);
      probe.remove();
    }
    let fg = over(parse(textValue), bg);
    if (opacity < 1) {
      bg = mix(bg, backdrop, opacity);
      fg = mix(fg, backdrop, opacity);
    }
    return { fg, bg, opacity };
  }

  const failures = [];
  let audited = 0;
  const all = (rootSelector ? document.querySelector(rootSelector) : document.body).querySelectorAll("*");
  for (const el of all) {
    if (el.closest("select option, script, style, title")) continue;
    const isSvgText = el instanceof SVGTextElement;
    const hasText = isSvgText
      ? el.textContent.trim() !== ""
      : [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim() !== "");
    if (!hasText) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 1 || rect.height <= 1) continue; // not rendered, or visually hidden (sr-only)
    const style = getComputedStyle(el);
    if (style.visibility !== "visible") continue;
    const { fg, bg, opacity } = colours(el, isSvgText ? style.fill : style.color);
    if (opacity === 0) continue;
    audited++;
    const size = parseFloat(style.fontSize);
    const bold = Number(style.fontWeight) >= 700;
    const large = size >= 24 || (bold && size >= 18.66);
    const disabled = Boolean(el.closest(":disabled, [aria-disabled='true']"));
    const required = disabled ? 3 : large ? 3 : 4.5;
    const r = ratio(fg, bg);
    if (r < required) {
      const cls = typeof el.className === "string" ? el.className : el.getAttribute("class") || "";
      failures.push(
        `${el.tagName.toLowerCase()}${cls ? "." + cls.trim().split(/\s+/).join(".") : ""} ` +
          `"${el.textContent.trim().slice(0, 30)}" ${hex(fg)} on ${hex(bg)} = ${r.toFixed(2)} (needs ${required})`,
      );
    }
  }
  return { audited, failures };
}

async function openOptionalViews(ctx) {
  await ctx.eval(() => {
    const table = document.querySelector("#table-toggle-btn");
    if (table && table.getAttribute("aria-expanded") !== "true") table.click();
    const drawer = document.querySelector("#drawer-toggle");
    if (drawer && drawer.getAttribute("aria-expanded") !== "true") drawer.click();
  });
  await ctx.sleep(150);
}

function contrastCheck(scheme) {
  return {
    name: `contrast-${scheme}`,
    spec: "FR-010, SC-002",
    timeout: 90000,
    async before(ctx) {
      await ctx.page.emulate({ width: 1280, height: 900, colorScheme: scheme });
    },
    async run(ctx) {
      await ctx.selectOpponent("random");
      await ctx.train(100);
      await openOptionalViews(ctx);
      const { audited, failures } = await ctx.eval(auditContrast);
      ctx.assert(audited > 50, `Only ${audited} text elements were audited`);
      ctx.assert(failures.length === 0, `${failures.length} of ${audited} text elements fail:\n${[...new Set(failures)].slice(0, 25).join("\n")}`);
    },
  };
}

// ---------- The new controls, dialog and drawer (FR-041) ----------

function dialogContrastCheck(scheme) {
  return {
    name: `contrast-dialog-${scheme}`,
    spec: "FR-041",
    timeout: 60000,
    async before(ctx) {
      await ctx.page.emulate({ width: 1280, height: 900, colorScheme: scheme });
    },
    async run(ctx) {
      await ctx.selectOpponent("random");
      await ctx.train(20);
      await ctx.click('[data-rule="perSquare"]');
      await ctx.waitFor(() => document.querySelector("#confirm-dialog").open);
      const { audited, failures } = await ctx.eval(auditContrast, "#confirm-dialog");
      ctx.assert(audited >= 5, `Only ${audited} text elements in the dialog were audited`);
      ctx.assert(failures.length === 0, `Dialog text fails contrast:\n${failures.join("\n")}`);
    },
  };
}

async function focusAndPress(ctx, selector, key) {
  await ctx.eval((sel) => document.querySelector(sel).focus(), selector);
  await ctx.page.press(key);
}

// ---------- Keyboard ----------

function readBoard() {
  const board = document.querySelector("#board");
  const squares = [...board.querySelectorAll("button[data-idx]")];
  const active = document.activeElement;
  return {
    state: board.dataset.state,
    turn: board.dataset.turn || "",
    marks: squares.map((s) => s.dataset.mark || ""),
    focused: squares.indexOf(active),
  };
}

// ---------- Feature 002: the same audits with both helps on (FR-017, FR-019, SC-007) ----------

// Both helps on, a tip open, "What changed?" shown, the story open, and MENACE's steps
// paused at step 4 ("One step at a time").
async function openHelpsState(ctx) {
  await ctx.click("#help-words");
  await ctx.click("#help-steps");
  await ctx.click('#help-pacing [data-pacing="manual"]');
  await ctx.selectOpponent("random"); // MENACE's first move opens a new box: its tip appears
  await ctx.waitFor(() => document.querySelector("#tip-slot .tip"), { message: "No tip appeared" });
  await ctx.train(20);
  await ctx.click("#new-game-btn");
  for (const step of ["find", "shake", "tilt"]) {
    await ctx.waitFor((s) => document.querySelector("#step-area").dataset.step === s, { message: `No "${step}" step` }, step);
    await ctx.click("#step-next");
  }
  await ctx.waitFor(() => document.querySelector("#step-area").dataset.step === "lookup");
  await ctx.click("#story-toggle");
  await ctx.sleep(1500); // let a turning face finish
  const state = await ctx.eval(() => ({
    tip: Boolean(document.querySelector("#tip-slot .tip")),
    compare: !document.querySelector("#compare-section").hidden,
    story: !document.querySelector("#story-body").hidden,
    step: document.querySelector("#step-area").dataset.step,
  }));
  if (!(state.tip && state.compare && state.story && state.step === "lookup")) {
    throw new Error(`Could not set up the helps state: ${JSON.stringify(state)}`);
  }
}

function helpsContrastCheck(scheme) {
  return {
    name: `contrast-helps-${scheme}`,
    spec: "FR-019, SC-007",
    timeout: 120000,
    async before(ctx) {
      await ctx.page.emulate({ width: 1280, height: 900, colorScheme: scheme });
    },
    async run(ctx) {
      await openHelpsState(ctx);
      await openOptionalViews(ctx);
      const { audited, failures } = await ctx.eval(auditContrast);
      ctx.assert(audited > 80, `Only ${audited} text elements were audited`);
      ctx.assert(failures.length === 0, `${failures.length} of ${audited} text elements fail:\n${[...new Set(failures)].slice(0, 25).join("\n")}`);
    },
  };
}

export default [
  helpsContrastCheck("light"),
  helpsContrastCheck("dark"),
  {
    name: "keyboard-helps",
    spec: "FR-017, SC-007",
    timeout: 120000,
    async run(ctx) {
      const where = () => {
        const a = document.activeElement;
        if (!a) return "none";
        if (a.closest("#board")) return "board";
        if (a.closest(".tip")) return "tip";
        return a.id || a.tagName.toLowerCase();
      };
      await ctx.click("#help-words");
      await ctx.click("#help-steps");
      await ctx.click('#help-pacing [data-pacing="manual"]');
      await ctx.click("#new-game-btn"); // "Play it yourself": MENACE opens, with its steps
      await ctx.waitFor(() => document.querySelector("#step-area").dataset.step === "find" && document.querySelector("#tip-slot .tip"));

      // From the board, Tab reaches the tip's button and then Next; nothing took focus by itself.
      await ctx.eval(() => document.querySelector('#board button[tabindex="0"]').focus());
      await ctx.page.press("Tab");
      ctx.assert(await ctx.eval(where) === "tip", `Tab from the board reached ${await ctx.eval(where)}, not the tip`);
      await ctx.page.press("Tab");
      ctx.assert(await ctx.eval(where) === "step-next", `The next Tab reached ${await ctx.eval(where)}, not Next`);

      // Enter steps through the move; focus stays on Next, then returns to the board.
      for (let k = 0; k < 4; k++) await ctx.page.press("Enter");
      const at = await ctx.eval(() => ({ step: document.querySelector("#step-area").dataset.step, focus: document.activeElement.id }));
      ctx.assert(at.step === "play" && at.focus === "step-next", `After 4 × Enter: step ${at.step}, focus on ${at.focus}`);
      await ctx.page.press("Enter");
      await ctx.waitFor(() => document.querySelector("#board").dataset.turn === "human");
      ctx.assert(await ctx.eval(where) === "board", `When the steps ended, focus went to ${await ctx.eval(where)}`);

      // Play a square by keyboard; MENACE's next steps do not pull focus off the board.
      const target = await ctx.eval(() => [...document.querySelectorAll("#board button[data-idx]")].findIndex((b) => !b.dataset.mark));
      await ctx.eval((i) => document.querySelector(`#board button[data-idx="${i}"]`).focus(), target);
      await ctx.page.press("Enter");
      await ctx.waitFor(() => !document.querySelector("#step-area").hidden, { message: "MENACE's reply showed no steps" });
      ctx.assert(await ctx.eval(where) === "board", `MENACE's steps moved focus to ${await ctx.eval(where)}`);

      // The Helps buttons work from the keyboard.
      await ctx.eval(() => document.querySelector("#help-words").focus());
      await ctx.page.press(" ");
      ctx.assert(await ctx.eval(() => document.querySelector("#help-words").getAttribute("aria-pressed")) === "false",
        "Space did not turn Simple words off");
    },
  },
  {
    name: "narrow-320-helps",
    spec: "FR-019, SC-007",
    timeout: 120000,
    async before(ctx) {
      await ctx.page.emulate({ width: 320, height: 740, mobile: true });
    },
    async run(ctx) {
      await openHelpsState(ctx);
      await openOptionalViews(ctx);
      await ctx.sleep(200);
      const info = await ctx.eval(() => {
        const root = document.documentElement;
        const wide = [...document.body.querySelectorAll("*")]
          .filter((el) => el.getBoundingClientRect().right > root.clientWidth + 0.5 && !el.closest(".sr-only"))
          .slice(0, 5)
          .map((el) => el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + "." + String(el.getAttribute("class") || "").split(" ")[0]);
        return { scrollWidth: root.scrollWidth, clientWidth: root.clientWidth, wide };
      });
      ctx.assert(info.scrollWidth <= info.clientWidth,
        `The page scrolls sideways at 320 px with the helps on (${info.scrollWidth} > ${info.clientWidth}); too wide: ${info.wide.join(", ")}`);
    },
  },
  contrastCheck("light"),
  contrastCheck("dark"),
  dialogContrastCheck("light"),
  dialogContrastCheck("dark"),
  {
    name: "keyboard-controls",
    spec: "FR-041",
    timeout: 60000,
    async run(ctx) {
      const read = () => ({
        rule: document.querySelector('#rule-select [aria-pressed="true"]').dataset.rule,
        dialog: document.querySelector("#confirm-dialog").open,
        active: document.activeElement?.dataset?.action || document.activeElement?.dataset?.rule || document.activeElement?.id || "",
        drawer: document.querySelector("#drawer-toggle").getAttribute("aria-expanded"),
        move: document.querySelector('input[name="drawer-move"]:checked').value,
        empty: document.querySelector("#drawer-empty").checked,
        count: document.querySelector("#drawer-count").textContent,
      });
      // Bead rule on a fresh MENACE: Enter switches at once.
      await focusAndPress(ctx, '[data-rule="perSquare"]', "Enter");
      let s = await ctx.eval(read);
      ctx.assert(s.rule === "perSquare" && !s.dialog, "Enter on a rule button did not switch a fresh MENACE");

      // Trained: Enter opens the dialog with focus on Cancel; Tab reaches "Switch"; Enter confirms.
      await ctx.selectOpponent("random");
      await ctx.train(20);
      await focusAndPress(ctx, '[data-rule="michie1963"]', "Enter");
      s = await ctx.eval(read);
      ctx.assert(s.dialog && s.active === "cancel", `Dialog open: ${s.dialog}, focus on ${s.active}`);
      await ctx.page.press("Tab");
      s = await ctx.eval(read);
      ctx.assert(s.active === "switch", `Tab from Cancel reached ${s.active}`);
      await ctx.page.press("Enter");
      s = await ctx.eval(read);
      ctx.assert(!s.dialog && s.rule === "michie1963", "Enter on Switch did not switch the rule");
      ctx.assert(s.active === "michie1963", `Focus returned to ${s.active}, not the rule button`);

      // Drawer: open with Enter, change the move filter with arrow keys, toggle "Only empty" with Space.
      await ctx.train(20);
      await focusAndPress(ctx, "#drawer-toggle", "Enter");
      s = await ctx.eval(read);
      ctx.assert(s.drawer === "true", "Enter did not open the drawer");
      await focusAndPress(ctx, 'input[name="drawer-move"][value="all"]', "ArrowRight");
      s = await ctx.eval(read);
      ctx.assert(s.move === "1" && /^Showing 1 of /.test(s.count), `Arrow key filter: move ${s.move}, ${s.count}`);
      await focusAndPress(ctx, "#drawer-empty", " ");
      s = await ctx.eval(read);
      ctx.assert(s.empty, "Space did not tick Only empty boxes");

      // Save and Load are reachable buttons.
      const buttons = await ctx.eval(() => ["#save-btn", "#load-btn"].map((sel) => {
        const el = document.querySelector(sel);
        return el.tagName === "BUTTON" && el.tabIndex === 0 && !el.disabled;
      }));
      ctx.assert(buttons.every(Boolean), "Save or Load is not a focusable button");
    },
  },
  {
    name: "narrow-320-dialog",
    spec: "FR-041, SC-007",
    async before(ctx) {
      await ctx.page.emulate({ width: 320, height: 740, mobile: true });
    },
    async run(ctx) {
      await ctx.selectOpponent("random");
      await ctx.train(20);
      await ctx.click('[data-rule="perSquare"]');
      const info = await ctx.eval(() => {
        const r = document.querySelector("#confirm-dialog").getBoundingClientRect();
        const root = document.documentElement;
        return { left: r.left, right: r.right, width: root.clientWidth, scroll: root.scrollWidth };
      });
      ctx.assert(info.left >= 0 && info.right <= info.width, `The dialog spills out of the screen: ${info.left}–${info.right} of ${info.width}`);
      ctx.assert(info.scroll <= info.width, `The page scrolls sideways with the dialog open (${info.scroll} > ${info.width})`);
    },
  },
  {
    name: "keyboard",
    spec: "FR-011, SC-003",
    async run(ctx) {
      // Human game: MENACE opens, then it's the visitor's turn.
      await ctx.waitFor(() => document.querySelector("#board").dataset.turn === "human", {
        message: "The board never became playable",
      });
      await ctx.eval(() => document.querySelector('#board button[tabindex="0"]').focus());
      let moves = 0;
      for (let guard = 0; guard < 6; guard++) {
        const before = await ctx.eval(readBoard);
        if (before.state === "over") break;
        ctx.assert(before.focused >= 0, `Focus left the board before move ${moves + 1}`);
        const target = before.marks.findIndex((m) => m === "");
        const [fr, fc] = [Math.floor(before.focused / 3), before.focused % 3];
        const [tr, tc] = [Math.floor(target / 3), target % 3];
        for (let i = 0; i < Math.abs(tc - fc); i++) await ctx.page.press(tc > fc ? "ArrowRight" : "ArrowLeft");
        for (let i = 0; i < Math.abs(tr - fr); i++) await ctx.page.press(tr > fr ? "ArrowDown" : "ArrowUp");
        const moved = await ctx.eval(readBoard);
        ctx.assert(moved.focused === target, `Arrow keys reached square ${moved.focused + 1}, expected ${target + 1}`);
        await ctx.page.press("Enter");
        moves++;
        const after = await ctx.eval(readBoard);
        ctx.assert(after.marks[target] === "O", `Enter did not play board square ${target + 1}`);
        ctx.assert(after.focused >= 0, `Focus left the board after move ${moves}`);
        await ctx.waitFor(() => {
          const b = document.querySelector("#board");
          return b.dataset.turn === "human" || b.dataset.state === "over";
        });
        const settled = await ctx.eval(readBoard);
        ctx.assert(settled.focused >= 0, `Focus left the board after MENACE's reply to move ${moves}`);
      }
      ctx.assert(moves >= 2, `Only ${moves} move(s) were played by keyboard`);
      // Home and End jump to squares 1 and 9.
      await ctx.page.press("End");
      ctx.assert((await ctx.eval(readBoard)).focused === 8, "End did not move focus to board square 9");
      await ctx.page.press("Home");
      ctx.assert((await ctx.eval(readBoard)).focused === 0, "Home did not move focus to board square 1");
    },
  },
  {
    name: "labels",
    spec: "FR-012, FR-013",
    async run(ctx) {
      await ctx.selectOpponent("random");
      await ctx.waitGameOver();
      const info = await ctx.eval(() => {
        const squares = [...document.querySelectorAll("#board button[data-idx]")];
        const group = document.querySelector("#opponent-select");
        const labelId = group.getAttribute("aria-labelledby");
        return {
          labels: squares.map((s) => ({ mark: s.dataset.mark || "", label: s.getAttribute("aria-label") || "" })),
          groupLabel: labelId ? document.getElementById(labelId)?.textContent.trim() : null,
          role: document.querySelector("#board").getAttribute("role"),
        };
      });
      ctx.assert(info.role === "grid", `The board's role is ${info.role}, expected grid`);
      ctx.assert(info.groupLabel === "Opponent", `The opponent group is labelled ${JSON.stringify(info.groupLabel)}`);
      const crosses = info.labels.filter((l) => l.mark === "O");
      ctx.assert(crosses.length > 0, "No opponent marks on the board");
      for (const { mark, label } of info.labels) {
        ctx.assert(/^Board square [1-9], /.test(label), `Unqualified square label: ${label}`);
        ctx.assert(!/\byour?\b/i.test(label), `Label mentions "you" against the Random mover: ${label}`);
        if (mark === "O") ctx.assert(label.includes("Random mover's cross"), `Wrong label: ${label}`);
        if (mark === "X") ctx.assert(label.includes("MENACE's nought"), `Wrong label: ${label}`);
        if (mark === "") ctx.assert(/, empty/.test(label), `Wrong label: ${label}`);
      }
    },
  },
  {
    name: "narrow-320",
    spec: "FR-015, SC-007",
    async before(ctx) {
      await ctx.page.emulate({ width: 320, height: 740, mobile: true });
    },
    async run(ctx) {
      await ctx.selectOpponent("random");
      await ctx.train(20);
      await ctx.train(20); // 40 games in all
      await openOptionalViews(ctx);
      await ctx.sleep(200); // the chart redraws at its new width on the next frame
      const info = await ctx.eval(() => {
        const root = document.documentElement;
        const texts = [...document.querySelectorAll("#chart-root svg text")].map((t) => {
          const svg = t.ownerSVGElement;
          const shown = svg.getBoundingClientRect().width;
          const viewBox = svg.viewBox && svg.viewBox.baseVal && svg.viewBox.baseVal.width ? svg.viewBox.baseVal.width : shown;
          return { text: t.textContent, px: parseFloat(getComputedStyle(t).fontSize) * (shown / viewBox) };
        });
        const wide = [...document.body.querySelectorAll("*")]
          .filter((el) => el.getBoundingClientRect().right > root.clientWidth + 0.5 && !el.closest(".sr-only"))
          .slice(0, 5)
          .map((el) => el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + "." + String(el.className).split(" ")[0]);
        return { scrollWidth: root.scrollWidth, clientWidth: root.clientWidth, texts, wide };
      });
      ctx.assert(
        info.scrollWidth <= info.clientWidth,
        `The page scrolls sideways at 320 px (${info.scrollWidth} > ${info.clientWidth}); too wide: ${info.wide.join(", ")}`,
      );
      ctx.assert(info.texts.length > 0, "The learning curve has no labels");
      const small = info.texts.filter((t) => t.px < 10);
      ctx.assert(small.length === 0, `Chart labels under 10 px: ${small.map((t) => `${t.text} ${t.px.toFixed(1)}px`).join(", ")}`);
    },
  },
];
