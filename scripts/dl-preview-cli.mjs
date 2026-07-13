#!/usr/bin/env node
import { startPreviewServer } from "./dl-preview-server.mjs";

class CliError extends Error {}

function parsePort(value) {
  if (!/^[0-9]+$/.test(value)) throw new CliError();
  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65_535) throw new CliError();
  return port;
}

export function parseCliArgs(args) {
  let port = 0;
  let portProvided = false;
  let exitOnSelect = false;
  let rootPath;
  let options = true;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (options && argument === "--") {
      options = false;
    } else if (options && argument === "--exit-on-select") {
      if (exitOnSelect) throw new CliError();
      exitOnSelect = true;
    } else if (options && argument === "--port") {
      if (portProvided || index + 1 >= args.length) throw new CliError();
      portProvided = true;
      index += 1;
      port = parsePort(args[index]);
    } else if (options && argument.startsWith("-")) {
      throw new CliError();
    } else if (rootPath === undefined) {
      rootPath = argument;
    } else {
      throw new CliError();
    }
  }
  if (rootPath === undefined || rootPath.length === 0) throw new CliError();
  return Object.freeze({ rootPath, port, exitOnSelect });
}

function output(event) {
  process.stdout.write(`${JSON.stringify(event)}\n`);
}

async function main() {
  let options;
  try {
    options = parseCliArgs(process.argv.slice(2));
  } catch {
    output({ event: "error", code: "INVALID_ARGUMENTS" });
    process.exitCode = 2;
    return;
  }
  let preview;
  try {
    preview = await startPreviewServer(options);
  } catch {
    output({ event: "error", code: "PREVIEW_START_FAILED" });
    process.exitCode = 1;
    return;
  }
  output({ event: "ready", url: `http://${preview.host}:${preview.port}/`, host: preview.host, port: preview.port, output: "selection.json", session: preview.session });
  let stopping = false;
  const stop = async (code) => {
    if (stopping) return;
    stopping = true;
    await preview.close();
    process.exit(code);
  };
  process.once("SIGINT", () => { void stop(130); });
  process.once("SIGTERM", () => { void stop(143); });
  if (options.exitOnSelect) await preview.completion;
}

await main();
