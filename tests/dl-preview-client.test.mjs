import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";

import { PREVIEW_BOOTSTRAP } from "../scripts/dl-preview-protocol.mjs";
import { validManifest } from "./dl-preview-fixtures.mjs";

class Element {
  constructor(tagName, attributes = {}, properties = {}) {
    this.tagName = tagName;
    this.attributes = new Map(Object.entries(attributes));
    this.attributeWrites = [];
    this.listeners = new Map();
    Object.assign(this, properties);
  }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  setAttribute(name, value) { this.attributeWrites.push({ name, value: String(value) }); this.attributes.set(name, String(value)); }
  addEventListener(name, listener) { this.listeners.set(name, listener); }
  click() { this.listeners.get("click")(); }
}

function statusNode(ariaLive = "polite", textContent = "") {
  const attributes = { "data-dl-status": "" };
  if (ariaLive !== null) attributes["aria-live"] = ariaLive;
  return new Element("DIV", attributes, { textContent });
}

function browserFixture(protocol, hostname, options = {}) {
  const manifestValue = Object.hasOwn(options, "manifestValue") ? options.manifestValue : validManifest;
  const manifestJson = Object.hasOwn(options, "manifestJson") ? options.manifestJson : JSON.stringify(manifestValue);
  const selectionStatus = Object.hasOwn(options, "selectionStatus") ? options.selectionStatus : 204;
  const selectionTextRejects = options.selectionTextRejects ?? false;
  const manifest = new Element("SCRIPT", {}, { textContent: manifestJson });
  const root = new Element("MAIN", {}, { textContent: "预览正文" });
  const choices = validManifest.directions.map((direction) => new Element("BUTTON", { "data-dl-choice": direction.id, "aria-pressed": "false" }, { textContent: direction.label, type: "button" }));
  const feedback = new Element("TEXTAREA", {}, { maxLength: 2000, value: "  清晰一些  " });
  const dials = Object.entries(validManifest.dials).map(([name, value]) => new Element("INPUT", { "data-dl-dial": name }, { type: "range", min: "0", max: "100", step: "1", value: String(value) }));
  const statuses = options.statusNodes ?? [statusNode()];
  const validStatuses = statuses.filter((status) => status.getAttribute("aria-live") === "polite");
  const nodes = new Map([
    ["#dl-preview-manifest", [manifest]], ["[data-dl-preview]", [root]], ["[data-dl-choice]", choices], ["[data-dl-feedback]", [feedback]], ["[data-dl-dial]", dials], ["[data-dl-status]", statuses], ["[data-dl-status][aria-live=polite]", validStatuses], ["[data-dl-status][aria-live=\"polite\"]", validStatuses],
  ]);
  const requests = [];
  const selectionBodyConsumptionStatuses = [];
  const document = { querySelectorAll(selector) { return nodes.get(selector) ?? []; } };
  const fetch = async (url, options) => {
    requests.push({ url, options });
    if (url === "/__dl/session") return { ok: true, async json() { return { schemaVersion: 1, session: "s".repeat(43) }; } };
    return { status: selectionStatus, async text() { await Promise.resolve(); selectionBodyConsumptionStatuses.push(statuses[0].textContent); if (selectionTextRejects) throw new Error("selection body unavailable"); return ""; } };
  };
  return {
    context: { document, location: { protocol, hostname }, fetch, console },
    choices,
    elements: [manifest, root, ...choices, feedback, ...dials, ...statuses],
    requests,
    selectionBodyConsumptionStatuses,
    status: statuses[0],
    statuses,
  };
}

function elementState(element) {
  return {
    attributes: [...element.attributes],
    textContent: element.textContent,
    value: element.value,
  };
}

