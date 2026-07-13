import assert from "node:assert/strict";
import { chmod, readdir, readFile, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import test from "node:test";

import { cleanupStaleSelectionTemps, createSelectionStore, parseManifestDocument, parsePreviewManifest, parseSelection } from "../scripts/dl-preview-selection.mjs";
import { makePreviewFixture, validManifest, validSelection } from "./dl-preview-fixtures.mjs";

const manifestJson = JSON.stringify(validManifest);
const alternateManifestJson = JSON.stringify({ ...validManifest, dials: { variance: 1, motion: 2, density: 3 } });
const storeSession = "s".repeat(43);

function deferred() {
  let resolve;
  const promise = new Promise((complete) => { resolve = complete; });
  return Object.freeze({ promise, resolve });
}

function manualCheckpoint() {
  const reached = deferred();
  const released = deferred();
  return Object.freeze({
    reached: reached.promise,
    async pause(value) {
      reached.resolve(value);
      await released.promise;
    },
    release() {
      released.resolve();
    },
  });
}

function createFakeOperations({ operationCheckpoints = {}, beforeRenameCheckpoints = [], renameFailures = [] } = {}) {
  const events = [];
  const names = new Set();
  const calls = { open: 0, writeFile: 0, chmod: 0, sync: 0, close: 0, rename: 0, rm: 0, readdir: 0, beforeRename: 0 };
  async function pause(operation, details) {
    const checkpoint = operationCheckpoints[operation]?.[calls[operation] - 1];
    if (checkpoint) await checkpoint.pause(details);
  }
  const operations = Object.freeze({
    async open(path, flags, mode) {
      calls.open += 1;
      events.push({ operation: "open", path, flags, mode });
      await pause("open", { path });
      names.add(basename(path));
      return Object.freeze({
        async writeFile(source, encoding) {
          calls.writeFile += 1;
          const choice = JSON.parse(source).choice;
          events.push({ operation: "writeFile", path, choice, encoding });
          await pause("writeFile", { path, choice });
        },
        async chmod(modeValue) {
          calls.chmod += 1;
          events.push({ operation: "chmod", path, mode: modeValue });
          await pause("chmod", { path });
        },
        async sync() {
          calls.sync += 1;
          events.push({ operation: "sync", path });
          await pause("sync", { path });
        },
        async close() {
          calls.close += 1;
          events.push({ operation: "close", path });
          await pause("close", { path });
        },
      });
    },
    async rename(from, to) {
      const index = calls.rename;
      calls.rename += 1;
      events.push({ operation: "rename", from, to });
      const failure = renameFailures[index];
      if (failure) throw failure;
      names.delete(basename(from));
      names.add(basename(to));
    },
    async rm(path, options) {
      calls.rm += 1;
      events.push({ operation: "rm", path, options });
      names.delete(basename(path));
    },
    async readdir(path) {
      calls.readdir += 1;
      events.push({ operation: "readdir", path });
      return [...names];
    },
  });
  const checkpoints = Object.freeze({
    async beforeRename(details) {
      const index = calls.beforeRename;
      calls.beforeRename += 1;
      events.push({ operation: "checkpoint", name: "beforeRename", ...details });
      const checkpoint = beforeRenameCheckpoints[index];
      if (checkpoint) await checkpoint.pause(details);
    },
  });
  return Object.freeze({ events, operations, checkpoints });
}

async function fakeStore(context, fake) {
  const fixture = await makePreviewFixture();
  context.after(() => fixture.cleanup());
  return createSelectionStore(fixture.root, validManifest, { operations: fake.operations, checkpoints: fake.checkpoints });
}

function storeSelection(choice) {
  return parseSelection(validSelection(storeSession, choice), validManifest, storeSession);
}

function observed(promise) {
  promise.catch(() => {});
  return promise;
}

async function expectCheckpoint(checkpoint, operation, label) {
  const outcome = await Promise.race([
    checkpoint.reached.then((value) => ({ kind: "checkpoint", value })),
    operation.then(
      () => ({ kind: "resolved" }),
      (error) => ({ kind: "rejected", code: error?.code }),
    ),
  ]);
  assert.equal(outcome.kind, "checkpoint", `${label}: operation settled before the injected checkpoint (${outcome.code ?? outcome.kind})`);
  return outcome.value;
}

function manifestScript(source = manifestJson) {
  return `<script id="dl-preview-manifest" type="application/json">${source}</script>`;
}

function assertInvalidManifestHtml(html) {
  assert.throws(() => parsePreviewManifest(html), { code: "INVALID_MANIFEST" });
}

test("manifest parser accepts the strict manifest and rejects unknown or ambiguous data", () => {
  assert.deepEqual(parseManifestDocument(JSON.stringify(validManifest)), validManifest);
  assert.throws(() => parseManifestDocument(JSON.stringify({ ...validManifest, extra: true })), { code: "INVALID_MANIFEST" });
  const duplicate = { ...validManifest, directions: validManifest.directions.map((item) => ({ ...item, recommended: true })) };
  assert.throws(() => parseManifestDocument(JSON.stringify(duplicate)), { code: "INVALID_MANIFEST" });
});

test("preview manifest discovery is unique and independent of script attribute order", () => {
  assert.deepEqual(parsePreviewManifest(`<script type="application/json" nonce="fixed" id="dl-preview-manifest">${JSON.stringify(validManifest)}</script>`), validManifest);
  assert.throws(() => parsePreviewManifest(`<script id="dl-preview-manifest" type="application/json">${JSON.stringify(validManifest)}</script><script type="application/json" id="dl-preview-manifest">${JSON.stringify(validManifest)}</script>`), { code: "INVALID_MANIFEST" });
  assert.throws(() => parsePreviewManifest(`<script id="dl-preview-manifest" type="application/json">${JSON.stringify(validManifest)}</script><script id="dl-preview-manifest" type="text/plain"></script>`), { code: "INVALID_MANIFEST" });
});

const encodedManifestCases = [
  ["decimal references", "dl-preview&#45;manifest", "application&#47;json"],
  ["lowercase hexadecimal references", "dl-preview&#x2d;manifest", "application&#x2f;json"],
  ["uppercase hexadecimal references", "dl-preview&#X2D;manifest", "application&#X2F;json"],
  ["named references", "dl-preview-manifest", "application&sol;json"],
  ["semicolonless numeric references", "dl-preview&#45manifest", "application&#47json"],
];

for (const [spelling, id, type] of encodedManifestCases) {
  test(`preview manifest discovery accepts browser-equivalent ${spelling}`, () => {
    assert.deepEqual(parsePreviewManifest(`<script id="${id}" type="${type}">${manifestJson}</script>`), validManifest);
  });
}

const encodedNonMatchingManifestCases = [
  ["ambiguous named id", "dl-preview&hyphenx;manifest", "application/json"],
  ["ambiguous named type", "dl-preview-manifest", "application&sol=json"],
  ["non-ASCII named hyphen", "dl-preview&hyphen;manifest", "application/json"],
  ["invalid numeric id", "dl-preview&#0;manifest", "application/json"],
  ["invalid numeric type", "dl-preview-manifest", "application&#x110000;json"],
  ["encoded non-matching id", "dl-preview&#47;manifest", "application/json"],
  ["encoded non-matching type", "dl-preview-manifest", "application&#45;json"],
];

for (const [spelling, id, type] of encodedNonMatchingManifestCases) {
  test(`preview manifest discovery rejects ${spelling}`, () => {
    assertInvalidManifestHtml(`<script id="${id}" type="${type}">${manifestJson}</script>`);
  });
}

const inertManifestCases = [
  ["an HTML comment", `<!--${manifestScript(alternateManifestJson)}-->`],
  ["template content", `<template>${manifestScript(alternateManifestJson)}</template>`],
];

for (const [context, inertHtml] of inertManifestCases) {
  test(`preview manifest discovery rejects a fake manifest in ${context}`, () => {
    assertInvalidManifestHtml(inertHtml);
  });

  test(`preview manifest discovery ignores a fake manifest in ${context} when a real manifest follows`, () => {
    assert.deepEqual(parsePreviewManifest(`${inertHtml}${manifestScript()}`), validManifest);
  });
}

const textContainerCases = [
  ["style", `<style>${manifestScript(alternateManifestJson)}</style>`],
  ["textarea", `<textarea>${manifestScript(alternateManifestJson)}</textarea>`],
  ["title", `<title>${manifestScript(alternateManifestJson)}</title>`],
  ["script", `<script>const fake = '<script id="dl-preview-manifest" type="application/json">${alternateManifestJson}';</script>`],
  ["xmp", `<xmp>${manifestScript(alternateManifestJson)}</xmp>`],
  ["iframe", `<iframe>${manifestScript(alternateManifestJson)}</iframe>`],
  ["noembed", `<noembed>${manifestScript(alternateManifestJson)}</noembed>`],
  ["noframes", `<noframes>${manifestScript(alternateManifestJson)}</noframes>`],
  ["noscript", `<noscript>${manifestScript(alternateManifestJson)}</noscript>`],
  ["plaintext", `<plaintext>${manifestScript(alternateManifestJson)}`],
];

for (const [element, textHtml] of textContainerCases) {
  test(`preview manifest discovery rejects fake markup text inside ${element}`, () => {
    assertInvalidManifestHtml(textHtml);
  });
}

const foreignNamespaceCases = [
  ["SVG", `<svg>${manifestScript()}</svg>`],
  ["MathML", `<math>${manifestScript()}</math>`],
];

for (const [namespace, html] of foreignNamespaceCases) {
  test(`preview manifest discovery rejects a manifest in the ${namespace} namespace`, () => {
    assertInvalidManifestHtml(html);
  });
}

test("preview manifest discovery accepts an encoded MathML HTML integration point", () => {
  assert.deepEqual(parsePreviewManifest(`<math><annotation-xml encoding="text&#47;html">${manifestScript()}</annotation-xml></math>`), validManifest);
  assert.deepEqual(parsePreviewManifest(`<math><annotation-xml encoding="application&sol;xhtml&plus;xml">${manifestScript()}</annotation-xml></math>`), validManifest);
});

test("preview manifest discovery does not decode manifest JSON text", () => {
  const literalEntity = { ...validManifest, directions: validManifest.directions.map((direction, index) => index === 0 ? { ...direction, label: "保持 &sol; 原文" } : direction) };
  assert.deepEqual(parsePreviewManifest(`<script id="dl-preview&#45;manifest" type="application&sol;json">${JSON.stringify(literalEntity)}</script>`), literalEntity);
});

test("preview manifest discovery rejects an encoded non-matching MathML integration point", () => {
  assertInvalidManifestHtml(`<math><annotation-xml encoding="text&#45;html">${manifestScript()}</annotation-xml></math>`);
});

const duplicateAttributeCases = [
  ["id", `<script id="dl-preview-manifest" id="dl-preview-manifest" type="application/json">${manifestJson}</script>`],
  ["type", `<script id="dl-preview-manifest" type="application/json" type="application/json">${manifestJson}</script>`],
];

for (const [attribute, html] of duplicateAttributeCases) {
  test(`preview manifest discovery rejects a duplicate ${attribute} attribute`, () => {
    assertInvalidManifestHtml(html);
  });
}

const malformedHtmlCases = [
  ["comment", `<!--${manifestScript()}`],
  ["quoted attribute", `<script id="dl-preview-manifest" type="application/json" data-note="unterminated>${manifestJson}</script>`],
  ["script", `${manifestScript()}<script`],
  ["template", `<template>${manifestScript()}`],
];

for (const [construct, html] of malformedHtmlCases) {
  test(`preview manifest discovery fails closed on a malformed ${construct}`, () => {
    assertInvalidManifestHtml(html);
  });
}

test("selection parser trims feedback and distinguishes stale sessions from schema failures", () => {
  const parsed = parseSelection(validSelection("s".repeat(43)), validManifest, "s".repeat(43));
  assert.equal(parsed.feedback, "保留层级");
  assert.throws(() => parseSelection(validSelection("x".repeat(43)), validManifest, "s".repeat(43)), { code: "SESSION_MISMATCH" });
  assert.throws(() => parseSelection({ ...validSelection("s".repeat(43)), extra: true }, validManifest, "s".repeat(43)), { code: "INVALID_SELECTION" });
  assert.throws(() => parseSelection({ ...validSelection("s".repeat(43)), feedback: "\0" }, validManifest, "s".repeat(43)), { code: "INVALID_SELECTION" });
});

test("stale selection cleanup is strict and best effort", async () => {
  const firstId = "a".repeat(24);
  const secondId = "b".repeat(24);
  const staleName = `.selection.json.${firstId}.${secondId}.tmp`;
  const removed = [];
  const operations = {
    async readdir() {
      return [staleName, "selection.json", `.selection.json.${firstId}.tmp`, `.selection.json.${firstId}.${secondId}.tmp.keep`];
    },
    async rm(path, options) {
      removed.push([path, options]);
      throw new Error("injected cleanup failure");
    },
  };

  await cleanupStaleSelectionTemps("/preview", operations);

  assert.deepEqual(removed, [[join("/preview", staleName), { force: true }]]);
});

test("selection store writes FIFO atomic 0600 records and leaves no temporary files", async (context) => {
  const fixture = await makePreviewFixture();
  context.after(() => fixture.cleanup());
  const store = createSelectionStore(fixture.root, validManifest);
  const session = "s".repeat(43);
  const first = store.enqueue(parseSelection(validSelection(session, "a"), validManifest, session));
  const second = store.enqueue(parseSelection(validSelection(session, "b"), validManifest, session));
  await Promise.all([first, second]);
  const record = JSON.parse(await readFile(join(fixture.root, "selection.json"), "utf8"));
  assert.deepEqual(Object.keys(record), ["schemaVersion", "session", "choice", "directionLabel", "feedback", "dials", "selectedAt"]);
  assert.equal(record.choice, "b");
  assert.equal(record.directionLabel, "温润叙事");
  assert.match(record.selectedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal((await stat(join(fixture.root, "selection.json"))).mode & 0o777, 0o600);
  assert.deepEqual((await readdir(fixture.root)).filter((name) => name.startsWith(".selection.json.")), []);
  await store.close();
});

test("selection store temp filenames use stable store IDs and unique job IDs", async (context) => {
  const fixture = await makePreviewFixture();
  context.after(() => fixture.cleanup());
  const firstFake = createFakeOperations();
  const secondFake = createFakeOperations();
  const firstRandomValues = [Buffer.alloc(12, 0xaa), Buffer.alloc(12, 0xbb), Buffer.alloc(12, 0xcc)];
  const secondRandomValues = [Buffer.alloc(12, 0xdd), Buffer.alloc(12, 0xee)];
  let firstRandomCalls = 0;
  let secondRandomCalls = 0;
  const firstStore = createSelectionStore(fixture.root, validManifest, {
    operations: firstFake.operations,
    checkpoints: firstFake.checkpoints,
    randomBytes(size) {
      assert.equal(size, 12);
      const value = firstRandomValues[firstRandomCalls];
      firstRandomCalls += 1;
      return value;
    },
  });
  const secondStore = createSelectionStore(fixture.root, validManifest, {
    operations: secondFake.operations,
    checkpoints: secondFake.checkpoints,
    randomBytes(size) {
      assert.equal(size, 12);
      const value = secondRandomValues[secondRandomCalls];
      secondRandomCalls += 1;
      return value;
    },
  });

  await Promise.all([
    firstStore.enqueue(storeSelection("a")),
    firstStore.enqueue(storeSelection("b")),
    secondStore.enqueue(storeSelection("c")),
  ]);

  const firstNames = firstFake.events.filter(({ operation }) => operation === "checkpoint").map(({ tempPath }) => basename(tempPath));
  const secondName = basename(secondFake.events.find(({ operation }) => operation === "checkpoint").tempPath);
  const pattern = /^\.selection\.json\.([0-9a-f]{24})\.([0-9a-f]{24})\.tmp$/;
  const firstMatches = firstNames.map((name) => name.match(pattern));
  const secondMatch = secondName.match(pattern);
  assert.equal(firstRandomCalls, 3);
  assert.equal(secondRandomCalls, 2);
  assert.ok(firstMatches.every(Boolean));
  assert.ok(secondMatch);
  assert.equal(firstMatches[0][1], firstMatches[1][1]);
  assert.notEqual(firstMatches[0][2], firstMatches[1][2]);
  assert.notEqual(firstMatches[0][1], secondMatch[1]);
  assert.deepEqual(firstMatches.map((match) => match.slice(1)), [
    ["aa".repeat(12), "bb".repeat(12)],
    ["aa".repeat(12), "cc".repeat(12)],
  ]);
  assert.deepEqual(secondMatch.slice(1), ["dd".repeat(12), "ee".repeat(12)]);
});

test("selection store preserves an existing complete result and cleans its temp on rename failure", async (context) => {
  const fixture = await makePreviewFixture();
  context.after(() => fixture.cleanup());
  const store = createSelectionStore(fixture.root, validManifest);
  context.after(() => store.close());
  const outputPath = join(fixture.root, "selection.json");
  const original = await readFile(outputPath, "utf8");
  await chmod(fixture.root, 0o500);
  await assert.rejects(store.enqueue(parseSelection(validSelection("s".repeat(43)), validManifest, "s".repeat(43))));
  await chmod(fixture.root, 0o700);
  assert.equal(await readFile(outputPath, "utf8"), original);
  assert.deepEqual((await readdir(fixture.root)).filter((name) => name.startsWith(".selection.json.")), []);
});

test("selection store accepts OPEN work in FIFO order", async (context) => {
  const firstBeforeRename = manualCheckpoint();
  const fake = createFakeOperations({ beforeRenameCheckpoints: [firstBeforeRename] });
  const store = await fakeStore(context, fake);
  const first = observed(store.enqueue(storeSelection("a")));
  const second = observed(store.enqueue(storeSelection("b")));

  await expectCheckpoint(firstBeforeRename, first, "first write");
  assert.deepEqual(fake.events.filter(({ operation }) => operation === "writeFile").map(({ choice }) => choice), ["a"]);
  firstBeforeRename.release();

  const [firstRecord, secondRecord] = await Promise.all([first, second]);
  assert.equal(firstRecord.choice, "a");
  assert.equal(secondRecord.choice, "b");
  assert.deepEqual(fake.events.filter(({ operation }) => operation === "writeFile").map(({ choice }) => choice), ["a", "b"]);
  assert.equal(fake.events.filter(({ operation }) => operation === "rename").length, 2);
});

test("selection store close atomically rejects new work and gracefully drains queued work", async (context) => {
  const firstBeforeRename = manualCheckpoint();
  const fake = createFakeOperations({ beforeRenameCheckpoints: [firstBeforeRename] });
  const store = await fakeStore(context, fake);
  const first = observed(store.enqueue(storeSelection("a")));
  const second = observed(store.enqueue(storeSelection("b")));

  await expectCheckpoint(firstBeforeRename, first, "draining write");
  const closing = observed(store.close());
  await assert.rejects(store.enqueue(storeSelection("c")), { code: "STORE_CLOSED" });
  firstBeforeRename.release();

  const [firstRecord, secondRecord] = await Promise.all([first, second]);
  await closing;
  assert.equal(firstRecord.choice, "a");
  assert.equal(secondRecord.choice, "b");
  assert.deepEqual(fake.events.filter(({ operation }) => operation === "writeFile").map(({ choice }) => choice), ["a", "b"]);
  assert.equal(fake.events.filter(({ operation }) => operation === "rename").length, 2);
});

test("selection store force rejects queued work before it invokes file operations", async (context) => {
  const firstOpen = manualCheckpoint();
  const fake = createFakeOperations({ operationCheckpoints: { open: [firstOpen] } });
  const store = await fakeStore(context, fake);
  const active = observed(store.enqueue(storeSelection("a")));
  const queued = observed(store.enqueue(storeSelection("b")));

  await expectCheckpoint(firstOpen, active, "active open");
  const forcing = observed(store.forceClose());
  firstOpen.release();

  await assert.rejects(active, { code: "STORE_FORCED" });
  await assert.rejects(queued, { code: "STORE_FORCED" });
  await forcing;
  assert.equal(fake.events.filter(({ operation }) => operation === "open").length, 1);
  assert.equal(fake.events.filter(({ operation }) => operation === "writeFile").length, 0);
  assert.equal(fake.events.filter(({ operation }) => operation === "rename").length, 0);
});

test("selection store force fence cleans a temp returned by a late open without writing or renaming", async (context) => {
  const lateOpen = manualCheckpoint();
  const fake = createFakeOperations({ operationCheckpoints: { open: [lateOpen] } });
  const store = await fakeStore(context, fake);
  const operation = observed(store.enqueue(storeSelection("a")));

  const { path: tempPath } = await expectCheckpoint(lateOpen, operation, "late open");
  const forcing = observed(store.forceClose());
  lateOpen.release();

  await assert.rejects(operation, { code: "STORE_FORCED" });
  await forcing;
  assert.equal(fake.events.filter(({ operation: name }) => name === "writeFile").length, 0);
  assert.equal(fake.events.filter(({ operation: name }) => name === "rename").length, 0);
  assert.equal(fake.events.filter(({ operation: name, path }) => name === "close" && path === tempPath).length, 1);
  assert.equal(fake.events.filter(({ operation: name, path }) => name === "rm" && path === tempPath).length, 1);
});

test("selection store force fence immediately before rename prevents rename", async (context) => {
  const beforeRename = manualCheckpoint();
  const fake = createFakeOperations({ beforeRenameCheckpoints: [beforeRename] });
  const store = await fakeStore(context, fake);
  const operation = observed(store.enqueue(storeSelection("a")));

  const { tempPath } = await expectCheckpoint(beforeRename, operation, "before rename");
  const forcing = observed(store.forceClose());
  beforeRename.release();

  await assert.rejects(operation, { code: "STORE_FORCED" });
  await forcing;
  assert.equal(fake.events.filter(({ operation: name }) => name === "rename").length, 0);
  assert.equal(fake.events.filter(({ operation: name, path }) => name === "rm" && path === tempPath).length, 1);
});

test("selection store close is idempotent", async (context) => {
  const beforeRename = manualCheckpoint();
  const fake = createFakeOperations({ beforeRenameCheckpoints: [beforeRename] });
  const store = await fakeStore(context, fake);
  const operation = observed(store.enqueue(storeSelection("a")));

  await expectCheckpoint(beforeRename, operation, "idempotent close write");
  const firstClose = observed(store.close());
  const secondClose = observed(store.close());
  await assert.rejects(store.enqueue(storeSelection("b")), { code: "STORE_CLOSED" });
  beforeRename.release();

  await operation;
  await Promise.all([firstClose, secondClose]);
  assert.equal(fake.events.filter(({ operation: name }) => name === "readdir").length, 1);
});

test("selection store force close is idempotent", async (context) => {
  const lateOpen = manualCheckpoint();
  const fake = createFakeOperations({ operationCheckpoints: { open: [lateOpen] } });
  const store = await fakeStore(context, fake);
  const operation = observed(store.enqueue(storeSelection("a")));

  await expectCheckpoint(lateOpen, operation, "idempotent force open");
  const firstForce = observed(store.forceClose());
  const secondForce = observed(store.forceClose());
  await assert.rejects(store.enqueue(storeSelection("b")), { code: "STORE_FORCED" });
  lateOpen.release();

  await assert.rejects(operation, { code: "STORE_FORCED" });
  await Promise.all([firstForce, secondForce]);
  await assert.rejects(store.enqueue(storeSelection("c")), { code: "STORE_CLOSED" });
  assert.strictEqual(store.forceClose(), firstForce);
  assert.strictEqual(store.close(), firstForce);
  assert.equal(fake.events.filter(({ operation: name }) => name === "close").length, 1);
  assert.equal(fake.events.filter(({ operation: name }) => name === "rm").length, 1);
});

test("selection store failures do not poison the following queued operation", async (context) => {
  const failure = Object.assign(new Error("injected rename failure"), { code: "INJECTED_RENAME_FAILURE" });
  const fake = createFakeOperations({ renameFailures: [failure] });
  const store = await fakeStore(context, fake);
  const first = observed(store.enqueue(storeSelection("a")));
  const second = observed(store.enqueue(storeSelection("b")));

  await assert.rejects(first, (error) => error === failure);
  const secondRecord = await second;
  assert.equal(secondRecord.choice, "b");
  assert.deepEqual(fake.events.filter(({ operation }) => operation === "writeFile").map(({ choice }) => choice), ["a", "b"]);
  assert.equal(fake.events.filter(({ operation }) => operation === "rename").length, 2);
});

test("selection stores cannot clean each other's temporary files", async (context) => {
  const firstBeforeRename = manualCheckpoint();
  const secondBeforeRename = manualCheckpoint();
  const fake = createFakeOperations({ beforeRenameCheckpoints: [firstBeforeRename, secondBeforeRename] });
  const fixture = await makePreviewFixture();
  context.after(() => fixture.cleanup());
  const options = { operations: fake.operations, checkpoints: fake.checkpoints };
  const firstStore = createSelectionStore(fixture.root, validManifest, options);
  const secondStore = createSelectionStore(fixture.root, validManifest, options);
  const first = observed(firstStore.enqueue(storeSelection("a")));
  const second = observed(secondStore.enqueue(storeSelection("b")));

  const firstDetails = await expectCheckpoint(firstBeforeRename, first, "first store temp");
  const secondDetails = await expectCheckpoint(secondBeforeRename, second, "second store temp");
  assert.notEqual(firstDetails.tempPath, secondDetails.tempPath);
  const firstClosing = observed(firstStore.close());
  firstBeforeRename.release();
  await first;
  await firstClosing;

  assert.equal(fake.events.filter(({ operation, path }) => operation === "rm" && path === secondDetails.tempPath).length, 0);
  secondBeforeRename.release();
  const secondRecord = await second;
  assert.equal(secondRecord.choice, "b");
});
