// A minimal Chrome DevTools Protocol client with no dependencies.
//
// It launches the installed Chrome (or $CHROME) with a throw-away profile, connects to it
// with Node's built-in WebSocket, and offers a few page helpers used by the browser checks.
// Only stable protocol domains are used: Target, Page, Runtime, Emulation, DOM, Network,
// Input and Browser.

import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const DEFAULT_CHROME = {
  darwin: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  linux: "google-chrome",
  win32: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class Connection {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 0;
    this.pending = new Map();
    this.listeners = new Map();
    ws.addEventListener("message", (event) => this.#onMessage(JSON.parse(event.data)));
    ws.addEventListener("close", () => {
      for (const { reject, method } of this.pending.values()) {
        reject(new Error(`CDP connection closed while waiting for ${method}`));
      }
      this.pending.clear();
    });
  }

  send(method, params = {}, sessionId = undefined) {
    const id = ++this.nextId;
    const message = { id, method, params };
    if (sessionId) message.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method });
      this.ws.send(JSON.stringify(message));
    });
  }

  on(method, fn, sessionId = "") {
    const key = `${sessionId}|${method}`;
    if (!this.listeners.has(key)) this.listeners.set(key, new Set());
    this.listeners.get(key).add(fn);
    return () => this.listeners.get(key)?.delete(fn);
  }

  #onMessage(message) {
    if (message.id !== undefined) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(`${pending.method}: ${message.error.message}`));
      else pending.resolve(message.result);
      return;
    }
    const key = `${message.sessionId || ""}|${message.method}`;
    for (const fn of this.listeners.get(key) || []) fn(message.params);
  }
}

const KEYS = {
  ArrowLeft: { code: "ArrowLeft", keyCode: 37 },
  ArrowUp: { code: "ArrowUp", keyCode: 38 },
  ArrowRight: { code: "ArrowRight", keyCode: 39 },
  ArrowDown: { code: "ArrowDown", keyCode: 40 },
  Home: { code: "Home", keyCode: 36 },
  End: { code: "End", keyCode: 35 },
  Enter: { code: "Enter", keyCode: 13, text: "\r" },
  " ": { code: "Space", keyCode: 32, text: " " },
  Escape: { code: "Escape", keyCode: 27 },
  Tab: { code: "Tab", keyCode: 9 },
};

export class Page {
  constructor(connection, sessionId, targetId) {
    this.connection = connection;
    this.sessionId = sessionId;
    this.targetId = targetId;
  }

  send(method, params = {}) {
    return this.connection.send(method, params, this.sessionId);
  }

  on(event, fn) {
    return this.connection.on(event, fn, this.sessionId);
  }

  once(event, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        off();
        reject(new Error(`Timed out after ${timeout} ms waiting for ${event}`));
      }, timeout);
      const off = this.on(event, (params) => {
        clearTimeout(timer);
        off();
        resolve(params);
      });
    });
  }

  /** Navigates and resolves once the load event has fired. */
  async open(url) {
    const loaded = this.once("Page.loadEventFired");
    const result = await this.send("Page.navigate", { url });
    if (result.errorText) throw new Error(`Navigation to ${url} failed: ${result.errorText}`);
    await loaded;
  }

  async reload() {
    const loaded = this.once("Page.loadEventFired");
    await this.send("Page.reload", { ignoreCache: true });
    await loaded;
  }

  /** Runs a script in every new document before the page's own scripts. */
  addInitScript(source) {
    return this.send("Page.addScriptToEvaluateOnNewDocument", { source });
  }

  /** Evaluates an expression in the page and returns its value (JSON-serialisable). */
  async evaluate(expression, { awaitPromise = false } = {}) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise,
      returnByValue: true,
      userGesture: true,
    });
    if (result.exceptionDetails) {
      const details = result.exceptionDetails;
      const description = details.exception?.description || details.text || "unknown error";
      throw new Error(`Page script failed: ${description}`);
    }
    return result.result.value;
  }

  /**
   * Emulates a screen size and, optionally, media features: a colour scheme and reduced motion
   * ("reduce" | "no-preference"). The media features set here replace any set earlier.
   */
  async emulate({ width, height, mobile = false, colorScheme, reducedMotion } = {}) {
    if (width && height) {
      await this.send("Emulation.setDeviceMetricsOverride", {
        width,
        height,
        deviceScaleFactor: 1,
        mobile,
      });
    }
    if (colorScheme) this.mediaFeatures = { ...this.mediaFeatures, "prefers-color-scheme": colorScheme };
    if (reducedMotion) this.mediaFeatures = { ...this.mediaFeatures, "prefers-reduced-motion": reducedMotion };
    if (colorScheme || reducedMotion) {
      await this.send("Emulation.setEmulatedMedia", {
        features: Object.entries(this.mediaFeatures).map(([name, value]) => ({ name, value })),
      });
    }
  }

  /** Sets the files of an <input type="file"> (which fires its change event). */
  async setFileInput(selector, absPath) {
    const { root } = await this.send("DOM.getDocument", { depth: 0 });
    const { nodeId } = await this.send("DOM.querySelector", { nodeId: root.nodeId, selector });
    if (!nodeId) throw new Error(`No element matches ${selector}`);
    await this.send("DOM.setFileInputFiles", { nodeId, files: [absPath] });
  }

  /** Allows downloads and saves them into dir (browser-wide setting). */
  setDownloadDir(dir) {
    return this.connection.send("Browser.setDownloadBehavior", {
      behavior: "allow",
      downloadPath: dir,
      eventsEnabled: true,
    });
  }

  /** Sends a real key press (keyDown + keyUp) to the focused element. */
  async press(key) {
    const info = KEYS[key];
    if (!info) throw new Error(`Unknown key ${key}`);
    const base = {
      key,
      code: info.code,
      windowsVirtualKeyCode: info.keyCode,
      nativeVirtualKeyCode: info.keyCode,
    };
    await this.send("Input.dispatchKeyEvent", {
      type: info.text ? "keyDown" : "rawKeyDown",
      ...base,
      ...(info.text ? { text: info.text, unmodifiedText: info.text } : {}),
    });
    await this.send("Input.dispatchKeyEvent", { type: "keyUp", ...base });
  }

  /** Saves a full-page PNG screenshot. */
  async screenshot(filePath) {
    const metrics = await this.send("Page.getLayoutMetrics");
    const size = metrics.cssContentSize || metrics.contentSize;
    const { data } = await this.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: true,
      clip: { x: 0, y: 0, width: Math.ceil(size.width), height: Math.ceil(size.height), scale: 1 },
    });
    await writeFile(filePath, Buffer.from(data, "base64"));
  }

  async close() {
    try {
      await this.connection.send("Target.closeTarget", { targetId: this.targetId });
    } catch {
      // The browser may already be gone.
    }
  }
}

