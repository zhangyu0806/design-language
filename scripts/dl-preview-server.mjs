import { createServer } from "node:http";

import { createPreviewLifecycle } from "./dl-preview-lifecycle.mjs";
import { openStaticAsset, PathError, resolvePreviewRoot, verifyProcFd } from "./dl-preview-paths.mjs";
import { ProtocolError, readJsonBody, SECURITY_HEADERS, sendError, sendJson, validateAuthority, validateSelectionHeaders } from "./dl-preview-protocol.mjs";
import { cleanupStaleSelectionTemps, createSelectionStore, createSession, parsePreviewManifest, parseSelection, SelectionError } from "./dl-preview-selection.mjs";

function methodError(response, allow) {
  response.setHeader("Allow", allow);
  sendError(response, new ProtocolError(405, "METHOD_NOT_ALLOWED"));
}

function selectionProtocolError(error) {
  if (error instanceof PathError) return new ProtocolError(404, "NOT_FOUND");
  if (error instanceof SelectionError) {
    if (error.code === "STORE_CLOSED" || error.code === "STORE_FORCED") return new ProtocolError(409, "SELECTIONS_CLOSED");
    return error.code === "SESSION_MISMATCH" ? new ProtocolError(409, error.code) : new ProtocolError(422, error.code);
  }
  return error;
}

async function serveStatic(request, response, rootPath, pathname, pathOptions) {
  const asset = await openStaticAsset(rootPath, pathname, pathOptions);
  try {
    const headers = { ...SECURITY_HEADERS, "Content-Type": asset.mime, "Content-Length": asset.size };
    response.writeHead(200, headers);
    if (request.method === "HEAD") response.end();
    else response.end(await asset.handle.readFile());
  } finally {
    await asset.handle.close();
  }
}

function listen(server, port) {
  return new Promise((resolve, reject) => {
    const failed = (error) => reject(error);
    server.once("error", failed);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", failed);
      resolve();
    });
  });
}

function inspectWire(socket) {
  const state = { buffer: Buffer.alloc(0), skip: 0, heads: [], bodyEntry: undefined, poisoned: false };
  socket.dlWireState = state;
  socket.prependListener("data", (chunk) => {
    let next = chunk;
    if (state.skip > 0) {
      const skipped = Math.min(state.skip, next.length);
      state.skip -= skipped;
      next = next.subarray(skipped);
      if (next.length > 0 && state.bodyEntry.selectionFrame) {
        state.bodyEntry.extra = true;
        state.poisoned = true;
      }
    }
    if (state.skip === 0 && state.bodyEntry?.selectionFrame && !state.bodyEntry.finished && next.length > 0) {
      state.bodyEntry.extra = true;
      state.poisoned = true;
    }
    if (next.length === 0) return;
    state.buffer = Buffer.concat([state.buffer, next]);
    while (state.skip === 0) {
      const boundary = state.buffer.indexOf("\r\n\r\n");
      if (boundary === -1) break;
      const requestLines = state.buffer.subarray(0, boundary).toString("latin1").split("\r\n");
      const requestLine = requestLines[0];
      const lines = requestLines.slice(1);
      const rawHeaders = [];
      let length = 0;
      for (const line of lines) {
        const match = /^([^:]+): (.*)$/.exec(line);
        if (match === null) rawHeaders.push("", line);
        else {
          rawHeaders.push(match[1], match[2]);
          if (match[1].toLowerCase() === "content-length" && /^[0-9]+$/.test(match[2])) length = Number(match[2]);
        }
      }
      const entry = { rawHeaders, extra: false, blocked: state.poisoned, finished: false, selectionFrame: /^POST \/__dl\/select(?:\?[^ ]*)? HTTP\/1\.[01]$/.test(requestLine) };
      state.heads.push(entry);
      state.buffer = state.buffer.subarray(boundary + 4);
      const skipped = Math.min(length, state.buffer.length);
      state.buffer = state.buffer.subarray(skipped);
      state.skip = length - skipped;
      state.bodyEntry = entry;
      if (state.buffer.length > 0 && entry.selectionFrame) {
        entry.extra = true;
        state.poisoned = true;
      }
    }
  });
}

