import { constants } from "node:fs";
import { open, readlink, realpath, stat } from "node:fs/promises";
import { extname, join, relative, sep } from "node:path";

const DEFAULT_OPERATIONS = Object.freeze({ open, readlink, realpath, stat });
const PROC_FD_ROOT = "/proc/self/fd";
const PROC_FD_PROBE = "/dev/null";
const STRICT_SELECTION_TEMP = /^\.selection\.json\.[0-9a-f]{24}\.[0-9a-f]{24}\.tmp$/;

const MIME = Object.freeze({
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
});

export class PathError extends Error {
  constructor() {
    super("NOT_FOUND");
    this.code = "NOT_FOUND";
  }
}

function notFound() {
  throw new PathError();
}

export function assertPreviewServerPlatform(platform) {
  if (platform !== "linux") notFound();
}

function readOnlyFlags() {
  return constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0);
}

export async function verifyProcFd(options = {}) {
  const { platform = process.platform, probePath = PROC_FD_PROBE, operations = DEFAULT_OPERATIONS } = options;
  assertPreviewServerPlatform(platform);
  let probeHandle;
  let linkedHandle;
  let failed = false;
  try {
    probeHandle = await operations.open(probePath, readOnlyFlags());
    linkedHandle = await operations.open(`${PROC_FD_ROOT}/${probeHandle.fd}`, constants.O_RDONLY);
    const [probeMetadata, linkedMetadata] = await Promise.all([probeHandle.stat(), linkedHandle.stat()]);
    if (probeMetadata.dev !== linkedMetadata.dev || probeMetadata.ino !== linkedMetadata.ino) failed = true;
  } catch {
    failed = true;
  }
  for (const handle of [linkedHandle, probeHandle]) {
    if (!handle) continue;
    try {
      await handle.close();
    } catch {
      failed = true;
    }
  }
  if (failed) notFound();
}

function contained(rootPath, candidate) {
  const pathFromRoot = relative(rootPath, candidate);
  return pathFromRoot !== "" && pathFromRoot !== ".." && !pathFromRoot.startsWith(`..${sep}`) && !pathFromRoot.startsWith(sep);
}

function protectedCanonicalPath(rootPath, candidate) {
  const components = relative(rootPath, candidate).split(sep);
  const basename = components.at(-1);
  return basename === "selection.json"
    || basename === ".openspec.yaml"
    || STRICT_SELECTION_TEMP.test(basename)
    || components.some((component) => component.startsWith("."));
}

export async function resolvePreviewRoot(inputPath) {
  const rootPath = await realpath(inputPath);
  if (!(await stat(rootPath)).isDirectory()) notFound();
  return rootPath;
}

function parsePathname(pathname) {
  if (typeof pathname !== "string" || !pathname.startsWith("/") || pathname.includes("\\") || pathname.includes("\0")) notFound();
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    notFound();
  }
  if (decoded.includes("\\") || decoded.includes("\0")) notFound();
  if (decoded === "/") return ["index.html"];
  if (decoded.endsWith("/") || decoded.includes("//")) notFound();
  const segments = decoded.slice(1).split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === ".." || segment.startsWith("."))) notFound();
  const basename = segments.at(-1);
  if (basename === "selection.json" || basename === ".openspec.yaml" || basename.startsWith(".selection.json.")) notFound();
  return segments;
}

export async function openStaticAsset(rootPath, pathname, options = {}) {
  const { platform = process.platform, operations = DEFAULT_OPERATIONS } = options;
  assertPreviewServerPlatform(platform);
  const segments = parsePathname(pathname);
  const mime = MIME[extname(segments.at(-1)).toLowerCase()];
  if (!mime) notFound();
  let candidate;
  let handle;
  try {
    candidate = await operations.realpath(join(rootPath, ...segments));
    if (!contained(rootPath, candidate) || protectedCanonicalPath(rootPath, candidate)) notFound();
    const candidateMetadata = await operations.stat(candidate);
    handle = await operations.open(candidate, readOnlyFlags());
    const metadata = await handle.stat();
    if (!metadata.isFile() || metadata.dev !== candidateMetadata.dev || metadata.ino !== candidateMetadata.ino) notFound();
    const openedPath = await operations.realpath(await operations.readlink(`${PROC_FD_ROOT}/${handle.fd}`));
    if (!contained(rootPath, openedPath) || protectedCanonicalPath(rootPath, openedPath)) notFound();
    return Object.freeze({ handle, mime, size: metadata.size });
  } catch (error) {
    if (handle) {
      try {
        await handle.close();
      } catch {}
    }
    if (error instanceof PathError) throw error;
    notFound();
  }
}
