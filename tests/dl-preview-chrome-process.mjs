import { setImmediate as waitImmediate } from "node:timers/promises";

export function signalChromeGroup(processGroup, signal) {
  try {
    process.kill(-processGroup, signal);
    return true;
  } catch (error) {
    if (error.code === "ESRCH") return false;
    throw error;
  }
}

export function chromeGroupExists(processGroup) {
  try {
    process.kill(-processGroup, 0);
    return true;
  } catch (error) {
    if (error.code === "ESRCH") return false;
    throw error;
  }
}

export async function waitForChromeGroupExit(processGroup, failure) {
  const timeout = AbortSignal.timeout(3_000);
  while (chromeGroupExists(processGroup)) {
    if (timeout.aborted) throw failure;
    await waitImmediate();
  }
}
