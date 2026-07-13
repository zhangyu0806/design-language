import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const scripts = new URL("../scripts/", import.meta.url);
const productionModules = [
  "dl-preview-cli.mjs",
  "dl-preview-html.mjs",
  "dl-preview-lifecycle.mjs",
  "dl-preview-paths.mjs",
  "dl-preview-protocol.mjs",
  "dl-preview-selection.mjs",
  "dl-preview-server.mjs",
];

function pureLoc(source) {
  let inBlockComment = false;
  let count = 0;
  for (const line of source.split("\n")) {
    let hasCode = false;
    let index = 0;
    while (index < line.length) {
      if (inBlockComment) {
        const end = line.indexOf("*/", index);
        if (end === -1) break;
        inBlockComment = false;
        index = end + 2;
      } else if (line.startsWith("//", index)) {
        break;
      } else if (line.startsWith("/*", index)) {
        inBlockComment = true;
        index += 2;
      } else {
        if (!/\s/.test(line[index])) hasCode = true;
        index += 1;
      }
    }
    if (hasCode) count += 1;
  }
  return count;
}

test("pure LOC ignores comment-only lines without dropping inline-comment code", () => {
  const source = `
// line comment
/* block
 * comment */
const first = 1; // inline comment
const second = 2; /* inline block starts
 * comment continues
 */ const third = 3;
`;
  assert.equal(pureLoc(source), 3);
});

test("production preview modules retain the bounded seven-module architecture", async () => {
  const names = (await readdir(scripts)).filter((name) => /^dl-preview-.*\.mjs$/.test(name)).sort();
  assert.deepEqual(names, productionModules);

  const sources = await Promise.all(names.map((name) => readFile(new URL(name, scripts), "utf8")));
  for (const [index, source] of sources.entries()) {
    assert.ok(pureLoc(source) <= 250, `${names[index]} exceeds 250 pure LOC`);
    const imports = source.matchAll(/\b(?:from\s+|import\s*(?:\(\s*)?)["']([^"']+)["']/g);
    for (const [, specifier] of imports) {
      assert.match(specifier, /^(?:node:|\.\/dl-preview-[a-z-]+\.mjs$)/, `${names[index]} imports ${specifier}`);
    }
  }
});

test("preview runtime remains local-only and dependency-free", async () => {
  const rootNames = await readdir(root);
  const runtimeFiles = ["package.json", "package-lock.json", "npm-shrinkwrap.json", "yarn.lock", "pnpm-lock.yaml", "bun.lock", "bun.lockb", "deno.lock"];
  assert.deepEqual(rootNames.filter((name) => runtimeFiles.includes(name)), []);

  const source = (await Promise.all(productionModules.map((name) => readFile(new URL(name, scripts), "utf8")))).join("\n");
  const server = await readFile(new URL("dl-preview-server.mjs", scripts), "utf8");
  assert.match(server, /server\.listen\(port, "127\.0\.0\.1",/);
  assert.match(server, /host: "127\.0\.0\.1"/);
  assert.doesNotMatch(source, /--host|Access-Control-Allow|\btunnel\b|\bdaemon\b|\bwatch\b|auto-open/i);
});