export class Browser {
  constructor(process, connection, profileDir) {
    this.process = process;
    this.connection = connection;
    this.profileDir = profileDir;
  }

  /** Opens a fresh tab with Page, Runtime and Network enabled. */
  async newPage() {
    const { targetId } = await this.connection.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await this.connection.send("Target.attachToTarget", {
      targetId,
      flatten: true,
    });
    const page = new Page(this.connection, sessionId, targetId);
    await page.send("Page.enable");
    await page.send("Runtime.enable");
    await page.send("Network.enable");
    return page;
  }

  /** Closes Chrome and removes the temporary profile. */
  async close() {
    try {
      await Promise.race([this.connection.send("Browser.close"), sleep(3000)]);
    } catch {
      // Already closed.
    }
    try {
      this.connection.ws.close();
    } catch {
      // Ignore.
    }
    if (this.process.exitCode === null) {
      await Promise.race([new Promise((resolve) => this.process.once("exit", resolve)), sleep(3000)]);
      if (this.process.exitCode === null) this.process.kill("SIGKILL");
    }
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await rm(this.profileDir, { recursive: true, force: true });
        return;
      } catch {
        await sleep(200);
      }
    }
  }
}

/** Starts Chrome with a temporary profile and connects to it. */
export async function launch({ headed = false } = {}) {
  const executable = process.env.CHROME || DEFAULT_CHROME[process.platform] || "google-chrome";
  const profileDir = await mkdtemp(path.join(tmpdir(), "menace-cdp-"));
  const args = [
    `--user-data-dir=${profileDir}`,
    "--remote-debugging-port=0",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--disable-sync",
    "--disable-component-update",
    "--disable-background-networking",
    "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding",
    "--hide-scrollbars",
    "--mute-audio",
  ];
  if (!headed) args.push("--headless");
  args.push("about:blank");

  const child = spawn(executable, args, { stdio: "ignore" });
  let launchError = null;
  child.once("error", (error) => {
    launchError = error;
  });

  // Chrome writes "<port>\n<browser websocket path>" into the profile once it is listening.
  const portFile = path.join(profileDir, "DevToolsActivePort");
  const deadline = Date.now() + 20000;
  let contents = null;
  while (Date.now() < deadline) {
    if (launchError) {
      await rm(profileDir, { recursive: true, force: true });
      throw new Error(`Could not start Chrome at ${executable} (${launchError.message}). Set CHROME=/path/to/chrome.`);
    }
    try {
      const text = await readFile(portFile, "utf8");
      if (text.includes("\n")) {
        contents = text;
        break;
      }
    } catch {
      // Not written yet; keep polling.
    }
    await sleep(50);
  }
  if (!contents) throw new Error("Chrome did not report a DevTools port within 20 s.");
  const [port, wsPath] = contents.trim().split("\n");

  const ws = new WebSocket(`ws://127.0.0.1:${port}${wsPath}`);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", () => reject(new Error("Could not connect to Chrome's DevTools socket.")), { once: true });
  });
  return new Browser(child, new Connection(ws), profileDir);
}
