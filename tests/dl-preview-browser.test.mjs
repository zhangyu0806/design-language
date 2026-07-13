import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import http from "node:http";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { assertHealthy, childExit, closeBrowserFixture, evaluateValue, makeBrowserFixture, readyLine, request, selectAndTrace, spawnCli, startPreviewBrowserScenario } from "./dl-preview-browser-scenario.mjs";
import { launchChrome } from "./dl-preview-cdp.mjs";
import { validManifest } from "./dl-preview-fixtures.mjs";

test("file mode uses real Chrome without network or persisted output", async () => {
  const fixture = await makeBrowserFixture();
  let chrome;
  try {
    chrome = await launchChrome(pathToFileURL(join(fixture.root, "index.html")).href);
    await chrome.evaluate(`document.querySelector('[data-dl-choice="b"]').click()`);
    assert.match(evaluateValue(await chrome.evaluate(`document.querySelector('[data-dl-status]').textContent`)), /静态预览，未保存/);
    const nonFile = chrome.events.filter(({ method, params }) => method === "Network.requestWillBeSent" && !params.request.url.startsWith("file:") && !params.request.url.startsWith("data:"));
    assert.deepEqual(nonFile, []);
    await assert.rejects(readFile(join(fixture.root, "selection.json")));
    assertHealthy(chrome);
  } finally {
    await closeBrowserFixture(fixture, chrome);
  }
});

for (const [name, exitOnSelect] of [["exit-on-select", true]]) {
  test(`${name} mode persists exact selection through the browser`, async () => {
    const fixture = await makeBrowserFixture();
    const child = spawnCli(fixture.root, exitOnSelect);
    let chrome;
    try {
      const ready = await readyLine(child);
      chrome = await launchChrome(ready.url);
      await chrome.waitForValue(`document.querySelector('[data-dl-status]').textContent`, "可保存选择。");
      const dials = { variance: 63, motion: 27, density: 74 };
      await selectAndTrace(chrome, { choice: "b", feedback: "  浏览器反馈  ", dials, origin: ready.url, session: ready.session });
      await chrome.waitForValue(`document.querySelector('[data-dl-status]').textContent`, "选择已安全保存。");
      assertHealthy(chrome);
      const record = JSON.parse(await readFile(join(fixture.root, "selection.json"), "utf8"));
      assert.deepEqual({ ...record, selectedAt: "<timestamp>" }, { schemaVersion: 1, session: ready.session, choice: "b", directionLabel: "温润叙事", feedback: "浏览器反馈", dials, selectedAt: "<timestamp>" });
      assert.match(record.selectedAt, /^\d{4}-\d{2}-\d{2}T/);
      assert.equal((await stat(join(fixture.root, "selection.json"))).mode & 0o777, 0o600);
      if (exitOnSelect) assert.deepEqual(await childExit(child), [0, null]);
      else {
        assert.equal(child.exitCode, null);
        assert.equal(await request(`${ready.url}__dl/session`), 200);
      }
    } finally {
      await closeBrowserFixture(fixture, chrome, child);
    }
  });
}

test("normal mode uses the shared production preview scenario", async () => {
  const scenario = await startPreviewBrowserScenario();
  try {
    assert.deepEqual(await scenario.complete(), { choice: "b", loadingFinished: true, mode: 0o600, persisted: true, status: 204, successDom: true });
  } finally {
    await scenario.close();
  }
});

test("malformed null direction fails closed in real Chrome", async () => {
  const malformed = { ...validManifest, directions: [null, ...validManifest.directions.slice(1)] };
  const fixture = await makeBrowserFixture(malformed);
  let chrome;
  try {
    chrome = await launchChrome(pathToFileURL(join(fixture.root, "index.html")).href);
    assert.equal(evaluateValue(await chrome.evaluate(`document.querySelector('[data-dl-status]').textContent`)), "预览配置无效");
    await chrome.evaluate(`document.querySelector('[data-dl-choice="b"]').click()`);
    assert.equal(evaluateValue(await chrome.evaluate(`document.querySelector('[data-dl-choice="b"]').getAttribute('aria-pressed')`)), "false");
    assert.equal(evaluateValue(await chrome.evaluate(`document.querySelector('[data-dl-status]').textContent`)), "预览配置无效");
    const nonFile = chrome.events.filter(({ method, params }) => method === "Network.requestWillBeSent" && !params.request.url.startsWith("file:") && !params.request.url.startsWith("data:"));
    assert.deepEqual(nonFile, []);
    assertHealthy(chrome);
  } finally {
    await closeBrowserFixture(fixture, chrome);
  }
});

test("network-monitor control emits a real canceled ERR_ABORTED loading failure", async () => {
  const fixture = await makeBrowserFixture();
  const server = http.createServer((incoming) => { if (incoming.url !== "/slow") incoming.socket.destroy(); });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  let chrome;
  try {
    chrome = await launchChrome(pathToFileURL(join(fixture.root, "index.html")).href);
    const after = chrome.events.length;
    await chrome.evaluate(`globalThis.abortControl = new AbortController(); void fetch('http://127.0.0.1:${port}/slow', { signal: abortControl.signal }).catch(() => {}); undefined`);
    const sent = await chrome.waitFor("Network.requestWillBeSent", ({ request }) => request.url.endsWith("/slow"), { after });
    await chrome.evaluate("abortControl.abort()");
    const failed = await chrome.waitFor("Network.loadingFailed", ({ requestId }) => requestId === sent.params.requestId, { after });
    assert.equal(failed.params.errorText, "net::ERR_ABORTED");
    assert.equal(failed.params.canceled, true);
    assertHealthy(chrome);
  } finally {
    await closeBrowserFixture(fixture, chrome);
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
