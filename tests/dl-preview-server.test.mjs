import assert from "node:assert/strict";
import { access, mkdir, open, readFile, readlink, realpath, rm, stat, symlink, unlink, writeFile } from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import { join } from "node:path";
import test from "node:test";

import { SelectionError } from "../scripts/dl-preview-selection.mjs";
import { handleClientError, startPreviewServer } from "../scripts/dl-preview-server.mjs";
import { makePreviewFixture, validSelection } from "./dl-preview-fixtures.mjs";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((complete, fail) => { resolve = complete; reject = fail; });
  return Object.freeze({ promise, resolve, reject });
}

async function startFixture(context, options = {}) {
  const fixture = await makePreviewFixture();
  const preview = await startPreviewServer({ rootPath: fixture.root, port: 0, exitOnSelect: false, ...options });
  context.after(async () => { await preview.close(); await fixture.cleanup(); });
  return { fixture, preview, origin: `http://127.0.0.1:${preview.port}` };
}

function request(origin, path, options = {}) {
  return new Promise((resolve, reject) => {
    const outgoing = http.request(`${origin}${path}`, options, (incoming) => {
      const chunks = [];
      incoming.on("data", (chunk) => chunks.push(chunk));
      incoming.on("end", () => resolve({ status: incoming.statusCode, headers: incoming.headers, body: Buffer.concat(chunks).toString("utf8") }));
    });
    outgoing.on("error", reject);
    if (options.body) outgoing.write(options.body);
    outgoing.end();
  });
}

function stableResponse(response) {
  const { date, ...headers } = response.headers;
  return { status: response.status, headers, body: response.body };
}

function rawRequest(port, wire) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    const chunks = [];
    socket.on("connect", () => socket.end(wire));
    socket.on("data", (chunk) => chunks.push(chunk));
    socket.on("end", () => resolve(Buffer.concat(chunks).toString("latin1")));
    socket.on("error", reject);
  });
}

function incompleteRequestDuration(port, wire) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    let startedAt;
    let watchdog;
    let settled = false;
    const finish = (complete, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(watchdog);
      socket.destroy();
      complete(value);
    };
    socket.once("connect", () => {
      startedAt = performance.now();
      socket.write(wire);
      watchdog = setTimeout(() => {
        const elapsed = performance.now() - startedAt;
        finish(reject, new Error(`incomplete request remained open for ${Math.round(elapsed)}ms`));
      }, 8_000);
    });
    socket.once("close", () => {
      if (startedAt === undefined) finish(reject, new Error("socket closed before the request was sent"));
      else finish(resolve, performance.now() - startedAt);
    });
    socket.once("error", (error) => {
      if (startedAt === undefined) finish(reject, error);
      else finish(resolve, performance.now() - startedAt);
    });
  });
}

function assertFiveSecondTimeout(elapsed) {
  assert.ok(elapsed >= 4_750, `request timed out too early at ${Math.round(elapsed)}ms`);
  assert.ok(elapsed <= 7_000, `request timed out too late at ${Math.round(elapsed)}ms`);
}

test("request timeout closes an idle browser socket without emitting a synthetic 400", () => {
  const calls = [];
  const socket = {
    writable: true,
    end(value) { calls.push(["end", value]); },
    destroy() { calls.push(["destroy"]); },
  };
  handleClientError({ code: "ERR_HTTP_REQUEST_TIMEOUT" }, socket);
  assert.deepEqual(calls, [["destroy"]]);
});

test("partial request headers close near the five-second headers timeout", async (context) => {
  const { preview } = await startFixture(context);
  const elapsed = await incompleteRequestDuration(
    preview.port,
    `GET /__dl/session HTTP/1.1\r\nHost: 127.0.0.1:${preview.port}\r\nX-Incomplete:`,
  );
  assertFiveSecondTimeout(elapsed);
});

test("partial declared request body closes near the five-second request timeout", async (context) => {
  const { preview } = await startFixture(context);
  const host = `127.0.0.1:${preview.port}`;
  const elapsed = await incompleteRequestDuration(
    preview.port,
    `POST /__dl/select HTTP/1.1\r\nHost: ${host}\r\nOrigin: http://${host}\r\nContent-Type: application/json\r\nContent-Length: 10\r\nConnection: close\r\n\r\n{`,
  );
  assertFiveSecondTimeout(elapsed);
});

