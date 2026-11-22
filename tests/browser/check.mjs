#!/usr/bin/env node
// Browser checks for the MENACE page (quickstart.md §3).
//
//   node tests/browser/check.mjs [--only=name,prefix,…] [--headed] [--screenshots=<dir>]
//
// Every module in tests/browser/checks/ default-exports an array of
// { name, spec, run(ctx), timeout?, seed? }. Each check gets a fresh tab on
// file://<repo>/index.html, with Math.random seeded from the check's name so that a failure
// can be reproduced. Network requests are recorded into ctx.requests. The script prints a
// pass/fail table and exits non-zero if any check fails.

import { mkdir, mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { launch } from "./cdp.mjs";
import { mulberry32, seedFrom } from "../helpers/rng.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");
const pageUrl = pathToFileURL(path.join(repoRoot, "index.html")).href;

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, "").split("=");
    return [key, rest.length ? rest.join("=") : true];
  }),
);
const only = typeof args.only === "string" ? args.only.split(",").map((s) => s.trim()).filter(Boolean) : null;
const headed = Boolean(args.headed);
const screenshotDir = typeof args.screenshots === "string" ? path.resolve(repoRoot, args.screenshots) : null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Page script that replaces Math.random with a seeded mulberry32, before the page runs. */
function seededRandomScript(seed) {
  return `(() => {
    let a = ${seed >>> 0};
    Math.random = function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  })();`;
}

class CheckFailure extends Error {}

function makeContext(page, check, seed) {
  const ctx = {
    page,
    check,
    seed,
    pageUrl,
    repoRoot,
    fixturesDir: path.join(repoRoot, "tests/fixtures/saves"),
    requests: [],
    errors: [],
    rng: mulberry32(seed ^ 0x9e3779b9),
    sleep,

    assert(condition, message) {
      if (!condition) throw new CheckFailure(message);
    },

    /** Runs fn(...args) in the page and returns its (awaited) JSON value. */
    eval(fn, ...fnArgs) {
      return page.evaluate(`(${fn.toString()})(...${JSON.stringify(fnArgs)})`, { awaitPromise: true });
    },

    /** Polls fn(...args) in the page until it returns a truthy value, and returns that value. */
    async waitFor(fn, { timeout = 15000, interval = 50, message } = {}, ...fnArgs) {
      const deadline = Date.now() + timeout;
      let last;
      while (Date.now() < deadline) {
        last = await ctx.eval(fn, ...fnArgs);
        if (last) return last;
        await sleep(interval);
      }
      throw new CheckFailure(message || `Timed out after ${timeout} ms waiting for: ${fn.toString().slice(0, 120)}`);
    },

    async click(selector) {
      const found = await ctx.eval((sel) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        el.click();
        return true;
      }, selector);
      ctx.assert(found, `No element matches ${selector}`);
    },

    text(selector) {
      return ctx.eval((sel) => document.querySelector(sel)?.textContent.trim() ?? null, selector);
    },

    status() {
      return ctx.text("#status-line");
    },

    async gamesPlayed() {
      const value = await ctx.eval(() => {
        const el = document.querySelector('[data-stat="games"] .value') || document.querySelector(".stat-tile .value");
        return el ? el.textContent.trim() : null;
      });
      ctx.assert(value !== null, "Could not find the games-played statistic");
      return Number(value.replace(/[^0-9]/g, ""));
    },

    selectOpponent(kind) {
      return ctx.click(`[data-opponent="${kind}"]`);
    },

    /** Clicks "Run n" and waits for the run to end. Returns the final status text. */
    async train(n, { timeout = 60000 } = {}) {
      await ctx.click(`[data-train="${n}"]`);
      await ctx.waitFor(
        () => {
          const card = document.querySelector("#controls");
          if (card && card.dataset.training) return card.dataset.training === "idle";
          return /Training (finished|stopped)/.test(document.querySelector("#status-line")?.textContent || "");
        },
        { timeout, message: `Training run of ${n} games did not finish within ${timeout} ms` },
      );
      return ctx.status();
    },

    /** Waits until the game on the board has finished (and been committed). */
    waitGameOver({ timeout = 20000 } = {}) {
      return ctx.waitFor(() => document.querySelector("#board")?.dataset.state === "over", {
        timeout,
        message: "The game did not finish in time",
      });
    },

    tmpDir(prefix = "menace-check-") {
      return mkdtemp(path.join(tmpdir(), prefix));
    },
  };
  return ctx;
}

