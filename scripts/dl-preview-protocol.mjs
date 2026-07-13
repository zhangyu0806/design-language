const MAX_BODY = 32_768;

export const SECURITY_HEADERS = Object.freeze({
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
});

export class ProtocolError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

function reject(status, code) {
  throw new ProtocolError(status, code);
}

function rawValues(request, name) {
  const headers = request.dlRawHeaders ?? request.rawHeaders;
  const values = [];
  for (let index = 0; index < headers.length; index += 2) {
    if (headers[index].toLowerCase() === name) values.push(headers[index + 1]);
  }
  return values;
}

export function validateAuthority(request, port, originRequired) {
  if (typeof request.url !== "string" || !request.url.startsWith("/") || request.url.startsWith("//")) reject(421, "MISDIRECTED_REQUEST");
  const expectedHost = `127.0.0.1:${port}`;
  const hosts = rawValues(request, "host");
  if (hosts.length !== 1 || hosts[0] !== expectedHost) reject(421, "MISDIRECTED_REQUEST");
  const origins = rawValues(request, "origin");
  if (origins.length > 1 || (origins.length === 1 && origins[0] !== `http://${expectedHost}`) || (originRequired && origins.length !== 1)) reject(403, "ORIGIN_FORBIDDEN");
}

export function validateSelectionHeaders(request) {
  if (rawValues(request, "transfer-encoding").length !== 0) reject(400, "BAD_REQUEST");
  const types = rawValues(request, "content-type");
  if (types.length !== 1 || !/^application\/json(?:;\s*charset=utf-8)?$/i.test(types[0])) reject(415, "UNSUPPORTED_MEDIA_TYPE");
  const lengths = rawValues(request, "content-length");
  if (lengths.length === 0) reject(411, "LENGTH_REQUIRED");
  if (lengths.length !== 1 || !/^[0-9]+$/.test(lengths[0])) reject(400, "BAD_REQUEST");
  const length = Number(lengths[0]);
  if (!Number.isSafeInteger(length)) reject(400, "BAD_REQUEST");
  if (length > MAX_BODY) reject(413, "PAYLOAD_TOO_LARGE");
  return length;
}

export function readJsonBody(request, expectedLength) {
  return new Promise((resolve, rejectBody) => {
    const chunks = [];
    let received = 0;
    let settled = false;
    const fail = () => {
      if (settled) return;
      settled = true;
      rejectBody(new ProtocolError(400, "BAD_REQUEST"));
    };
    request.on("aborted", fail);
    request.on("error", fail);
    request.on("data", (chunk) => {
      received += chunk.length;
      if (received > expectedLength) {
        fail();
        request.destroy();
      } else {
        chunks.push(chunk);
      }
    });
    request.on("end", () => {
      if (settled) return;
      if (received !== expectedLength) return fail();
      try {
        const source = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks));
        const value = JSON.parse(source);
        settled = true;
        resolve(value);
      } catch {
        fail();
      }
    });
  });
}

