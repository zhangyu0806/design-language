export const GRACE_MS = 4_000;
export const DEADLINE_MS = 5_000;

const DEFAULT_SCHEDULER = Object.freeze({
  setTimeout: globalThis.setTimeout,
  clearTimeout: globalThis.clearTimeout,
});

function settle(operation) {
  try {
    return Promise.resolve(operation()).catch(() => {});
  } catch {
    return Promise.resolve();
  }
}

function attempt(operation) {
  try {
    operation();
  } catch {
    return false;
  }
  return true;
}

export function createPreviewLifecycle({ server, sockets, store, stopAccepting, scheduler = DEFAULT_SCHEDULER }) {
  let closePromise;
  let forced = false;

  function force() {
    if (forced) return;
    forced = true;
    void settle(() => store.forceClose());
    attempt(() => server.closeAllConnections?.());
    for (const socket of sockets) attempt(() => socket.destroy());
  }

  function close() {
    if (closePromise) return closePromise;
    stopAccepting();
    let finishClose;
    closePromise = new Promise((resolve) => { finishClose = resolve; });
    const serverClosing = settle(() => (
      server.listening
        ? new Promise((resolve) => server.close(resolve))
        : Promise.resolve()
    ));
    attempt(() => server.closeIdleConnections?.());
    const storeClosing = settle(() => store.close());
    let finished = false;
    let graceTimer;
    let deadlineTimer;
    const finish = () => {
      if (finished) return;
      finished = true;
      scheduler.clearTimeout(graceTimer);
      scheduler.clearTimeout(deadlineTimer);
      finishClose();
    };
    graceTimer = scheduler.setTimeout(force, GRACE_MS);
    deadlineTimer = scheduler.setTimeout(() => {
      force();
      finish();
    }, DEADLINE_MS);
    void Promise.all([serverClosing, storeClosing]).then(finish);
    return closePromise;
  }

  return Object.freeze({ close, isForced: () => forced });
}