test("malformed HTTP still receives one stable 400 response", () => {
  const calls = [];
  const socket = {
    writable: true,
    end(value) { calls.push(["end", value]); },
    destroy() { calls.push(["destroy"]); },
  };
  handleClientError({ code: "HPE_INVALID_HEADER_TOKEN" }, socket);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "end");
  assert.match(calls[0][1], /^HTTP\/1\.1 400 Bad Request/);
});

test("unsupported platform fails before reading the user preview root or cleaning stale temps", async (context) => {
  const fixture = await makePreviewFixture();
  context.after(() => fixture.cleanup());
  const staleName = `.selection.json.${"a".repeat(24)}.${"b".repeat(24)}.tmp`;
  await writeFile(join(fixture.root, staleName), "stale\n");
  let rootRead = false;

  await assert.rejects(
    startPreviewServer({
      get rootPath() {
        rootRead = true;
        return `${fixture.root}/missing-private-directory`;
      },
      platform: "darwin",
    }),
    { code: "NOT_FOUND" },
  );

  assert.equal(rootRead, false);
  assert.equal(await readFile(join(fixture.root, staleName), "utf8"), "stale\n");
});

test("procfs failure is the first startup side effect and does not read the user preview root", async () => {
  const events = [];
  let rootRead = false;

  await assert.rejects(
    startPreviewServer({
      get rootPath() {
        rootRead = true;
        return "/private/preview-root";
      },
      platform: "linux",
      pathOperations: {
        async open(path) {
          events.push(["open", path]);
          throw new Error("procfs unavailable");
        },
      },
    }),
    { code: "NOT_FOUND" },
  );

  assert.equal(rootRead, false);
  assert.deepEqual(events, [["open", "/dev/null"]]);
});

test("startup removes only strict stale selection temp names before listening", async (context) => {
  const fixture = await makePreviewFixture();
  context.after(() => fixture.cleanup());
  const firstId = "1".repeat(24);
  const secondId = "2".repeat(24);
  const staleName = `.selection.json.${firstId}.${secondId}.tmp`;
  const survivors = [
    `.selection.json.${firstId}.tmp`,
    `.selection.json.${firstId}.${"2".repeat(23)}.tmp`,
    `.selection.json.${firstId}.${secondId}.tmp.keep`,
    `.selection.json.${"g".repeat(24)}.${secondId}.tmp`,
  ];
  await Promise.all([
    writeFile(join(fixture.root, staleName), "stale\n"),
    ...survivors.map((name) => writeFile(join(fixture.root, name), "keep\n")),
  ]);

  const preview = await startPreviewServer({ rootPath: fixture.root, port: 0, exitOnSelect: false });
  context.after(() => preview.close());

  await assert.rejects(access(join(fixture.root, staleName)));
  for (const name of survivors) assert.equal(await readFile(join(fixture.root, name), "utf8"), "keep\n");
  assert.equal(await readFile(join(fixture.root, "selection.json"), "utf8"), '{"old":true}\n');
});

test("startup cleans strict stale temps before rejecting an invalid manifest", async (context) => {
  const fixture = await makePreviewFixture({ schemaVersion: 2 });
  context.after(() => fixture.cleanup());
  const staleName = `.selection.json.${"c".repeat(24)}.${"d".repeat(24)}.tmp`;
  await writeFile(join(fixture.root, staleName), "stale\n");

  await assert.rejects(startPreviewServer({ rootPath: fixture.root }), { code: "INVALID_MANIFEST" });

  await assert.rejects(access(join(fixture.root, staleName)));
});

test("server-scoped path operations cover startup and later static asset opens", async (context) => {
  const fixture = await makePreviewFixture();
  context.after(() => fixture.cleanup());
  const openedPaths = [];
  const pathOperations = {
    async open(path, ...args) {
      openedPaths.push(path);
      return open(path, ...args);
    },
    readlink,
    realpath,
    stat,
  };
  const preview = await startPreviewServer({ rootPath: fixture.root, platform: "linux", pathOperations });
  context.after(() => preview.close());

  const response = await request(`http://127.0.0.1:${preview.port}`, "/app.js");

  assert.equal(response.status, 200);
  assert.equal(openedPaths.includes(join(fixture.root, "index.html")), true);
  assert.equal(openedPaths.includes(join(fixture.root, "app.js")), true);
});