export function sendJson(response, status, value, headers = {}) {
  const body = `${JSON.stringify(value)}\n`;
  response.writeHead(status, { ...SECURITY_HEADERS, "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(body), ...headers });
  response.end(body);
}

export function sendError(response, error) {
  const status = error instanceof ProtocolError ? error.status : 500;
  const code = error instanceof ProtocolError ? error.code : "INTERNAL_ERROR";
  response.setHeader("Connection", "close");
  sendJson(response, status, { error: { code } });
}

export const PREVIEW_BOOTSTRAP = `(() => {
  "use strict";
  const manifestNodes = document.querySelectorAll("#dl-preview-manifest");
  const safeStatuses = document.querySelectorAll('[data-dl-status][aria-live="polite"]');
  const setMalformedStatus = () => { if (safeStatuses.length === 1) safeStatuses[0].textContent = "预览配置无效"; };
  const plainRecord = (value) => {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === null || Object.getPrototypeOf(prototype) === null;
  };
  const exactKeys = (value, keys) => plainRecord(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
  const dialKeys = ["variance", "motion", "density"];
  const validDial = (value) => exactKeys(value, dialKeys) && dialKeys.every((key) => Number.isInteger(value[key]) && value[key] >= 0 && value[key] <= 100);
  const validDirection = (item) => exactKeys(item, ["id", "label", "recommended"]) && /^[a-z][a-z0-9-]{0,31}$/.test(item.id) && typeof item.label === "string" && item.label === item.label.trim() && Array.from(item.label).length >= 1 && Array.from(item.label).length <= 80 && typeof item.recommended === "boolean";
  if (manifestNodes.length !== 1) { setMalformedStatus(); return; }
  const manifestNode = manifestNodes[0];
  if (manifestNode.tagName !== "SCRIPT") { setMalformedStatus(); return; }
  const manifestType = manifestNode.getAttribute("type");
  if ((manifestType !== "application/json" && !(manifestType === null && manifestNode.type === undefined)) || typeof manifestNode.textContent !== "string") { setMalformedStatus(); return; }
  let manifest;
  try { manifest = JSON.parse(manifestNode.textContent); } catch { setMalformedStatus(); return; }
  if (!exactKeys(manifest, ["schemaVersion", "directions", "dials"]) || manifest.schemaVersion !== 1 || !Array.isArray(manifest.directions) || ![3, 4].includes(manifest.directions.length) || !manifest.directions.every(validDirection) || !validDial(manifest.dials)) { setMalformedStatus(); return; }
  const directionIds = new Set(manifest.directions.map((item) => item.id));
  if (directionIds.size !== manifest.directions.length || manifest.directions.filter((item) => item.recommended).length !== 1) { setMalformedStatus(); return; }
  const roots = document.querySelectorAll("[data-dl-preview]");
  const choices = document.querySelectorAll("[data-dl-choice]");
  const feedbacks = document.querySelectorAll("[data-dl-feedback]");
  const dialNodes = document.querySelectorAll("[data-dl-dial]");
  const statuses = document.querySelectorAll("[data-dl-status]");
  const choiceIds = Array.from(choices, (button) => button.getAttribute("data-dl-choice"));
  const dialNames = Array.from(dialNodes, (input) => input.getAttribute("data-dl-dial"));
  const contractValid = roots.length === 1 && choices.length === manifest.directions.length && new Set(choiceIds).size === choices.length && Array.from(choices).every((button) => button.tagName === "BUTTON" && button.type === "button" && button.getAttribute("aria-pressed") === "false" && directionIds.has(button.getAttribute("data-dl-choice"))) && feedbacks.length === 1 && feedbacks[0].tagName === "TEXTAREA" && feedbacks[0].maxLength === 2000 && dialNodes.length === 3 && new Set(dialNames).size === 3 && Array.from(dialNodes).every((input) => dialKeys.includes(input.getAttribute("data-dl-dial")) && input.tagName === "INPUT" && input.type === "range" && input.min === "0" && input.max === "100" && input.step === "1" && Number(input.value) === manifest.dials[input.getAttribute("data-dl-dial")]) && statuses.length === 1 && safeStatuses.length === 1 && statuses[0] === safeStatuses[0];
  if (!contractValid) { if (safeStatuses.length === 1) safeStatuses[0].textContent = "预览契约无效，请检查生成结果。"; return; }
  const status = safeStatuses[0];
  const setStatus = (message) => { status.textContent = message; };
  const choiceMap = new Map(Array.from(choices, (button) => [button.getAttribute("data-dl-choice"), button]));
  const dialMap = new Map(Array.from(dialNodes, (input) => [input.getAttribute("data-dl-dial"), input]));
  let session = null;
  const choose = async (direction) => {
    for (const button of choices) button.setAttribute("aria-pressed", String(button === choiceMap.get(direction.id)));
    if (session === null) { setStatus("已选择：" + direction.label + "（静态预览，未保存）"); return; }
    const dials = Object.fromEntries(dialKeys.map((key) => [key, Number(dialMap.get(key).value)]));
    try { await fetch("/__dl/select", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ schemaVersion: 1, session, choice: direction.id, feedback: feedbacks[0].value.trim(), dials }) }).then(async (response) => { if (response.status !== 204) throw new Error(); await response.text(); setStatus("选择已安全保存。"); }); } catch { setStatus("选择未能保存，请重试。"); }
  };
  for (const direction of manifest.directions) choiceMap.get(direction.id).addEventListener("click", () => { void choose(direction); });
  if (location.protocol === "http:" && location.hostname === "127.0.0.1") void fetch("/__dl/session").then(async (response) => { if (!response.ok) throw new Error(); const value = await response.json(); if (!exactKeys(value, ["schemaVersion", "session"]) || value.schemaVersion !== 1 || !/^[A-Za-z0-9_-]{43}$/.test(value.session)) throw new Error(); session = value.session; setStatus("可保存选择。"); }).catch(() => { setStatus("当前为静态预览，选择不会保存。"); });
})();`;
