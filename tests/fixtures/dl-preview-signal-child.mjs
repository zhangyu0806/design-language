import { open, readdir, rename, rm } from "node:fs/promises";

import { createSelectionStore } from "../../scripts/dl-preview-selection.mjs";
import { startPreviewServer } from "../../scripts/dl-preview-server.mjs";

function report(message) {
  process.send?.(message);
}

function flushReport(message) {
  return new Promise((resolve) => {
    if (process.send === undefined) resolve();
    else process.send(message, resolve);
  });
}

const blockedRename = new Promise(() => {});
let openOrdinal = 0;
let forceSettled = false;
const operations = Object.freeze({
  async open(path, flags, mode) {
    openOrdinal += 1;
    const ordinal = openOrdinal;
    report({ event: "operation", operation: "open", ordinal });
    const handle = await open(path, flags, mode);
    return Object.freeze({
      async writeFile(source, encoding) {
        report({ event: "operation", operation: "writeFile", ordinal });
        return handle.writeFile(source, encoding);
      },
      chmod: (modeValue) => handle.chmod(modeValue),
      sync: () => handle.sync(),
      close: () => handle.close(),
    });
  },
  async rename(from, to) {
    report({ event: "operation", operation: "rename" });
    return rename(from, to);
  },
  rm,
  readdir,
});
const storeOptions = Object.freeze({
  operations,
  checkpoints: Object.freeze({
    async beforeRename() {
      report({ event: "checkpoint", name: "beforeRename", ordinal: 1 });
      await blockedRename;
    },
  }),
});

function storeFactory(rootPath, manifest) {
  const store = createSelectionStore(rootPath, manifest, storeOptions);
  let enqueueOrdinal = 0;
  return Object.freeze({
    enqueue(selection) {
      enqueueOrdinal += 1;
      report({ event: "enqueue", ordinal: enqueueOrdinal, choice: selection.choice });
      return store.enqueue(selection);
    },
    close: () => store.close(),
    forceClose() {
      report({ event: "force" });
      const forcing = store.forceClose();
      void forcing.then(() => {
        forceSettled = true;
        report({ event: "force-settled" });
      });
      return forcing;
    },
  });
}

const preview = await startPreviewServer({ rootPath: process.argv[2], storeFactory });
let stopping = false;
async function stop(code) {
  if (stopping) return;
  stopping = true;
  await preview.close();
  await flushReport({ event: "closed", forceSettled });
  process.exit(code);
}
process.once("SIGINT", () => { void stop(130); });
process.once("SIGTERM", () => { void stop(143); });
report({ event: "ready", url: `http://${preview.host}:${preview.port}/`, session: preview.session });