test("session, static GET/HEAD, route matrix, headers, and no CORS are exact", async (context) => {
  const { preview, origin } = await startFixture(context);
  const session = await request(origin, "/__dl/session");
  assert.equal(session.status, 200);
  assert.deepEqual(JSON.parse(session.body), { schemaVersion: 1, session: preview.session });
  assert.match(preview.session, /^[A-Za-z0-9_-]{43}$/);
  const get = await request(origin, "/");
  const head = await request(origin, "/", { method: "HEAD" });
  assert.equal(get.status, 200);
  assert.equal(head.status, 200);
  assert.equal(head.body, "");
  assert.equal(head.headers["content-length"], get.headers["content-length"]);
  assert.equal(get.headers["cache-control"], "no-store");
  assert.equal(get.headers["access-control-allow-origin"], undefined);
  const wrongMethod = await request(origin, "/__dl/select");
  assert.equal(wrongMethod.status, 405);
  assert.equal(wrongMethod.headers.allow, "POST");
  assert.deepEqual(JSON.parse(wrongMethod.body), { error: { code: "METHOD_NOT_ALLOWED" } });
  const protectedFile = await request(origin, "/selection.json");
  const missingFile = await request(origin, "/missing.txt");
  assert.equal(protectedFile.status, 404);
  assert.deepEqual(JSON.parse(protectedFile.body), JSON.parse(missingFile.body));
  const options = await request(origin, "/__dl/select", { method: "OPTIONS" });
  assert.equal(options.status, 405);
  assert.equal(options.headers.allow, "POST");
  assert.equal(options.headers["access-control-allow-origin"], undefined);
});

test("protected in-root symlink aliases match missing GET and HEAD while a public alias remains usable", async (context) => {
  const { fixture, origin } = await startFixture(context);
  const strictTemp = `.selection.json.${"e".repeat(24)}.${"f".repeat(24)}.tmp`;
  await mkdir(join(fixture.root, "nested"));
  await Promise.all([
    writeFile(join(fixture.root, ".openspec.yaml"), "private: true\n"),
    writeFile(join(fixture.root, strictTemp), "private temp\n"),
    writeFile(join(fixture.root, "nested", ".secret"), "nested private\n"),
    symlink("selection.json", join(fixture.root, "selection-alias.json")),
    symlink(".openspec.yaml", join(fixture.root, "openspec-alias.txt")),
    symlink(strictTemp, join(fixture.root, "temp-alias.txt")),
    symlink(".secret", join(fixture.root, "root-dotfile-alias.txt")),
    symlink("nested/.secret", join(fixture.root, "nested-dotfile-alias.txt")),
    symlink("app.js", join(fixture.root, "public-alias.js")),
  ]);
  const protectedAliases = ["/selection-alias.json", "/openspec-alias.txt", "/temp-alias.txt", "/root-dotfile-alias.txt", "/nested-dotfile-alias.txt"];

  for (const method of ["GET", "HEAD"]) {
    const missing = stableResponse(await request(origin, "/missing.txt", { method }));
    for (const pathname of protectedAliases) {
      assert.deepEqual(stableResponse(await request(origin, pathname, { method })), missing, `${method} ${pathname}`);
    }
  }

  const directPublic = await request(origin, "/app.js");
  const publicGet = await request(origin, "/public-alias.js");
  const publicHead = await request(origin, "/public-alias.js", { method: "HEAD" });
  assert.equal(publicGet.status, 200);
  assert.equal(publicGet.body, directPublic.body);
  assert.equal(publicHead.status, 200);
  assert.equal(publicHead.body, "");
  assert.equal(publicHead.headers["content-length"], publicGet.headers["content-length"]);
});

