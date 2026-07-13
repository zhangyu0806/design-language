import assert from "node:assert/strict";
import test from "node:test";

import { parsePreviewManifest } from "../scripts/dl-preview-selection.mjs";
import { launchChrome } from "./dl-preview-cdp.mjs";
import { validManifest } from "./dl-preview-fixtures.mjs";

const manifestSource = JSON.stringify(validManifest);
const literalEntityLabel = "&amp; &#38; &quot; &sol;";
const literalEntityManifest = {
  ...validManifest,
  directions: validManifest.directions.map((direction, index) => index === 0 ? { ...direction, label: literalEntityLabel } : direction),
};
const literalEntityManifestSource = JSON.stringify(literalEntityManifest);
const htmlNamespace = "http://www.w3.org/1999/xhtml";
const cases = [
  ["decimal", "dl-preview&#45;manifest", "application&#47;json"],
  ["lowercase hexadecimal", "dl-preview&#x2d;manifest", "application&#x2f;json"],
  ["uppercase hexadecimal", "dl-preview&#X2D;manifest", "application&#X2F;json"],
  ["named slash", "dl-preview-manifest", "application&sol;json"],
  ["named hyphen", "dl-preview&hyphen;manifest", "application/json"],
  ["semicolonless numeric", "dl-preview&#45manifest", "application&#47json"],
  ["semicolonless named", "dl-preview&hyphenmanifest", "application&soljson"],
  ["ambiguous named id", "dl-preview&hyphenx;manifest", "application/json"],
  ["ambiguous named type", "dl-preview-manifest", "application&sol=json"],
  ["invalid null", "dl-preview&#0;manifest", "application/json"],
  ["invalid C1 replacement", "dl-preview&#128;manifest", "application/json"],
  ["invalid surrogate", "dl-preview-manifest", "application&#xD800;json"],
  ["invalid overflow", "dl-preview-manifest", "application&#x110000;json"],
  ["encoded non-matching", "dl-preview&#47;manifest", "application&#45;json"],
];

function html(id, type) {
  return `<!doctype html><script id="${id}" type="${type}">${manifestSource}</script>`;
}

function browserCandidateExpression(source) {
  return `(() => { document.open(); document.write(${JSON.stringify(source)}); document.close(); const candidate = document.querySelector("script"); return candidate === null ? null : { namespace: candidate.namespaceURI, id: candidate.id, type: candidate.type }; })()`;
}

function browserMathExpression(source) {
  return `(() => { document.open(); document.write(${JSON.stringify(source)}); document.close(); const annotation = document.querySelector("annotation-xml"); const candidate = document.querySelector("script"); return { encoding: annotation?.getAttribute("encoding") ?? null, candidate: candidate === null ? null : { namespace: candidate.namespaceURI, id: candidate.id, type: candidate.type } }; })()`;
}

function browserManifestExpression(source) {
  return `(() => { document.open(); document.write(${JSON.stringify(source)}); document.close(); const script = document.querySelector("script"); return script === null ? null : { textContent: script.textContent, parsed: JSON.parse(script.textContent) }; })()`;
}

function parserAccepts(source) {
  try {
    parsePreviewManifest(source);
    return true;
  } catch {
    return false;
  }
}

test("manifest scanner matches real Chrome for critical encoded attributes", async () => {
  const chrome = await launchChrome("about:blank");
  try {
    for (const [name, id, type] of cases) {
      const source = html(id, type);
      const observed = (await chrome.evaluate(browserCandidateExpression(source))).result.value;
      const browserAccepts = observed?.namespace === htmlNamespace && observed.id === "dl-preview-manifest" && observed.type === "application/json";
      assert.equal(parserAccepts(source), browserAccepts, `${name}: ${JSON.stringify(observed)}`);
    }
  } finally {
    await chrome.close();
  }
});

test("manifest JSON raw text matches real Chrome without entity decoding", async () => {
  const source = `<!doctype html><script id="dl-preview-manifest" type="application/json">${literalEntityManifestSource}</script>`;
  const chrome = await launchChrome("about:blank");
  try {
    const observed = (await chrome.evaluate(browserManifestExpression(source))).result.value;
    const serviceParsed = parsePreviewManifest(source);
    assert.equal(observed.textContent, literalEntityManifestSource);
    assert.deepEqual(observed.parsed, literalEntityManifest);
    assert.deepEqual(serviceParsed, observed.parsed);
    assert.equal(JSON.stringify(serviceParsed), observed.textContent);
  } finally {
    await chrome.close();
  }
});

test("manifest scanner matches real Chrome for encoded MathML annotation integration", async () => {
  const chrome = await launchChrome("about:blank");
  try {
    for (const [name, encoding] of [["matching decimal", "text&#47;html"], ["matching lowercase hex", "text&#x2f;html"], ["matching uppercase hex", "text&#X2F;html"], ["matching named XHTML", "application&sol;xhtml&plus;xml"], ["non-matching", "text&#45;html"]]) {
      const source = `<!doctype html><math><annotation-xml encoding="${encoding}"><script id="dl-preview-manifest" type="application/json">${manifestSource}</script></annotation-xml></math>`;
      const observed = (await chrome.evaluate(browserMathExpression(source))).result.value;
      const browserAccepts = observed.candidate?.namespace === htmlNamespace && observed.candidate.id === "dl-preview-manifest" && observed.candidate.type === "application/json";
      assert.equal(parserAccepts(source), browserAccepts, `${name}: ${observed.encoding}, ${JSON.stringify(observed.candidate)}`);
    }
  } finally {
    await chrome.close();
  }
});