async function loadChecks() {
  const dir = path.join(here, "checks");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".mjs")).sort();
  const all = [];
  for (const file of files) {
    const mod = await import(pathToFileURL(path.join(dir, file)).href);
    for (const check of mod.default || []) all.push({ ...check, file });
  }
  return all;
}

function selected(check) {
  if (!only) return true;
  return only.some((token) => check.name === token || check.name.startsWith(token));
}

function withTimeout(promise, ms, name) {
  let timer;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new CheckFailure(`${name} timed out after ${ms} ms`)), ms);
    }),
  ]);
}

async function runCheck(browser, check) {
  const seed = check.seed === false ? null : seedFrom(check.name);
  const page = await browser.newPage();
  const ctx = makeContext(page, check, seed ?? 1);
  page.on("Network.requestWillBeSent", (params) => ctx.requests.push(params.request.url));
  page.on("Runtime.exceptionThrown", (params) => {
    const details = params.exceptionDetails;
    ctx.errors.push(details.exception?.description || details.text);
  });
  if (seed !== null) await page.addInitScript(seededRandomScript(seed));
  const started = Date.now();
  try {
    if (check.before) await check.before(ctx);
    await page.open(pageUrl);
    await withTimeout(check.run(ctx), check.timeout ?? 120000, check.name);
    if (ctx.errors.length) {
      throw new CheckFailure(`The page threw ${ctx.errors.length} uncaught error(s):\n${ctx.errors.slice(0, 3).join("\n")}`);
    }
    return { ok: true, ms: Date.now() - started };
  } catch (error) {
    return {
      ok: false,
      ms: Date.now() - started,
      message: error instanceof CheckFailure ? error.message : error.stack || String(error),
    };
  } finally {
    await page.close();
  }
}

async function takeScreenshots(browser, dir) {
  await mkdir(dir, { recursive: true });
  const configs = [
    { width: 1280, height: 900, mobile: false },
    { width: 375, height: 800, mobile: true },
  ];
  const written = [];
  for (const config of configs) {
    for (const colorScheme of ["light", "dark"]) {
      const page = await browser.newPage();
      try {
        await page.addInitScript(seededRandomScript(seedFrom("screenshots")));
        await page.emulate({ ...config, colorScheme });
        await page.open(pageUrl);
        await sleep(1500); // let MENACE's animated opening move settle
        const file = path.join(dir, `${config.width}-${colorScheme}.png`);
        await page.screenshot(file);
        written.push(path.relative(repoRoot, file));
      } finally {
        await page.close();
      }
    }
  }
  return written;
}

function pad(text, width) {
  text = String(text);
  return text.length >= width ? text : text + " ".repeat(width - text.length);
}

async function main() {
  const checks = (await loadChecks()).filter(selected);
  if (only && checks.length === 0 && !screenshotDir) {
    console.error(`No checks match --only=${only.join(",")}`);
    process.exit(2);
  }

  const browser = await launch({ headed });
  const results = [];
  try {
    for (const check of checks) {
      process.stdout.write(`… ${check.name}\r`);
      const result = await runCheck(browser, check);
      results.push({ check, ...result });
      const mark = result.ok ? "PASS" : "FAIL";
      console.log(`${mark} ${check.name} (${(result.ms / 1000).toFixed(1)} s)`);
      if (!result.ok) console.log(`     ${result.message.split("\n").join("\n     ")}`);
    }
    if (screenshotDir) {
      const files = await takeScreenshots(browser, screenshotDir);
      console.log(`\nScreenshots written: ${files.join(", ")}`);
    }
  } finally {
    await browser.close();
  }

  if (results.length) {
    const nameWidth = Math.max(5, ...results.map((r) => r.check.name.length)) + 2;
    const specWidth = Math.max(4, ...results.map((r) => (r.check.spec || "").length)) + 2;
    console.log("\n" + pad("Check", nameWidth) + pad("Spec", specWidth) + "Result");
    console.log("-".repeat(nameWidth + specWidth + 6));
    for (const r of results) {
      console.log(pad(r.check.name, nameWidth) + pad(r.check.spec || "", specWidth) + (r.ok ? "PASS" : "FAIL"));
    }
    const failed = results.filter((r) => !r.ok).length;
    console.log(`\n${results.length - failed} passed, ${failed} failed`);
    process.exitCode = failed ? 1 : 0;
  }
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exit(1);
});