test("startup rejects an index manifest reached through a symlink escape", async (context) => {
  const fixture = await makePreviewFixture();
  context.after(() => fixture.cleanup());
  await unlink(join(fixture.root, "index.html"));
  await symlink(join(fixture.outside, "outside.txt"), join(fixture.root, "index.html"));
  await assert.rejects(startPreviewServer({ rootPath: fixture.root, port: 0, exitOnSelect: false }));
});

test("Host and Origin validation happen before selection processing", async (context) => {
  const { preview, origin } = await startFixture(context);
  const hostAttack = await rawRequest(preview.port, "GET /__dl/session HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n");
  assert.match(hostAttack, /^HTTP\/1\.1 421 /);
  const whitespaceHost = await rawRequest(preview.port, `GET /__dl/session HTTP/1.1\r\nHost: 127.0.0.1:${preview.port} \r\nConnection: close\r\n\r\n`);
  assert.match(whitespaceHost, /^HTTP\/1\.1 421 /);
  const absolute = await rawRequest(preview.port, `GET ${origin}/__dl/session HTTP/1.1\r\nHost: 127.0.0.1:${preview.port}\r\nConnection: close\r\n\r\n`);
  assert.match(absolute, /^HTTP\/1\.1 421 /);
  const body = JSON.stringify(validSelection(preview.session));
  const missingOrigin = await request(origin, "/__dl/select", { method: "POST", headers: { "content-type": "application/json", "content-length": Buffer.byteLength(body) }, body });
  assert.equal(missingOrigin.status, 403);
});

test("raw selection framing rejects transfer encoding, missing length, and excess data", async (context) => {
  const { preview } = await startFixture(context);
  const host = `127.0.0.1:${preview.port}`;
  const chunked = await rawRequest(preview.port, `POST /__dl/select HTTP/1.1\r\nHost: ${host}\r\nOrigin: http://${host}\r\nContent-Type: application/json\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n0\r\n\r\n`);
  assert.match(chunked, /^HTTP\/1\.1 400 /);
  const missing = await rawRequest(preview.port, `POST /__dl/select HTTP/1.1\r\nHost: ${host}\r\nOrigin: http://${host}\r\nContent-Type: application/json\r\nConnection: close\r\n\r\n`);
  assert.match(missing, /^HTTP\/1\.1 411 /);
  const excess = await rawRequest(preview.port, `POST /__dl/select HTTP/1.1\r\nHost: ${host}\r\nOrigin: http://${host}\r\nContent-Type: application/json\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{}X`);
  assert.match(excess, /^HTTP\/1\.1 400 /);
  const pipeline = await rawRequest(preview.port, `POST /__dl/select HTTP/1.1\r\nHost: ${host}\r\nOrigin: http://${host}\r\nContent-Type: application/json\r\nContent-Length: 2\r\n\r\n{}GET /__dl/session HTTP/1.1\r\nHost: ${host}\r\nConnection: close\r\n\r\n`);
  assert.match(pipeline, /^HTTP\/1\.1 400 /);
  assert.equal((pipeline.match(/HTTP\/1\.1/g) ?? []).length, 1);
  assert.equal(pipeline.includes(preview.session), false);
  const duplicateLength = await rawRequest(preview.port, `POST /__dl/select HTTP/1.1\r\nHost: ${host}\r\nOrigin: http://${host}\r\nContent-Type: application/json\r\nContent-Length: 2\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{}`);
  assert.match(duplicateLength, /^HTTP\/1\.1 400 /);
  const oversized = await rawRequest(preview.port, `POST /__dl/select HTTP/1.1\r\nHost: ${host}\r\nOrigin: http://${host}\r\nContent-Type: application/json\r\nContent-Length: 32769\r\nConnection: close\r\n\r\n`);
  assert.match(oversized, /^HTTP\/1\.1 413 /);
  const short = await rawRequest(preview.port, `POST /__dl/select HTTP/1.1\r\nHost: ${host}\r\nOrigin: http://${host}\r\nContent-Type: application/json\r\nContent-Length: 10\r\nConnection: close\r\n\r\n{}`);
  assert.match(short, /^HTTP\/1\.1 400 /);
});

