import assert from "node:assert/strict";
import test from "node:test";

import { resolvePageTarget } from "./dl-preview-cdp.mjs";

test("CDP launch creates an about:blank page when Chrome starts without a page target", async () => {
  const commands = [];
  const transport = {
    async send(method, params) {
      commands.push({ method, params });
      return { targetId: "created-page" };
    },
  };

  const targetId = await resolvePageTarget(transport, [{ targetId: "browser", type: "browser" }]);

  assert.equal(targetId, "created-page");
  assert.deepEqual(commands, [{ method: "Target.createTarget", params: { url: "about:blank" } }]);
});

test("CDP launch reuses an existing page target without creating another", async () => {
  const transport = {
    async send() {
      assert.fail("existing page target must not create another target");
    },
  };

  const targetId = await resolvePageTarget(transport, [
    { targetId: "worker", type: "service_worker" },
    { targetId: "existing-page", type: "page" },
  ]);

  assert.equal(targetId, "existing-page");
});
