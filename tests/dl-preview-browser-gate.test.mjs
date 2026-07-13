import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { once } from "node:events";
import { access, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { chromeGroupExists, signalChromeGroup } from "./dl-preview-chrome-process.mjs";

const fixture = new URL("./fixtures/dl-preview-browser-gate-child.mjs", import.meta.url);
const ABORT_MARKER = "DL_PREVIEW_BROWSER_GATE_ABORTED";

async function processGroupFrom(child, processGroupFile) {
  if (child.browserProcessGroup !== undefined) return child.browserProcessGroup;
  try {
    return Number.parseInt(await readFile(processGroupFile, "utf8"), 10);
  } catch (error) {
    if (error.code === "ENOENT") return undefined;
    throw error;
  }
}

function watchdog(promise, child, exited, processGroupFile) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => {
        void processGroupFrom(child, processGroupFile).then((processGroup) => {
          if (processGroup !== undefined) signalChromeGroup(processGroup, "SIGKILL");
          child.kill("SIGKILL");
          return exited;
        }).then(
          () => reject(new Error("browser gate meta-test watchdog expired")),
          reject,
        );
      }, 15_000);
    }),
  ]).finally(() => clearTimeout(timer));
}

async function runInner(scenario) {
  const sandbox = await mkdtemp(join(tmpdir(), "dl-preview-gate-meta-"));
  const processGroupFile = join(sandbox, "chrome-process-group");
  const child = fork(fixture, [scenario, processGroupFile], { env: { ...process.env, TMPDIR: sandbox }, silent: true });
  const exited = once(child, "exit");
  const closed = once(child, "close");
  const messages = [];
  let abortSignalSent = false;
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  child.on("message", (message) => {
    messages.push(message);
    if (message.event === "chrome-running") child.browserProcessGroup = message.processGroup;
    if (message.event === "selection-started") {
      if (scenario === "normal") child.send({ command: "complete" });
      else {
        abortSignalSent = signalChromeGroup(child.browserProcessGroup, "SIGTERM");
        child.send({ command: abortSignalSent ? "abort-sent" : "abort-missed" });
      }
    }
  });
  const [code, signal] = await watchdog(closed, child, exited, processGroupFile);
  const ownedRemaining = (await readdir(sandbox)).filter((name) => !name.startsWith("com.google.Chrome."));
  await rm(sandbox, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  const sandboxRemoved = await access(sandbox).then(() => false, (error) => {
    if (error.code === "ENOENT") return true;
    throw error;
  });
  return { abortSignalSent, code, messages, ownedRemaining, sandboxRemoved, signal, stderr };
}

test("real Chrome browser gate passes normally and fails privately when aborted in progress", async () => {
  const normal = await runInner("normal");
  assert.deepEqual([normal.code, normal.signal], [0, null]);
  assert.deepEqual(normal.messages.map(({ event }) => event), ["chrome-running", "preview-ready", "selection-started", "selection-completed"]);
  assert.equal(Number.isInteger(normal.messages[0].processGroup), true);
  assert.ok(normal.messages[0].processGroup > 0);
  assert.deepEqual(normal.messages[1], { event: "preview-ready", productionCli: true, sessionReady: true });
  assert.deepEqual(normal.messages[2], { event: "selection-started", method: "POST", path: "/__dl/select", pending: true });
  assert.deepEqual(normal.messages[3], { event: "selection-completed", choice: "b", loadingFinished: true, mode: 0o600, persisted: true, status: 204, successDom: true });
  assert.equal(chromeGroupExists(normal.messages[0].processGroup), false);
  assert.deepEqual(normal.ownedRemaining, []);
  assert.equal(normal.sandboxRemoved, true);
  assert.equal(normal.stderr, "");

  const aborted = await runInner("abort");
  assert.equal(aborted.code, 1);
  assert.equal(aborted.signal, null);
  assert.equal(aborted.abortSignalSent, true);
  assert.deepEqual(aborted.messages.map(({ event }) => event), ["chrome-running", "preview-ready", "selection-started"]);
  assert.equal(Number.isInteger(aborted.messages[0].processGroup), true);
  assert.deepEqual(aborted.messages[2], { event: "selection-started", method: "POST", path: "/__dl/select", pending: true });
  assert.equal(chromeGroupExists(aborted.messages[0].processGroup), false);
  assert.deepEqual(aborted.ownedRemaining, []);
  assert.equal(aborted.sandboxRemoved, true);
  assert.equal(aborted.stderr.trim(), ABORT_MARKER);
  assert.equal(aborted.stderr.includes("/tmp/"), false);
});
