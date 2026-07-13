import assert from "node:assert/strict";
import test from "node:test";

import { PREVIEW_BOOTSTRAP, validateAuthority, validateSelectionHeaders } from "../scripts/dl-preview-protocol.mjs";

function requestFixture(overrides = {}) {
  return {
    url: "/__dl/select",
    rawHeaders: ["Host", "127.0.0.1:43123", "Origin", "http://127.0.0.1:43123", "Content-Type", "application/json", "Content-Length", "2"],
    ...overrides,
  };
}

test("authority parser requires exact singular Host and exact optional Origin", () => {
  assert.doesNotThrow(() => validateAuthority(requestFixture(), 43123, true));
  assert.throws(() => validateAuthority(requestFixture({ rawHeaders: ["Host", "localhost:43123"] }), 43123, false), { status: 421 });
  assert.throws(() => validateAuthority(requestFixture({ url: "http://127.0.0.1:43123/__dl/select" }), 43123, true), { status: 421 });
  assert.throws(() => validateAuthority(requestFixture({ rawHeaders: ["Host", "127.0.0.1:43123", "Host", "127.0.0.1:43123"] }), 43123, false), { status: 421 });
  assert.throws(() => validateAuthority(requestFixture({ rawHeaders: ["Host", "127.0.0.1:43123"] }), 43123, true), { status: 403 });
});

test("selection framing parser accepts one strict JSON frame and rejects unsafe variants", () => {
  assert.equal(validateSelectionHeaders(requestFixture()), 2);
  assert.equal(validateSelectionHeaders(requestFixture({ rawHeaders: ["Content-Type", "application/json; charset=utf-8", "Content-Length", "32768"] })), 32768);
  assert.throws(() => validateSelectionHeaders(requestFixture({ rawHeaders: ["Content-Type", "application/json"] })), { status: 411 });
  assert.throws(() => validateSelectionHeaders(requestFixture({ rawHeaders: ["Content-Type", "application/json", "Content-Length", "32769"] })), { status: 413 });
  assert.throws(() => validateSelectionHeaders(requestFixture({ rawHeaders: ["Content-Type", "application/json", "Content-Length", "2", "Transfer-Encoding", "chunked"] })), { status: 400 });
  assert.throws(() => validateSelectionHeaders(requestFixture({ rawHeaders: ["Content-Type", "application/json", "Content-Length", "2, 2"] })), { status: 400 });
});

test("fixed bootstrap names only explicit contract selectors and contains safe static fallback", () => {
  for (const token of ["dl-preview-manifest", "data-dl-preview", "data-dl-choice", "data-dl-feedback", "data-dl-dial", "data-dl-status", "location.protocol === \"http:\"", "location.hostname === \"127.0.0.1\""]) assert.match(PREVIEW_BOOTSTRAP, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  for (const forbidden of ["innerHTML", "eval(", "Function(", "querySelector(\"button", "className", "textContent.includes"]) assert.equal(PREVIEW_BOOTSTRAP.includes(forbidden), false, forbidden);
  assert.match(PREVIEW_BOOTSTRAP, /静态预览/);
  assert.match(PREVIEW_BOOTSTRAP, /\/__dl\/session/);
  assert.match(PREVIEW_BOOTSTRAP, /\/__dl\/select/);
});
