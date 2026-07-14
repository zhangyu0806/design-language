import { execFile, spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { signalChromeGroup, waitForChromeGroupExit } from "./dl-preview-chrome-process.mjs";

const executeFile = promisify(execFile);
const REQUIRED_CHROME_VERSION = "144.0.7559.109";
const REQUIRED_CHROME_NAMES = new Set([`Google Chrome ${REQUIRED_CHROME_VERSION}`, `Google Chrome for Testing ${REQUIRED_CHROME_VERSION}`]);
const COMMAND_TIMEOUT_MS = 10_000;

export function isRequiredChromeVersion(version) {
  return REQUIRED_CHROME_NAMES.has(version.trim());
}

class CdpError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "CdpError";
    this.details = details;
  }
}

function withTimeout(signal, milliseconds = COMMAND_TIMEOUT_MS) {
  const timeout = AbortSignal.timeout(milliseconds);
  return signal === undefined ? timeout : AbortSignal.any([signal, timeout]);
}

function abortError(signal) {
  return signal.reason instanceof Error ? signal.reason : new CdpError("CDP operation aborted");
}

async function chromePath() {
  const path = process.env.CHROME_PATH;
  if (path === undefined || path.length === 0) throw new CdpError(`CHROME_PATH must name Chrome ${REQUIRED_CHROME_VERSION}`);
  let stdout;
  try {
    ({ stdout } = await executeFile(path, ["--version"]));
  } catch (error) {
    throw new CdpError("CHROME_PATH is not executable", { cause: error });
  }
  if (!isRequiredChromeVersion(stdout)) throw new CdpError(`Chrome version mismatch: ${stdout.trim()}`);
  return path;
}

function createTransport(child) {
  const commands = new Map();
  const events = [];
  const waiterRejects = new Set();
  let commandId = 0;
  let buffer = Buffer.alloc(0);
  let closed = false;
  const input = child.stdio[3];
  const output = child.stdio[4];

  const rejectPending = (error) => {
    if (closed) return;
    closed = true;
    for (const { cleanup, reject } of commands.values()) {
      cleanup();
      reject(error);
    }
    commands.clear();
    for (const reject of waiterRejects) reject(error);
    waiterRejects.clear();
  };

  output.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    for (let boundary = buffer.indexOf(0); boundary !== -1; boundary = buffer.indexOf(0)) {
      const frame = buffer.subarray(0, boundary).toString("utf8");
      buffer = buffer.subarray(boundary + 1);
      if (frame.length === 0) continue;
      let message;
      try {
        message = JSON.parse(frame);
      } catch (error) {
        rejectPending(new CdpError("Chrome sent malformed CDP JSON", { cause: error }));
        return;
      }
      if (message.id !== undefined) {
        const pending = commands.get(message.id);
        if (pending === undefined) continue;
        commands.delete(message.id);
        pending.cleanup();
        if (message.error !== undefined) pending.reject(new CdpError(message.error.message, message.error));
        else pending.resolve(message.result ?? {});
      } else if (message.method !== undefined) {
        const event = Object.freeze({ method: message.method, params: message.params ?? {}, sessionId: message.sessionId });
        events.push(event);
        for (const listener of [...listeners]) listener(event);
      }
    }
  });
  output.once("error", rejectPending);
  output.once("close", () => rejectPending(new CdpError("Chrome CDP pipe closed")));
  input.once("error", rejectPending);
  child.once("error", rejectPending);
  child.once("exit", (code, signal) => rejectPending(new CdpError("Chrome exited", { code, signal })));

  const listeners = new Set();
  function send(method, params = {}, options = {}) {
    if (closed) return Promise.reject(new CdpError("Chrome CDP pipe is closed"));
    const id = ++commandId;
    const signal = withTimeout(options.signal, options.timeout);
    return new Promise((resolve, reject) => {
      const onAbort = () => {
        commands.delete(id);
        reject(abortError(signal));
      };
      const cleanup = () => signal.removeEventListener("abort", onAbort);
      if (signal.aborted) return reject(abortError(signal));
      signal.addEventListener("abort", onAbort, { once: true });
      commands.set(id, { cleanup, reject, resolve });
      const payload = `${JSON.stringify({ id, method, params, ...(options.sessionId === undefined ? {} : { sessionId: options.sessionId }) })}\0`;
      const writeFailed = (error) => {
        const pending = commands.get(id);
        if (pending === undefined) return;
        commands.delete(id);
        pending.cleanup();
        pending.reject(new CdpError("Chrome CDP command write failed", { cause: error }));
      };
      try {
        input.write(payload, (error) => { if (error !== null && error !== undefined) writeFailed(error); });
      } catch (error) {
        writeFailed(error);
      }
    });
  }

  function waitFor(method, predicate = () => true, options = {}) {
    const after = options.after ?? 0;
    const existing = events.slice(after).find((event) => event.method === method && (options.sessionId === undefined || event.sessionId === options.sessionId) && predicate(event.params));
    if (existing !== undefined) return Promise.resolve(existing);
    const signal = withTimeout(options.signal, options.timeout);
    return new Promise((resolve, reject) => {
      const cleanup = () => { listeners.delete(listener); waiterRejects.delete(rejectClosed); signal.removeEventListener("abort", onAbort); };
      const onAbort = () => { cleanup(); reject(abortError(signal)); };
      const rejectClosed = (error) => { cleanup(); reject(error); };
      const listener = (event) => {
        if (event.method !== method || options.sessionId !== undefined && event.sessionId !== options.sessionId || !predicate(event.params)) return;
        cleanup();
        resolve(event);
      };
      if (signal.aborted) return reject(abortError(signal));
      listeners.add(listener);
      waiterRejects.add(rejectClosed);
      signal.addEventListener("abort", onAbort, { once: true });
    });
  }

  return Object.freeze({ events, send, waitFor, rejectPending });
}

