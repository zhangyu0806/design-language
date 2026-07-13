import { once } from "node:events";
import { writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";

import { startPreviewBrowserScenario } from "../dl-preview-browser-scenario.mjs";

const ABORT_MARKER = "DL_PREVIEW_BROWSER_GATE_ABORTED";
const FAILURE_MARKER = "DL_PREVIEW_BROWSER_GATE_FAILED";
const scenario = process.argv[2];
const processGroupFile = process.argv[3];

function report(message) {
  return new Promise((resolve, reject) => {
    if (process.send === undefined) {
      reject(new Error("browser gate fixture requires IPC"));
      return;
    }
    process.send(message, (error) => {
      if (error === null || error === undefined) resolve();
      else reject(error);
    });
  });
}

let preview;
try {
  if (scenario !== "normal" && scenario !== "abort") throw new Error("invalid browser gate scenario");
  preview = await startPreviewBrowserScenario({
    onChromeSpawn(processGroup) {
      writeFileSync(processGroupFile, `${processGroup}\n`, { mode: 0o600 });
    },
    onChromeRunning({ processGroup }) {
      return report({ event: "chrome-running", processGroup });
    },
    onPreviewReady(evidence) {
      return report({ event: "preview-ready", ...evidence });
    },
  });
  await report({ event: "selection-started", method: "POST", path: "/__dl/select", pending: true });

  if (scenario === "normal") {
    const [message] = await once(process, "message", { signal: AbortSignal.timeout(10_000) });
    if (message.command !== "complete") throw new Error("browser gate command did not match scenario");
    await report({ event: "selection-completed", ...await preview.complete() });
  } else {
    const [message] = await once(process, "message", { signal: AbortSignal.timeout(10_000) });
    if (message.command !== "abort-sent") throw new Error("controlled Chrome abort was not delivered");
    await preview.failWhenChromeStops();
  }
} catch (error) {
  const marker = scenario === "abort" && error?.name === "ExpectedChromeAbortError" ? ABORT_MARKER : FAILURE_MARKER;
  process.stderr.write(`${marker}\n`);
  process.exitCode = 1;
} finally {
  if (preview !== undefined) await preview.close();
  await rm(processGroupFile, { force: true });
}
