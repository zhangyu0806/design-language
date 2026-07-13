import assert from "node:assert/strict";
import { mkdir, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

import { makePreviewFixture } from "./dl-preview-fixtures.mjs";

const { assertPreviewServerPlatform, openStaticAsset, PathError, resolvePreviewRoot, verifyProcFd } = await import("../scripts/dl-preview-paths.mjs");

function assertStableNotFound(error) {
  assert.equal(error instanceof PathError, true);
  assert.equal(error.code, "NOT_FOUND");
  assert.equal(error.message, "NOT_FOUND");
  return true;
}

function makeAssetOperations(rootPath, openedTarget) {
  const calls = [];
  const handles = [];
  const identities = new Map();
  const targetsByFd = new Map();
  let nextFd = 40;
  const identityFor = (path) => {
    if (!identities.has(path)) identities.set(path, Object.freeze({ dev: 7, ino: identities.size + 100 }));
    return identities.get(path);
  };
  return {
    calls,
    handles,
    operations: {
      async realpath(path) {
        calls.push(["realpath", path]);
        return path;
      },
      async stat(path) {
        calls.push(["stat", path]);
        return Object.freeze({ ...identityFor(path), isFile: () => true });
      },
      async open(path) {
        calls.push(["open", path]);
        const fd = nextFd;
        nextFd += 1;
        targetsByFd.set(fd, openedTarget ?? path);
        const handle = {
          fd,
          closed: false,
          async stat() {
            calls.push(["fstat", fd]);
            return Object.freeze({ ...identityFor(path), size: 12, isFile: () => true });
          },
          async close() {
            calls.push(["close", fd]);
            this.closed = true;
          },
        };
        handles.push(handle);
        return handle;
      },
      async readlink(path) {
        calls.push(["readlink", path]);
        const fd = Number(path.slice(path.lastIndexOf("/") + 1));
        return targetsByFd.get(fd);
      },
    },
    expectedCandidate(pathname) {
      return join(rootPath, pathname.slice(1));
    },
  };
}

test("static path resolver opens only allowed contained assets", async (context) => {
  const fixture = await makePreviewFixture();
  context.after(() => fixture.cleanup());
  const root = await resolvePreviewRoot(fixture.root);
  const asset = await openStaticAsset(root, "/app.js");
  context.after(() => asset.handle.close());
  assert.equal(asset.mime, "text/javascript; charset=utf-8");
  assert.equal((await asset.handle.readFile("utf8")).trim(), "globalThis.previewLoaded = true;");
});

test("static path resolver uniformly rejects traversal, protected files, dotfiles, and symlink escape", async (context) => {
  const fixture = await makePreviewFixture();
  context.after(() => fixture.cleanup());
  const root = await resolvePreviewRoot(fixture.root);
  for (const pathname of ["/../outside.txt", "/%2e%2e/outside.txt", "/a//b", "/a\\b", "/.secret", "/selection.json", "/.selection.json.1.x.tmp", "/escape.txt", "/unknown.bin"]) {
    await assert.rejects(openStaticAsset(root, pathname), { code: "NOT_FOUND" }, pathname);
  }
});

test("static path resolver rejects in-root aliases of protected canonical targets but opens a public alias", async (context) => {
  const fixture = await makePreviewFixture();
  context.after(() => fixture.cleanup());
  const strictTemp = `.selection.json.${"a".repeat(24)}.${"b".repeat(24)}.tmp`;
  await mkdir(join(fixture.root, "nested"));
  await Promise.all([
    writeFile(join(fixture.root, ".openspec.yaml"), "private: true\n"),
    writeFile(join(fixture.root, strictTemp), "private temp\n"),
    writeFile(join(fixture.root, "nested", ".secret"), "nested private\n"),
    symlink("selection.json", join(fixture.root, "selection-alias.json")),
    symlink(".openspec.yaml", join(fixture.root, "openspec-alias.txt")),
    symlink(strictTemp, join(fixture.root, "temp-alias.txt")),
    symlink(".secret", join(fixture.root, "root-dotfile-alias.txt")),
    symlink("nested/.secret", join(fixture.root, "nested-dotfile-alias.txt")),
    symlink("notes.txt", join(fixture.root, "public-alias.txt")),
  ]);
  const root = await resolvePreviewRoot(fixture.root);

  for (const pathname of ["/selection-alias.json", "/openspec-alias.txt", "/temp-alias.txt", "/root-dotfile-alias.txt", "/nested-dotfile-alias.txt"]) {
    await assert.rejects(openStaticAsset(root, pathname), assertStableNotFound, pathname);
  }
  const publicAsset = await openStaticAsset(root, "/public-alias.txt");
  context.after(() => publicAsset.handle.close());
  assert.equal(await publicAsset.handle.readFile("utf8"), "preview notes\n");
});

test("canonical target protection rejects before stat or open", async () => {
  const rootPath = "/trusted/preview";
  const protectedTargets = [
    join(rootPath, "selection.json"),
    join(rootPath, ".openspec.yaml"),
    join(rootPath, `.selection.json.${"c".repeat(24)}.${"d".repeat(24)}.tmp`),
    join(rootPath, ".private", "app.js"),
    join(rootPath, "nested", ".secret"),
  ];

  for (const [index, protectedTarget] of protectedTargets.entries()) {
    const pathname = `/public-${index}.js`;
    const fake = makeAssetOperations(rootPath);
    const expectedCandidate = fake.expectedCandidate(pathname);
    fake.operations.realpath = async (path) => {
      fake.calls.push(["realpath", path]);
      return path === expectedCandidate ? protectedTarget : path;
    };

    await assert.rejects(
      openStaticAsset(rootPath, pathname, { platform: "linux", operations: fake.operations }),
      assertStableNotFound,
      protectedTarget,
    );
    assert.equal(fake.calls.some(([operation]) => operation === "stat" || operation === "open"), false, protectedTarget);
  }
});

test("preview server platform accepts Linux", () => {
  assert.equal(typeof assertPreviewServerPlatform, "function", "assertPreviewServerPlatform must be exported");
  assert.doesNotThrow(() => assertPreviewServerPlatform("linux"));
});

test("preview server platform rejects macOS and Windows with one stable typed error", () => {
  assert.equal(typeof assertPreviewServerPlatform, "function", "assertPreviewServerPlatform must be exported");
  for (const platform of ["darwin", "win32"]) {
    assert.throws(() => assertPreviewServerPlatform(platform), assertStableNotFound, platform);
  }
});

test("procfs preflight opens an fd link to the same non-user-root probe", async () => {
  assert.equal(typeof verifyProcFd, "function", "verifyProcFd must be exported");
  const probePath = "/system-probe";
  const userRoot = "/home/user/preview";
  const identity = Object.freeze({ dev: 11, ino: 29 });
  const openedPaths = [];
  const closed = [];
  const probeHandle = Object.freeze({ fd: 71, stat: async () => identity, close: async () => closed.push("probe") });
  const linkedHandle = Object.freeze({ fd: 72, stat: async () => identity, close: async () => closed.push("linked") });
  const verification = verifyProcFd({
    platform: "linux",
    probePath,
    operations: {
      async open(path) {
        openedPaths.push(path);
        if (path === probePath) return probeHandle;
        if (path === "/proc/self/fd/71") return linkedHandle;
        throw new Error(`unexpected open: ${path}`);
      },
    },
  });
  assert.equal(typeof verification?.then, "function", "verifyProcFd must be async");
  const result = await verification;
  assert.equal(result, undefined);
  assert.deepEqual(openedPaths, [probePath, "/proc/self/fd/71"]);
  assert.equal(openedPaths.some((path) => path.startsWith(userRoot)), false);
  assert.deepEqual(closed, ["linked", "probe"]);
});

test("procfs preflight rejects an fd link to a different object", async () => {
  assert.equal(typeof verifyProcFd, "function", "verifyProcFd must be exported");
  const closed = [];
  const handles = [
    Object.freeze({ fd: 81, stat: async () => ({ dev: 11, ino: 29 }), close: async () => closed.push("probe") }),
    Object.freeze({ fd: 82, stat: async () => ({ dev: 11, ino: 30 }), close: async () => closed.push("linked") }),
  ];
  await assert.rejects(
    verifyProcFd({
      platform: "linux",
      probePath: "/system-probe",
      operations: { open: async () => handles.shift() },
    }),
    assertStableNotFound,
  );
  assert.deepEqual(closed, ["linked", "probe"]);
});

test("every supported-platform asset open performs post-open procfs containment", async () => {
  const rootPath = "/trusted/preview";
  const fake = makeAssetOperations(rootPath);
  for (const pathname of ["/app.js", "/notes.txt"]) {
    const asset = await openStaticAsset(rootPath, pathname, { platform: "linux", operations: fake.operations });
    await asset.handle.close();
  }
  assert.deepEqual(
    fake.calls.filter(([operation]) => operation === "readlink").map(([, path]) => path),
    ["/proc/self/fd/40", "/proc/self/fd/41"],
  );
});

test("procfs verification failure returns NOT_FOUND, closes the handle, and returns no asset", async () => {
  const rootPath = "/trusted/preview";
  const fake = makeAssetOperations(rootPath);
  fake.operations.readlink = async (path) => {
    fake.calls.push(["readlink", path]);
    throw new Error("procfs unavailable");
  };
  await assert.rejects(
    openStaticAsset(rootPath, "/app.js", { platform: "linux", operations: fake.operations }),
    assertStableNotFound,
  );
  assert.equal(fake.handles.length, 1);
  assert.equal(fake.handles[0].closed, true);
});

test("opened fd outside root is rejected even when candidate stat and open identity match", async () => {
  const rootPath = "/trusted/preview";
  const fake = makeAssetOperations(rootPath, "/attacker/replaced/app.js");
  await assert.rejects(
    openStaticAsset(rootPath, "/app.js", { platform: "linux", operations: fake.operations }),
    assertStableNotFound,
  );
  assert.deepEqual(
    fake.calls.filter(([operation]) => operation === "readlink"),
    [["readlink", "/proc/self/fd/40"]],
  );
  assert.equal(fake.handles[0].closed, true);
  assert.equal(fake.calls.some(([operation, path]) => operation === "stat" && path === fake.expectedCandidate("/app.js")), true);
  assert.equal(fake.calls.some(([operation, path]) => operation === "open" && path === fake.expectedCandidate("/app.js")), true);
});

test("opened fd resolving to an in-root protected target is rejected and closed", async () => {
  const rootPath = "/trusted/preview";
  const fake = makeAssetOperations(rootPath, join(rootPath, "selection.json"));

  await assert.rejects(
    openStaticAsset(rootPath, "/app.js", { platform: "linux", operations: fake.operations }),
    assertStableNotFound,
  );

  assert.deepEqual(fake.calls.filter(([operation]) => operation === "readlink"), [["readlink", "/proc/self/fd/40"]]);
  assert.equal(fake.handles[0].closed, true);
});
