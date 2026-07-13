import { randomBytes } from "node:crypto";
import { constants } from "node:fs";
import { open, readdir, rename, rm } from "node:fs/promises";
import { join } from "node:path";

import { discoverPreviewManifestSource } from "./dl-preview-html.mjs";

const DIRECTION_ID = /^[a-z][a-z0-9-]{0,31}$/;
const SESSION = /^[A-Za-z0-9_-]{43}$/;
const STALE_TEMP = /^\.selection\.json\.[0-9a-f]{24}\.[0-9a-f]{24}\.tmp$/;
const DIAL_KEYS = Object.freeze(["variance", "motion", "density"]);
const DEFAULT_OPERATIONS = Object.freeze({ open, rename, rm, readdir });
const DEFAULT_CHECKPOINTS = Object.freeze({ beforeRename: async () => {} });

export class SelectionError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function fail(code) {
  throw new SelectionError(code);
}

function plainRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function exactKeys(value, keys) {
  return plainRecord(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function dialRecord(value) {
  return exactKeys(value, DIAL_KEYS) && DIAL_KEYS.every((key) => Number.isInteger(value[key]) && value[key] >= 0 && value[key] <= 100);
}

export function parseManifestDocument(source) {
  let value;
  try {
    value = JSON.parse(source);
  } catch {
    fail("INVALID_MANIFEST");
  }
  if (!exactKeys(value, ["schemaVersion", "directions", "dials"]) || value.schemaVersion !== 1 || !Array.isArray(value.directions) || ![3, 4].includes(value.directions.length) || !dialRecord(value.dials)) fail("INVALID_MANIFEST");
  const ids = new Set();
  let recommended = 0;
  for (const direction of value.directions) {
    if (!exactKeys(direction, ["id", "label", "recommended"]) || typeof direction.id !== "string" || !DIRECTION_ID.test(direction.id) || ids.has(direction.id) || typeof direction.label !== "string" || direction.label !== direction.label.trim() || Array.from(direction.label).length < 1 || Array.from(direction.label).length > 80 || typeof direction.recommended !== "boolean") fail("INVALID_MANIFEST");
    ids.add(direction.id);
    if (direction.recommended) recommended += 1;
  }
  if (recommended !== 1) fail("INVALID_MANIFEST");
  return value;
}

export function parsePreviewManifest(html) {
  const source = discoverPreviewManifestSource(html);
  if (source === null) fail("INVALID_MANIFEST");
  return parseManifestDocument(source);
}

export function createSession() {
  return randomBytes(32).toString("base64url");
}

export async function cleanupStaleSelectionTemps(rootPath, operations = DEFAULT_OPERATIONS) {
  const names = await operations.readdir(rootPath).catch(() => []);
  await Promise.all(names.filter((name) => STALE_TEMP.test(name)).map((name) => operations.rm(join(rootPath, name), { force: true }).catch(() => {})));
}

export function parseSelection(value, manifest, currentSession) {
  if (!exactKeys(value, ["schemaVersion", "session", "choice", "feedback", "dials"]) || value.schemaVersion !== 1 || typeof value.session !== "string" || !SESSION.test(value.session)) fail("INVALID_SELECTION");
  if (value.session !== currentSession) fail("SESSION_MISMATCH");
  if (typeof value.choice !== "string" || !manifest.directions.some((direction) => direction.id === value.choice) || typeof value.feedback !== "string" || value.feedback.includes("\0") || !dialRecord(value.dials)) fail("INVALID_SELECTION");
  const feedback = value.feedback.trim();
  if (Array.from(feedback).length > 2000) fail("INVALID_SELECTION");
  return { schemaVersion: 1, session: value.session, choice: value.choice, feedback, dials: { ...value.dials } };
}

export function createSelectionStore(rootPath, manifest, options = {}) {
  const operations = options.operations ?? DEFAULT_OPERATIONS;
  const checkpoints = options.checkpoints ?? DEFAULT_CHECKPOINTS;
  const random = options.randomBytes ?? randomBytes;
  const outputPath = join(rootPath, "selection.json");
  const tempPrefix = `.selection.json.${random(12).toString("hex")}.`;
  const queue = [];
  let state = "OPEN";
  let pumping = false;
  let idle = Promise.resolve();
  let resolveIdle;
  let closePromise;
  let forcePromise;
  let cleanupPromise;

  function lifecycleError() {
    return new SelectionError(state === "FORCED" ? "STORE_FORCED" : "STORE_CLOSED");
  }

  function forceFence() {
    if (state === "FORCED") throw new SelectionError("STORE_FORCED");
  }

  async function cleanupJob(job) {
    if (job.handle) {
      await job.handle.close().catch(() => {});
      job.handle = undefined;
    }
    await operations.rm(job.tempPath, { force: true }).catch(() => {});
  }

  async function write(job) {
    const direction = manifest.directions.find((item) => item.id === job.selection.choice);
    const record = { ...job.selection, directionLabel: direction.label, feedback: job.selection.feedback, dials: job.selection.dials, selectedAt: new Date().toISOString() };
    const ordered = { schemaVersion: record.schemaVersion, session: record.session, choice: record.choice, directionLabel: record.directionLabel, feedback: record.feedback, dials: record.dials, selectedAt: record.selectedAt };
    try {
      job.handle = await operations.open(job.tempPath, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
      forceFence();
      await job.handle.writeFile(`${JSON.stringify(ordered)}\n`, "utf8");
      forceFence();
      await job.handle.chmod(0o600);
      forceFence();
      await job.handle.sync();
      forceFence();
      await job.handle.close();
      job.handle = undefined;
      forceFence();
      await checkpoints.beforeRename({ tempPath: job.tempPath, outputPath });
      forceFence();
      await operations.rename(job.tempPath, outputPath);
      forceFence();
      return ordered;
    } catch (error) {
      await cleanupJob(job);
      if (state === "FORCED") throw new SelectionError("STORE_FORCED");
      throw error;
    }
  }

  async function pump() {
    while (queue.length > 0) {
      const job = queue.shift();
      try {
        job.resolve(await write(job));
      } catch (error) {
        job.reject(error);
      }
    }
    pumping = false;
    resolveIdle();
    resolveIdle = undefined;
  }

  function startPump() {
    if (pumping) return;
    pumping = true;
    idle = new Promise((resolve) => { resolveIdle = resolve; });
    void pump();
  }

  function cleanupOwnedTemps() {
    if (cleanupPromise) return cleanupPromise;
    cleanupPromise = (async () => {
      const names = await operations.readdir(rootPath).catch(() => []);
      await Promise.all(names.filter((name) => name.startsWith(tempPrefix)).map((name) => operations.rm(join(rootPath, name), { force: true }).catch(() => {})));
    })();
    return cleanupPromise;
  }

  function close() {
    if (state === "FORCED") return forcePromise;
    if (state === "DRAINING") return closePromise;
    if (state === "CLOSED") return closePromise ?? forcePromise;
    state = "DRAINING";
    closePromise = (async () => {
      await idle;
      await cleanupOwnedTemps();
      if (state === "DRAINING") state = "CLOSED";
    })();
    return closePromise;
  }

  function forceClose() {
    if (state === "FORCED") return forcePromise;
    if (state === "CLOSED") return forcePromise ?? closePromise;
    state = "FORCED";
    for (const job of queue.splice(0)) job.reject(new SelectionError("STORE_FORCED"));
    forcePromise = (async () => {
      await idle;
      await cleanupOwnedTemps();
      if (state === "FORCED") state = "CLOSED";
    })();
    return forcePromise;
  }

  return Object.freeze({
    enqueue(selection) {
      if (state !== "OPEN") return Promise.reject(lifecycleError());
      const tempPath = join(rootPath, `${tempPrefix}${random(12).toString("hex")}.tmp`);
      let resolve;
      let reject;
      const operation = new Promise((complete, failOperation) => { resolve = complete; reject = failOperation; });
      operation.catch(() => {});
      queue.push({ selection, tempPath, handle: undefined, resolve, reject });
      startPump();
      return operation;
    },
    close,
    forceClose,
  });
}