function assertMalformedFixture(fixture, expectedStatus) {
  const untouchedNodes = fixture.elements.filter((element) => element !== expectedStatus);
  const before = untouchedNodes.map(elementState);
  let thrown;
  try {
    vm.runInNewContext(PREVIEW_BOOTSTRAP, fixture.context);
  } catch (error) {
    thrown = error;
  }

  assert.equal(thrown, undefined, "malformed manifest bootstrap must not throw");
  assert.equal(fixture.requests.length, 0, "malformed manifest must not fetch");
  assert.equal(fixture.choices.every((choice) => choice.listeners.size === 0), true, "malformed manifest must not register choice listeners");
  assert.deepEqual(fixture.elements.flatMap((element) => element.attributeWrites.filter(({ name }) => name.startsWith("aria-"))), [], "malformed manifest must not mutate aria attributes");
  assert.deepEqual(untouchedNodes.map(elementState), before, "malformed manifest must not modify unrelated nodes");
  if (expectedStatus) assert.equal(expectedStatus.textContent, "预览配置无效");
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

test("file mode selects locally without any network request", async () => {
  const fixture = browserFixture("file:", "");
  vm.runInNewContext(PREVIEW_BOOTSTRAP, fixture.context);
  fixture.choices[1].click();
  await flushMicrotasks();
  assert.equal(fixture.requests.length, 0);
  assert.equal(fixture.choices[1].getAttribute("aria-pressed"), "true");
  assert.match(fixture.status.textContent, /静态预览，未保存/);
});

test("official loopback mode fetches session then posts only explicit contract values", async () => {
  const fixture = browserFixture("http:", "127.0.0.1");
  vm.runInNewContext(PREVIEW_BOOTSTRAP, fixture.context);
  await flushMicrotasks();
  fixture.choices[0].click();
  await flushMicrotasks();
  assert.deepEqual(fixture.requests.map(({ url }) => url), ["/__dl/session", "/__dl/select"]);
  const selection = JSON.parse(fixture.requests[1].options.body);
  assert.deepEqual(Object.keys(selection), ["schemaVersion", "session", "choice", "feedback", "dials"]);
  assert.equal(selection.choice, "a");
  assert.equal(selection.feedback, "清晰一些");
  assert.deepEqual(fixture.selectionBodyConsumptionStatuses, ["可保存选择。"], "selection response body must be consumed exactly once before reporting success");
  assert.equal(fixture.status.textContent, "选择已安全保存。");
});

test("selection reports failure unless status is exactly 204 and response text is consumed", async (context) => {
  const cases = [
    ["status 200", { selectionStatus: 200 }],
    ["status 201", { selectionStatus: 201 }],
    ["status 299", { selectionStatus: 299 }],
    ["status 204 with rejected text", { selectionStatus: 204, selectionTextRejects: true }],
    ["missing status", { selectionStatus: undefined }],
  ];
  for (const [name, options] of cases) {
    await context.test(name, async () => {
      const fixture = browserFixture("http:", "127.0.0.1", options);
      vm.runInNewContext(PREVIEW_BOOTSTRAP, fixture.context);
      await flushMicrotasks();
      fixture.choices[0].click();
      await flushMicrotasks();
      await flushMicrotasks();
      assert.equal(fixture.status.textContent, "选择未能保存，请重试。");
    });
  }
});

test("localhost remains static and an invalid explicit contract registers no choices", async () => {
  const localhost = browserFixture("http:", "localhost");
  vm.runInNewContext(PREVIEW_BOOTSTRAP, localhost.context);
  await flushMicrotasks();
  assert.equal(localhost.requests.length, 0);
  const invalid = browserFixture("file:", "");
  const querySelectorAll = invalid.context.document.querySelectorAll.bind(invalid.context.document);
  invalid.context.document.querySelectorAll = (selector) => selector === "[data-dl-feedback]" ? [] : querySelectorAll(selector);
  vm.runInNewContext(PREVIEW_BOOTSTRAP, invalid.context);
  assert.match(invalid.status.textContent, /契约无效/);
  assert.equal(invalid.choices.every((choice) => choice.listeners.size === 0), true);
});

test("malformed manifest roots fail closed with one exact valid status message", async (context) => {
  const cases = [
    ["null", null],
    ["boolean primitive", false],
    ["number primitive", 1],
    ["string primitive", "manifest"],
    ["array", []],
    ["object missing required fields", {}],
  ];
  for (const [name, manifestValue] of cases) {
    await context.test(name, () => {
      const fixture = browserFixture("http:", "127.0.0.1", { manifestValue });
      assertMalformedFixture(fixture, fixture.status);
    });
  }
  await context.test("invalid raw JSON", () => {
    const fixture = browserFixture("http:", "127.0.0.1", { manifestJson: "{" });
    assertMalformedFixture(fixture, fixture.status);
  });
});

test("directions containing null or primitives never throw or produce side effects", async (context) => {
  const cases = [
    ["null direction", null],
    ["boolean direction", false],
    ["number direction", 1],
    ["string direction", "a"],
  ];
  for (const [name, malformedDirection] of cases) {
    await context.test(name, () => {
      const manifestValue = { ...validManifest, directions: [malformedDirection, validManifest.directions[1], validManifest.directions[2]] };
      const fixture = browserFixture("http:", "127.0.0.1", { manifestValue });
      assertMalformedFixture(fixture, fixture.status);
    });
  }
});

test("malformed dials never fetch, bind choices, or mutate aria state", async (context) => {
  const cases = [
    ["null dials", null],
    ["primitive dials", 50],
    ["array dials", [50, 40, 60]],
    ["missing dial", { variance: 50, motion: 40 }],
    ["extra dial", { ...validManifest.dials, contrast: 50 }],
    ["out-of-range dial", { ...validManifest.dials, density: 101 }],
    ["non-integer dial", { ...validManifest.dials, motion: 40.5 }],
    ["string dial", { ...validManifest.dials, variance: "50" }],
  ];
  for (const [name, dials] of cases) {
    await context.test(name, () => {
      const fixture = browserFixture("http:", "127.0.0.1", { manifestValue: { ...validManifest, dials } });
      assertMalformedFixture(fixture, fixture.status);
    });
  }
});

test("malformed manifest modifies no node without exactly one valid polite status", async (context) => {
  const cases = [
    ["missing status", []],
    ["status missing aria-live", [statusNode(null, "缺少 aria-live")]],
    ["status with invalid aria-live", [statusNode("assertive", "错误播报区")]],
    ["duplicate valid statuses", [statusNode("polite", "状态一"), statusNode("polite", "状态二")]],
  ];
  for (const [name, statusNodes] of cases) {
    await context.test(name, () => {
      const fixture = browserFixture("http:", "127.0.0.1", { manifestValue: null, statusNodes });
      assertMalformedFixture(fixture);
    });
  }
});

test("malformed manifest updates the sole valid polite status and leaves invalid status nodes untouched", () => {
  const invalidStatus = statusNode("assertive", "不要改写");
  const validStatus = statusNode("polite", "等待状态");
  const fixture = browserFixture("http:", "127.0.0.1", { manifestValue: null, statusNodes: [invalidStatus, validStatus] });
  assertMalformedFixture(fixture, validStatus);
});