export async function resolvePageTarget(transport, targetInfos) {
  const page = targetInfos.find(({ type }) => type === "page");
  if (page !== undefined) return page.targetId;
  const { targetId } = await transport.send("Target.createTarget", { url: "about:blank" });
  return targetId;
}

async function stopChrome(child, profile, transport, graceful) {
  transport.rejectPending(new CdpError("Chrome closing"));
  if (graceful && child.exitCode === null && child.signalCode === null) {
    try {
      await once(child, "exit", { signal: AbortSignal.timeout(3_000) });
    } catch (error) {
      if (error.name !== "AbortError" && error.name !== "TimeoutError") throw error;
    }
  }
  if (child.exitCode === null && child.signalCode === null) {
    const exited = once(child, "exit", { signal: AbortSignal.timeout(3_000) });
    signalChromeGroup(child.pid, "SIGKILL");
    try {
      await exited;
    } catch (error) {
      if (error.name !== "AbortError" && error.name !== "TimeoutError") throw error;
    }
  }
  signalChromeGroup(child.pid, "SIGKILL");
  await waitForChromeGroupExit(child.pid, new CdpError("Chrome process group did not exit"));
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
}

async function abortChrome(child, profile, transport) {
  if (child.exitCode === null && child.signalCode === null) {
    try {
      const exited = once(child, "exit", { signal: AbortSignal.timeout(3_000) });
      signalChromeGroup(child.pid, "SIGTERM");
      await exited;
    } catch (error) {
      if (error.name !== "AbortError" && error.name !== "TimeoutError") throw error;
    }
  }
  await stopChrome(child, profile, transport, false);
}

export async function launchChrome(url, options = {}) {
  const executable = await chromePath();
  const profile = await mkdtemp(join(tmpdir(), "dl-preview-chrome-"));
  const child = spawn(executable, [
    "--headless=new",
    "--remote-debugging-pipe",
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-networking",
    "--disable-component-update",
  ], { detached: true, stdio: ["ignore", "ignore", "pipe", "pipe", "pipe"] });
  child.stderr.resume();
  const transport = createTransport(child);
  let sessionId;
  let closing;
  try {
    options.onSpawn?.(child.pid);
    const targets = await transport.send("Target.getTargets");
    const targetId = await resolvePageTarget(transport, targets.targetInfos);
    ({ sessionId } = await transport.send("Target.attachToTarget", { targetId, flatten: true }));
    const command = (method, params = {}, options = {}) => transport.send(method, params, { ...options, sessionId });
    await command("Page.enable");
    let after = transport.events.length;
    await command("Page.navigate", { url: "about:blank" });
    await transport.waitFor("Page.frameNavigated", ({ frame }) => frame.url === "about:blank", { after, sessionId });
    await Promise.all(["Runtime.enable", "Network.enable", "Log.enable"].map((method) => command(method)));
    after = transport.events.length;
    await command("Page.navigate", { url });
    await transport.waitFor("Page.loadEventFired", () => true, { after, sessionId });
    return Object.freeze({
      events: transport.events,
      processGroup: child.pid,
      send(method, params = {}, options = {}) {
        return command(method, params, options);
      },
      evaluate(expression, options = {}) {
        return command("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, options);
      },
      waitFor(method, predicate, options = {}) {
        return transport.waitFor(method, predicate, { ...options, sessionId });
      },
      async waitForValue(expression, expected, options = {}) {
        const serialized = JSON.stringify(expected);
        const wrapped = `new Promise((resolve) => { const read = () => (${expression}); if (Object.is(read(), ${serialized})) return resolve(read()); const observer = new MutationObserver(() => { if (Object.is(read(), ${serialized})) { observer.disconnect(); resolve(read()); } }); observer.observe(document, { attributes: true, childList: true, characterData: true, subtree: true }); })`;
        return command("Runtime.evaluate", { expression: wrapped, awaitPromise: true, returnByValue: true }, options);
      },
      close() {
        if (closing !== undefined) return closing;
        closing = (async () => {
          try {
            await transport.send("Browser.close", {}, { timeout: 3_000 });
          } catch (error) {
            if (!(error instanceof CdpError) && error.name !== "AbortError" && error.name !== "TimeoutError") throw error;
          } finally {
            await stopChrome(child, profile, transport, true);
          }
        })();
        return closing;
      },
      abort() {
        if (closing !== undefined) return closing;
        closing = abortChrome(child, profile, transport);
        return closing;
      },
    });
  } catch (error) {
    await stopChrome(child, profile, transport, false);
    throw error;
  }
}
