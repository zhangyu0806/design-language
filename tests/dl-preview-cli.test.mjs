import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readdir, readFile, stat } from "node:fs/promises";
import http from "node:http";
import { join } from "node:path";
import test from "node:test";

import { makePreviewFixture, validSelection } from "./dl-preview-fixtures.mjs";

const cli = new URL("../scripts/dl-preview-cli.mjs", import.meta.url);
const signalFixture = new URL("./fixtures/dl-preview-signal-child.mjs", import.meta.url);

function spawnCli(args) {
  return spawn(process.execPath, [cli.pathname, ...args], { stdio: ["ignore", "pipe", "pipe"] });
}

function collectIpc(child) {
  const events = [];
  const waiters = new Set();
  child.on("message", (message) => {
    const event = { ...message, receivedAt: performance.now() };
    events.push(event);
    for (const waiter of waiters) waiter(event);
  });
  return Object.freeze({
    events,
    waitFor(predicate) {
      const existing = events.find(predicate);
      if (existing !== undefined) return Promise.resolve(existing);
      return new Promise((resolve) => {
        const waiter = (event) => {
          if (!predicate(event)) return;
          waiters.delete(waiter);
          resolve(event);
        };
        waiters.add(waiter);
      });
    },
  });
}

function watchdog(promise, milliseconds, onTimeout) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => {
        onTimeout();
        reject(new Error(`watchdog expired after ${milliseconds}ms`));
      }, milliseconds);
    }),
  ]).finally(() => clearTimeout(timer));
}

function requestOutcome(promise) {
  return promise.then(
    (status) => ({ status }),
    (error) => ({ error: error.code ?? error.name }),
  );
}

async function firstJsonLine(child) {
  child.stdout.setEncoding("utf8");
  let text = "";
  for await (const chunk of child.stdout) {
    text += chunk;
    const newline = text.indexOf("\n");
    if (newline !== -1) return JSON.parse(text.slice(0, newline));
  }
  throw new Error("child exited before JSON output");
}

function postSelection(ready, value) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(value);
    const outgoing = http.request(`${ready.url}__dl/select`, { method: "POST", headers: { origin: ready.url.slice(0, -1), "content-type": "application/json", "content-length": Buffer.byteLength(body) } }, (incoming) => {
      incoming.resume();
      incoming.on("end", () => resolve(incoming.statusCode));
    });
    outgoing.on("error", reject);
    outgoing.end(body);
  });
}

test("CLI argument errors are stable, private, and exit 2", async () => {
  const child = spawnCli(["--host", "0.0.0.0", "/private/preview"]);
  const event = await firstJsonLine(child);
  const [code] = await once(child, "exit");
  assert.deepEqual(event, { event: "error", code: "INVALID_ARGUMENTS" });
  assert.equal(code, 2);
  const duplicatePort = spawnCli(["--port", "0", "--port", "1", "/private/preview"]);
  assert.deepEqual(await firstJsonLine(duplicatePort), { event: "error", code: "INVALID_ARGUMENTS" });
  assert.equal((await once(duplicatePort, "exit"))[0], 2);
});

test("CLI emits one ready line, binds loopback, and SIGINT exits 130", async (context) => {
  const fixture = await makePreviewFixture();
  context.after(() => fixture.cleanup());
  const child = spawnCli([fixture.root]);
  context.after(() => { if (child.exitCode === null) child.kill("SIGKILL"); });
  const ready = await firstJsonLine(child);
  assert.deepEqual(Object.keys(ready), ["event", "url", "host", "port", "output", "session"]);
  assert.equal(ready.host, "127.0.0.1");
  assert.equal(ready.output, "selection.json");
  assert.match(ready.session, /^[A-Za-z0-9_-]{43}$/);
  child.kill("SIGINT");
  const [code] = await once(child, "exit");
  assert.equal(code, 130);
});

test("explicit port is honored and SIGTERM exits 143", async (context) => {
  const fixture = await makePreviewFixture();
  context.after(() => fixture.cleanup());
  const reservation = await import("node:net").then(({ createServer }) => new Promise((resolve) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  }));
  const child = spawnCli(["--port", String(reservation), fixture.root]);
  context.after(() => { if (child.exitCode === null) child.kill("SIGKILL"); });
  const ready = await firstJsonLine(child);
  assert.equal(ready.port, reservation);
  child.kill("SIGTERM");
  const [code] = await once(child, "exit");
  assert.equal(code, 143);
});