export async function startPreviewServer(options) {
  const platform = options.platform ?? process.platform;
  const pathOperations = options.pathOperations;
  const pathOptions = pathOperations === undefined ? { platform } : { platform, operations: pathOperations };
  await verifyProcFd(pathOptions);
  const { rootPath: inputRoot, port = 0, exitOnSelect = false } = options;
  const rootPath = await resolvePreviewRoot(inputRoot);
  await cleanupStaleSelectionTemps(rootPath);
  const indexAsset = await openStaticAsset(rootPath, "/", pathOptions);
  let manifest;
  try {
    manifest = parsePreviewManifest(await indexAsset.handle.readFile("utf8"));
  } finally {
    await indexAsset.handle.close();
  }
  const session = createSession();
  const storeFactory = options.storeFactory ?? createSelectionStore;
  const store = storeFactory(rootPath, manifest);
  const sockets = new Set();
  let acceptingSelections = true;
  let claimed = false;
  let actualPort = 0;
  let completeExit;
  const completion = new Promise((resolve) => { completeExit = resolve; });

  const server = createServer({ connectionsCheckingInterval: 250, headersTimeout: 5_000, requestTimeout: 5_000, keepAliveTimeout: 2_000 }, async (request, response) => {
    response.on("error", () => {});
    try {
      request.dlWireEntry = request.socket.dlWireState?.heads.shift();
      request.dlRawHeaders = request.dlWireEntry?.rawHeaders ?? request.rawHeaders;
      response.once("finish", () => { if (request.dlWireEntry) request.dlWireEntry.finished = true; });
      if (request.dlWireEntry?.blocked) {
        request.resume();
        return;
      }
      const pathname = request.url.split("?", 1)[0];
      validateAuthority(request, actualPort, pathname === "/__dl/select" && request.method === "POST");
      if (pathname === "/__dl/session") {
        if (request.method !== "GET") return methodError(response, "GET");
        return sendJson(response, 200, { schemaVersion: 1, session });
      }
      if (pathname === "/__dl/select") {
        if (request.method !== "POST") return methodError(response, "POST");
        if (!acceptingSelections) throw new ProtocolError(409, "SELECTIONS_CLOSED");
        const length = validateSelectionHeaders(request);
        const value = await readJsonBody(request, length);
        if (request.dlWireEntry?.extra) throw new ProtocolError(400, "BAD_REQUEST");
        const selection = parseSelection(value, manifest, session);
        if (!acceptingSelections) throw new ProtocolError(409, "SELECTIONS_CLOSED");
        if (exitOnSelect && claimed) throw new ProtocolError(409, "SELECTION_ALREADY_ACCEPTED");
        if (exitOnSelect) claimed = true;
        try {
          await store.enqueue(selection);
        } catch (error) {
          if (exitOnSelect) claimed = false;
          if (error instanceof SelectionError && (error.code === "STORE_CLOSED" || error.code === "STORE_FORCED")) throw error;
          throw new ProtocolError(500, "SELECTION_WRITE_FAILED");
        }
        if (lifecycle.isForced()) throw new ProtocolError(409, "SELECTIONS_CLOSED");
        response.writeHead(204, SECURITY_HEADERS);
        if (exitOnSelect) {
          acceptingSelections = false;
          await new Promise((resolve) => response.end(resolve));
          await close();
          completeExit();
        } else {
          response.end();
        }
        return;
      }
      if (pathname.startsWith("/__dl/")) throw new ProtocolError(404, "NOT_FOUND");
      if (request.method !== "GET" && request.method !== "HEAD") return methodError(response, "GET, HEAD");
      await serveStatic(request, response, rootPath, pathname, pathOptions);
    } catch (error) {
      if (!response.headersSent && !response.destroyed) sendError(response, selectionProtocolError(error));
      if (error instanceof ProtocolError && [400, 411, 413, 415].includes(error.status)) response.socket?.destroySoon?.();
    }
  });

  server.on("connection", (socket) => {
    sockets.add(socket);
    inspectWire(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  server.on("clientError", handleClientError);
  const lifecycle = createPreviewLifecycle({
    server,
    sockets,
    store,
    stopAccepting() { acceptingSelections = false; },
  });
  const close = lifecycle.close;
  await listen(server, port);
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("listen failed");
  actualPort = address.port;

  return Object.freeze({ host: "127.0.0.1", port: actualPort, session, close, completion });
}

export function handleClientError(error, socket) {
  if (error?.code === "ERR_HTTP_REQUEST_TIMEOUT") {
    socket.destroy();
    return;
  }
  if (!socket.writable) {
    socket.destroy();
    return;
  }
  const body = '{"error":{"code":"BAD_REQUEST"}}\n';
  socket.end(`HTTP/1.1 400 Bad Request\r\nConnection: close\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: ${Buffer.byteLength(body)}\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nReferrer-Policy: no-referrer\r\n\r\n${body}`);
}
