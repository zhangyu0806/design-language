import assert from "node:assert/strict";
import test from "node:test";

import { createPreviewLifecycle, DEADLINE_MS, GRACE_MS } from "../scripts/dl-preview-lifecycle.mjs";

function deferred() {
  let resolve;
  const promise = new Promise((complete) => { resolve = complete; });
  return Object.freeze({ promise, resolve });
}

function manualScheduler() {
  const timers = new Map();
  const scheduled = [];
  let now = 0;
  let nextId = 1;
  return Object.freeze({
    scheduled,
    setTimeout(callback, delay) {
      const id = nextId;
      nextId += 1;
      scheduled.push({ at: now + delay, delay });
      timers.set(id, { at: now + delay, callback });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    advanceTo(target) {
      while (true) {
        const due = [...timers.entries()]
          .filter(([, timer]) => timer.at <= target)
          .sort((left, right) => left[1].at - right[1].at || left[0] - right[0])[0];
        if (due === undefined) break;
        const [id, timer] = due;
        timers.delete(id);
        now = timer.at;
        timer.callback();
      }
      now = target;
    },
  });
}

function lifecycleFixture() {
  const events = [];
  const serverClosed = deferred();
  const storeClosed = deferred();
  const forceNeverSettles = new Promise(() => {});
  const socket = { destroy() { events.push("socket.destroy"); } };
  const server = {
    listening: true,
    close(callback) {
      events.push("server.close");
      void serverClosed.promise.then(callback);
    },
    closeIdleConnections() { events.push("server.closeIdleConnections"); },
    closeAllConnections() { events.push("server.closeAllConnections"); },
  };
  const store = {
    close() {
      events.push("store.close");
      return storeClosed.promise;
    },
    forceClose() {
      events.push("store.forceClose");
      return forceNeverSettles;
    },
  };
  return Object.freeze({ events, server, serverClosed, socket, store, storeClosed });
}

async function settled(promise) {
  const marker = Symbol("pending");
  return Promise.race([promise.then(() => true), Promise.resolve(marker)])
    .then((value) => value === true);
}

test("preview lifecycle owns the exact four-second grace and five-second absolute deadline", () => {
  assert.equal(GRACE_MS, 4_000);
  assert.equal(DEADLINE_MS, 5_000);
});

test("close synchronously stops admission, starts both drains, and caches one promise", () => {
  const fixture = lifecycleFixture();
  const scheduler = manualScheduler();
  const lifecycle = createPreviewLifecycle({
    server: fixture.server,
    sockets: new Set([fixture.socket]),
    store: fixture.store,
    stopAccepting() { fixture.events.push("stopAccepting"); },
    scheduler,
  });

  const first = lifecycle.close();
  const second = lifecycle.close();

  assert.strictEqual(first, second);
  assert.deepEqual(fixture.events, ["stopAccepting", "server.close", "server.closeIdleConnections", "store.close"]);
  assert.deepEqual(scheduler.scheduled, [{ at: 4_000, delay: 4_000 }, { at: 5_000, delay: 5_000 }]);
});

test("graceful completion returns early and cancels force and deadline timers", async () => {
  const fixture = lifecycleFixture();
  const scheduler = manualScheduler();
  const lifecycle = createPreviewLifecycle({
    server: fixture.server,
    sockets: new Set([fixture.socket]),
    store: fixture.store,
    stopAccepting() { fixture.events.push("stopAccepting"); },
    scheduler,
  });
  const closing = lifecycle.close();

  fixture.serverClosed.resolve();
  fixture.storeClosed.resolve();
  await closing;
  scheduler.advanceTo(DEADLINE_MS);

  assert.equal(fixture.events.includes("store.forceClose"), false);
  assert.equal(fixture.events.includes("socket.destroy"), false);
});

test("force fences at 4000ms before connection destruction without resetting the 5000ms deadline", async () => {
  const fixture = lifecycleFixture();
  const scheduler = manualScheduler();
  const lifecycle = createPreviewLifecycle({
    server: fixture.server,
    sockets: new Set([fixture.socket]),
    store: fixture.store,
    stopAccepting() { fixture.events.push("stopAccepting"); },
    scheduler,
  });
  const closing = lifecycle.close();

  scheduler.advanceTo(GRACE_MS - 1);
  assert.equal(fixture.events.includes("store.forceClose"), false);
  scheduler.advanceTo(GRACE_MS);

  assert.deepEqual(fixture.events.slice(-3), ["store.forceClose", "server.closeAllConnections", "socket.destroy"]);
  assert.deepEqual(scheduler.scheduled, [{ at: 4_000, delay: 4_000 }, { at: 5_000, delay: 5_000 }]);
  assert.equal(await settled(closing), false);
  scheduler.advanceTo(DEADLINE_MS - 1);
  assert.equal(await settled(closing), false);
});

test("hard deadline resolves unconditionally while force and graceful work remain pending", async () => {
  const fixture = lifecycleFixture();
  const scheduler = manualScheduler();
  const lifecycle = createPreviewLifecycle({
    server: fixture.server,
    sockets: new Set([fixture.socket]),
    store: fixture.store,
    stopAccepting() { fixture.events.push("stopAccepting"); },
    scheduler,
  });
  const closing = lifecycle.close();

  scheduler.advanceTo(DEADLINE_MS);
  await closing;
  lifecycle.close();

  assert.equal(fixture.events.filter((event) => event === "store.forceClose").length, 1);
  assert.equal(fixture.events.filter((event) => event === "server.closeAllConnections").length, 1);
  assert.equal(fixture.events.filter((event) => event === "socket.destroy").length, 1);
});