test("separate starts produce isolated sessions and startup failures are private", async (context) => {
  const fixture = await makePreviewFixture();
  context.after(() => fixture.cleanup());
  const first = spawnCli([fixture.root]);
  const firstReady = await firstJsonLine(first);
  first.kill("SIGINT");
  await once(first, "exit");
  const second = spawnCli([fixture.root]);
  context.after(() => { if (second.exitCode === null) second.kill("SIGKILL"); });
  const secondReady = await firstJsonLine(second);
  assert.notEqual(secondReady.session, firstReady.session);
  second.kill("SIGINT");
  await once(second, "exit");
  const failed = spawnCli([`${fixture.root}/missing-private-directory`]);
  const error = await firstJsonLine(failed);
  const [code] = await once(failed, "exit");
  assert.deepEqual(error, { event: "error", code: "PREVIEW_START_FAILED" });
  assert.equal(code, 1);
});

test("exit-on-select returns 204 and exits cleanly with status 0", async (context) => {
  const fixture = await makePreviewFixture();
  context.after(() => fixture.cleanup());
  const child = spawnCli(["--exit-on-select", fixture.root]);
  context.after(() => { if (child.exitCode === null) child.kill("SIGKILL"); });
  const ready = await firstJsonLine(child);
  assert.equal(await postSelection(ready, validSelection(ready.session)), 204);
  const [code] = await once(child, "exit");
  assert.equal(code, 0);
});

for (const [signal, expectedCode] of [["SIGINT", 130], ["SIGTERM", 143]]) {
  test(`${signal} force-fences a blocked real write near 4s and exits by the 5s deadline`, async () => {
    const fixture = await makePreviewFixture();
    const original = await readFile(`${fixture.root}/selection.json`, "utf8");
    const child = spawn(process.execPath, [signalFixture.pathname, fixture.root], { stdio: ["ignore", "ignore", "pipe", "ipc"] });
    const ipc = collectIpc(child);
    const exited = once(child, "exit");
    try {
      const ready = await watchdog(ipc.waitFor((event) => event.event === "ready"), 3_000, () => child.kill("SIGKILL"));
      const firstResponse = requestOutcome(postSelection(ready, validSelection(ready.session, "a")));
      await watchdog(ipc.waitFor((event) => event.event === "enqueue" && event.ordinal === 1), 3_000, () => child.kill("SIGKILL"));
      const secondResponse = requestOutcome(postSelection(ready, validSelection(ready.session, "b")));
      await watchdog(ipc.waitFor((event) => event.event === "enqueue" && event.ordinal === 2), 3_000, () => child.kill("SIGKILL"));
      await watchdog(ipc.waitFor((event) => event.event === "checkpoint" && event.name === "beforeRename"), 3_000, () => child.kill("SIGKILL"));

      const signalledAt = performance.now();
      child.kill(signal);
      const forced = await watchdog(ipc.waitFor((event) => event.event === "force"), 5_500, () => child.kill("SIGKILL"));
      const forceElapsed = forced.receivedAt - signalledAt;
      assert.ok(forceElapsed >= 3_800, `force happened too early at ${forceElapsed}ms`);
      assert.ok(forceElapsed <= 4_700, `force happened too late at ${forceElapsed}ms`);

      const closed = await watchdog(ipc.waitFor((event) => event.event === "closed"), Math.max(1, 5_500 - (performance.now() - signalledAt)), () => child.kill("SIGKILL"));
      const [code, exitSignal] = await watchdog(exited, Math.max(1, 5_500 - (performance.now() - signalledAt)), () => child.kill("SIGKILL"));
      assert.equal(exitSignal, null);
      assert.equal(code, expectedCode);
      assert.ok(performance.now() - signalledAt <= 5_500);
      assert.equal(closed.forceSettled, false);
      assert.deepEqual(ipc.events.filter((event) => event.event === "enqueue").map(({ ordinal, choice }) => ({ ordinal, choice })), [
        { ordinal: 1, choice: "a" },
        { ordinal: 2, choice: "b" },
      ]);
      assert.deepEqual(ipc.events.filter((event) => event.event === "operation" && event.operation === "open").map(({ ordinal }) => ordinal), [1]);
      assert.equal(ipc.events.some((event) => event.event === "operation" && event.ordinal === 2), false);
      assert.equal(ipc.events.some((event) => event.event === "operation" && event.operation === "rename"), false);
      const responses = await Promise.all([firstResponse, secondResponse]);
      assert.equal(responses.some(({ status }) => status === 204), false);
      assert.equal(ipc.events.some((event) => event.event === "force-settled"), false);
      assert.equal(await readFile(`${fixture.root}/selection.json`, "utf8"), original);
      const tempNames = (await readdir(fixture.root)).filter((name) => name.startsWith(".selection.json."));
      assert.equal(tempNames.length, 1);
      assert.equal((await stat(join(fixture.root, tempNames[0]))).mode & 0o777, 0o600);
    } finally {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
      await watchdog(exited, 1_000, () => child.kill("SIGKILL"));
      await fixture.cleanup();
    }
  });
}