test("valid selection persists, while stale session and invalid schema are stable errors", async (context) => {
  const { fixture, preview, origin } = await startFixture(context);
  const send = (value) => {
    const body = JSON.stringify(value);
    return request(origin, "/__dl/select", { method: "POST", headers: { origin, "content-type": "application/json; charset=utf-8", "content-length": Buffer.byteLength(body) }, body });
  };
  assert.equal((await send(validSelection(preview.session))).status, 204);
  assert.equal(JSON.parse(await readFile(join(fixture.root, "selection.json"), "utf8")).feedback, "保留层级");
  const stale = await send(validSelection("x".repeat(43)));
  assert.equal(stale.status, 409);
  assert.deepEqual(JSON.parse(stale.body), { error: { code: "SESSION_MISMATCH" } });
  const invalid = await send({ ...validSelection(preview.session), choice: "unknown" });
  assert.equal(invalid.status, 422);
});

test("normal mode serializes concurrent valid selections and remains available", async (context) => {
  const { fixture, preview, origin } = await startFixture(context);
  const completionOrder = [];
  const send = (choice) => {
    const body = JSON.stringify(validSelection(preview.session, choice));
    return request(origin, "/__dl/select", { method: "POST", headers: { origin, "content-type": "application/json", "content-length": Buffer.byteLength(body) }, body }).then((response) => {
      completionOrder.push(choice);
      return response;
    });
  };
  const [first, second] = await Promise.all([send("a"), send("b")]);
  assert.equal(first.status, 204);
  assert.equal(second.status, 204);
  assert.equal(JSON.parse(await readFile(join(fixture.root, "selection.json"), "utf8")).choice, completionOrder.at(-1));
  assert.equal((await request(origin, "/__dl/session")).status, 200);
});

test("close-race store rejection is a safe 409 and never a forced 204", async (context) => {
  const enqueued = deferred();
  const write = deferred();
  const store = Object.freeze({
    enqueue() {
      enqueued.resolve();
      return write.promise;
    },
    close: async () => {},
    forceClose: async () => {},
  });
  const { preview, origin } = await startFixture(context, { storeFactory: () => store });
  const body = JSON.stringify(validSelection(preview.session));
  const response = request(origin, "/__dl/select", { method: "POST", headers: { origin, "content-type": "application/json", "content-length": Buffer.byteLength(body) }, body });
  await enqueued.promise;

  const closing = preview.close();
  write.reject(new SelectionError("STORE_CLOSED"));

  const result = await response;
  await closing;
  assert.equal(result.status, 409);
  assert.deepEqual(JSON.parse(result.body), { error: { code: "SELECTIONS_CLOSED" } });
});

test("exit-on-select gives one concurrent candidate ownership and closes after its 204", async (context) => {
  const { preview, origin } = await startFixture(context, { exitOnSelect: true });
  const send = (choice) => {
    const body = JSON.stringify(validSelection(preview.session, choice));
    return request(origin, "/__dl/select", { method: "POST", headers: { origin, "content-type": "application/json", "content-length": Buffer.byteLength(body) }, body });
  };
  const results = await Promise.allSettled(Array.from({ length: 12 }, (_, index) => send(index % 2 === 0 ? "a" : "b")));
  const statuses = results.filter((result) => result.status === "fulfilled").map((result) => result.value.status);
  assert.equal(statuses.filter((status) => status === 204).length, 1);
  assert.equal(statuses.includes(409), true);
  await preview.completion;
});

test("exit-on-select releases ownership after a failed atomic write", async (context) => {
  const { fixture, preview, origin } = await startFixture(context, { exitOnSelect: true });
  const outputPath = join(fixture.root, "selection.json");
  await rm(outputPath);
  await mkdir(outputPath);
  const send = async () => {
    const body = JSON.stringify(validSelection(preview.session));
    return request(origin, "/__dl/select", { method: "POST", headers: { origin, "content-type": "application/json", "content-length": Buffer.byteLength(body) }, body });
  };
  const failed = await send();
  assert.equal(failed.status, 500);
  assert.deepEqual(JSON.parse(failed.body), { error: { code: "SELECTION_WRITE_FAILED" } });
  await rm(outputPath, { recursive: true });
  assert.equal((await send()).status, 204);
  await preview.completion;
});
