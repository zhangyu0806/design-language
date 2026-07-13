import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const validManifest = Object.freeze({
  schemaVersion: 1,
  directions: Object.freeze([
    Object.freeze({ id: "a", label: "编辑秩序", recommended: true }),
    Object.freeze({ id: "b", label: "温润叙事", recommended: false }),
    Object.freeze({ id: "c", label: "几何张力", recommended: false }),
  ]),
  dials: Object.freeze({ variance: 50, motion: 40, density: 60 }),
});

export function manifestHtml(manifest = validManifest) {
  return `<!doctype html><meta charset="utf-8"><script id="dl-preview-manifest" type="application/json">${JSON.stringify(manifest)}</script><main data-dl-preview></main>`;
}

export async function makePreviewFixture(manifest = validManifest) {
  const root = await mkdtemp(join(tmpdir(), "dl-preview-"));
  await Promise.all([
    writeFile(join(root, "index.html"), manifestHtml(manifest)),
    writeFile(join(root, "app.js"), "globalThis.previewLoaded = true;\n"),
    writeFile(join(root, "notes.txt"), "preview notes\n"),
    writeFile(join(root, ".secret"), "hidden\n"),
    writeFile(join(root, "selection.json"), '{"old":true}\n'),
  ]);
  const outside = await mkdtemp(join(tmpdir(), "dl-outside-"));
  await writeFile(join(outside, "outside.txt"), "outside\n");
  await symlink(join(outside, "outside.txt"), join(root, "escape.txt"));
  return {
    root,
    outside,
    async cleanup() {
      await Promise.all([rm(root, { recursive: true, force: true }), rm(outside, { recursive: true, force: true })]);
    },
  };
}

export function validSelection(session, choice = "a") {
  return {
    schemaVersion: 1,
    session,
    choice,
    feedback: "  保留层级  ",
    dials: { variance: 51, motion: 41, density: 61 },
  };
}
