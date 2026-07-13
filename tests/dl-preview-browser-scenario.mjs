import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import http from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PREVIEW_BOOTSTRAP } from "../scripts/dl-preview-protocol.mjs";
import { launchChrome } from "./dl-preview-cdp.mjs";
import { validManifest } from "./dl-preview-fixtures.mjs";

const cli = new URL("../scripts/dl-preview-cli.mjs", import.meta.url);
const favicon = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>";
const selection = Object.freeze({
  choice: "b",
  dials: Object.freeze({ variance: 63, motion: 27, density: 74 }),
  feedback: "  浏览器反馈  ",
});

export function fixtureHtml(manifest) {
  const controls = validManifest.directions.map(({ id, label }) => `<button type="button" data-dl-choice="${id}" aria-pressed="false">${label}</button>`).join("");
  const dials = Object.entries(validManifest.dials).map(([name, value]) => `<input type="range" data-dl-dial="${name}" min="0" max="100" step="1" value="${value}">`).join("");
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><link rel="icon" href="${favicon}"><title>DL Preview E2E</title></head><body><script id="dl-preview-manifest" type="application/json">${JSON.stringify(manifest)}</script><main data-dl-preview>${controls}<textarea data-dl-feedback maxlength="2000"></textarea>${dials}<p data-dl-status aria-live="polite">等待</p></main><script>${PREVIEW_BOOTSTRAP}</script></body></html>`;
}

export async function makeBrowserFixture(manifest = validManifest) {
  const root = await mkdtemp(join(tmpdir(), "dl-preview-browser-"));
  await writeFile(join(root, "index.html"), fixtureHtml(manifest));
  return Object.freeze({ root, cleanup: () => rm(root, { recursive: true, force: true }) });
}

export function spawnCli(root, exitOnSelect = false) {
  const args = [cli.pathname];
  if (exitOnSelect) args.push("--exit-on-select");
  args.push(root);
  const child = spawn(process.execPath, args, { stdio: ["ignore", "pipe", "pipe"] });
  child.stderr.resume();
  return child;
}

export async function readyLine(child) {
  child.stdout.setEncoding("utf8");
  let source = "";
  for await (const chunk of child.stdout) {
    source += chunk;
    const boundary = source.indexOf("\n");
    if (boundary !== -1) return JSON.parse(source.slice(0, boundary));
  }
  throw new Error("preview CLI exited before ready");
}

export function childExit(child) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve([child.exitCode, child.signalCode]);
  return once(child, "exit");
}

export function request(url) {
  return new Promise((resolve, reject) => {
    const outgoing = http.get(url, (incoming) => {
      incoming.resume();
      incoming.once("end", () => resolve(incoming.statusCode));
    });
    outgoing.once("error", reject);
  });
}

export function evaluateValue(result) {
  return result.result.value;
}

export function assertHealthy(chrome, after = 0) {
  const errors = chrome.events.slice(after).filter(({ method, params }) => method === "Runtime.exceptionThrown" || method === "Inspector.targetCrashed" || method === "Runtime.consoleAPICalled" && params.type === "error" || method === "Log.entryAdded" && params.entry.level === "error");
  assert.deepEqual(errors, []);
}

function fillAndChoose(chrome, selected) {
  return chrome.evaluate(`(() => { const feedback = document.querySelector('[data-dl-feedback]'); feedback.value = ${JSON.stringify(selected.feedback)}; const dials = ${JSON.stringify(selected.dials)}; for (const [name, value] of Object.entries(dials)) { const input = document.querySelector('[data-dl-dial="' + name + '"]'); input.value = String(value); input.dispatchEvent(new Event('input', { bubbles: true })); } document.querySelector('[data-dl-choice="${selected.choice}"]').click(); })()`);
}

function assertSelectionTrace(chrome, trace) {
  const { after, finished, response, selected, sent } = trace;
  const sequence = chrome.events.slice(after).filter(({ method, params }) => params.requestId === sent.params.requestId && ["Network.requestWillBeSent", "Network.responseReceived", "Network.loadingFinished", "Network.loadingFailed"].includes(method)).map(({ method }) => method);
  assert.equal(sent.params.request.method, "POST");
  assert.equal(sent.params.request.url, `${selected.origin}__dl/select`);
  assert.equal(sent.params.request.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(sent.params.request.postData), { schemaVersion: 1, session: selected.session, choice: selected.choice, feedback: selected.feedback.trim(), dials: selected.dials });
  assert.equal(response.params.response.status, 204);
  assert.deepEqual(sequence, ["Network.requestWillBeSent", "Network.responseReceived", "Network.loadingFinished"]);
  assert.ok(finished.params.encodedDataLength >= 0);
  assertHealthy(chrome, after);
}

export async function selectAndTrace(chrome, selected) {
  const after = chrome.events.length;
  await fillAndChoose(chrome, selected);
  const sent = await chrome.waitFor("Network.requestWillBeSent", ({ request: sentRequest }) => new URL(sentRequest.url).pathname === "/__dl/select", { after });
  const response = await chrome.waitFor("Network.responseReceived", ({ requestId }) => requestId === sent.params.requestId, { after });
  const finished = await chrome.waitFor("Network.loadingFinished", ({ requestId }) => requestId === sent.params.requestId, { after });
  assertSelectionTrace(chrome, { after, finished, response, selected, sent });
}

export async function closeBrowserFixture(fixture, chrome, child) {
  const failures = [];
  if (chrome !== undefined) {
    try { await chrome.close(); } catch (error) { failures.push(error); }
  }
  if (child?.exitCode === null && child.signalCode === null) {
    child.kill("SIGTERM");
    try {
      await once(child, "exit", { signal: AbortSignal.timeout(6_000) });
    } catch (error) {
      if (error.name !== "AbortError" && error.name !== "TimeoutError") failures.push(error);
      if (child.exitCode === null && child.signalCode === null) {
        child.kill("SIGKILL");
        try { await once(child, "exit", { signal: AbortSignal.timeout(3_000) }); } catch (killError) { failures.push(killError); }
      }
    }
  }
  try { await fixture.cleanup(); } catch (error) { failures.push(error); }
  if (failures.length > 0) throw new AggregateError(failures, "browser fixture cleanup failed");
}

export async function startPreviewBrowserScenario(options = {}) {
  const fixture = await makeBrowserFixture();
  const child = spawnCli(fixture.root);
  let chrome;
  try {
    const ready = await readyLine(child);
    chrome = await launchChrome(ready.url, { onSpawn: options.onChromeSpawn });
    await options.onChromeRunning?.({ processGroup: chrome.processGroup });
    await chrome.waitForValue(`document.querySelector('[data-dl-status]').textContent`, "可保存选择。");
    await options.onPreviewReady?.({ productionCli: true, sessionReady: true });
    await chrome.send("Fetch.enable", { patterns: [{ requestStage: "Request", urlPattern: `${ready.url}__dl/select` }] });
    const after = chrome.events.length;
    const selected = { ...selection, origin: ready.url, session: ready.session };
    await fillAndChoose(chrome, selected);
    const sent = await chrome.waitFor("Network.requestWillBeSent", ({ request: sentRequest }) => new URL(sentRequest.url).pathname === "/__dl/select", { after });
    const paused = await chrome.waitFor("Fetch.requestPaused", ({ networkId }) => networkId === sent.params.requestId, { after });
    const responsePromise = chrome.waitFor("Network.responseReceived", ({ requestId }) => requestId === sent.params.requestId, { after });
    const finishedPromise = chrome.waitFor("Network.loadingFinished", ({ requestId }) => requestId === sent.params.requestId, { after });
    responsePromise.catch(() => {});
    finishedPromise.catch(() => {});
    let released = false;
    return Object.freeze({
      processGroup: chrome.processGroup,
      async failWhenChromeStops() {
        try {
          await responsePromise;
        } catch (error) {
          if (error?.name === "CdpError") {
            const expected = new Error("controlled Chrome abort");
            expected.name = "ExpectedChromeAbortError";
            throw expected;
          }
          throw error;
        }
        throw new Error("aborted browser scenario unexpectedly completed");
      },
      async complete() {
        if (released) throw new Error("selection was already released");
        released = true;
        await chrome.send("Fetch.continueRequest", { requestId: paused.params.requestId });
        const [response, finished] = await Promise.all([responsePromise, finishedPromise]);
        assertSelectionTrace(chrome, { after, finished, response, selected, sent });
        await chrome.waitForValue(`document.querySelector('[data-dl-status]').textContent`, "选择已安全保存。");
        const record = JSON.parse(await readFile(join(fixture.root, "selection.json"), "utf8"));
        assert.deepEqual({ ...record, selectedAt: "<timestamp>" }, { schemaVersion: 1, session: ready.session, choice: "b", directionLabel: "温润叙事", feedback: "浏览器反馈", dials: selection.dials, selectedAt: "<timestamp>" });
        assert.match(record.selectedAt, /^\d{4}-\d{2}-\d{2}T/);
        const mode = (await stat(join(fixture.root, "selection.json"))).mode & 0o777;
        assert.equal(mode, 0o600);
        return Object.freeze({ choice: record.choice, loadingFinished: true, mode, persisted: true, status: response.params.response.status, successDom: true });
      },
      async close() { await closeBrowserFixture(fixture, chrome, child); },
    });
  } catch (error) {
    await closeBrowserFixture(fixture, chrome, child);
    throw error;
  }
}
