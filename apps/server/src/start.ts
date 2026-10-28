import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import type { AddressInfo } from "node:net";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Logger } from "pino";
import { buildServer } from "./app.ts";
import { parseArgs } from "./cli.ts";
import { defaultDataRoot, resolveDataPaths, type DataPaths } from "./config/data-root.ts";
import { readOptions } from "./config/options.ts";
import { createLogger } from "./http/logger.ts";

export interface StartInput {
  argv?: string[];
  vars?: Record<string, string | undefined>;
  home?: string;
  platform?: NodeJS.Platform;
  /** Overrides the flags and options; 0 picks a free port. */
  port?: number;
  host?: string;
  webRoot?: string;
  openPath?: (path: string) => Promise<void>;
  version: string;
}

export interface RunningServer {
  /** The server's origin, such as http://127.0.0.1:30300. */
  url: string;
  /** The URL to open: it carries the per-launch token, swapped for a cookie on first load. */
  launchUrl: string;
  token: string;
  paths: DataPaths;
  close(): Promise<void>;
}

/** Opens a folder in the system's file manager. */
export function defaultOpenPath(path: string): Promise<void> {
  const command =
    process.platform === "win32" ? "explorer" : process.platform === "darwin" ? "open" : "xdg-open";
  spawn(command, [path], { detached: true, stdio: "ignore" }).unref();
  return Promise.resolve();
}

/** Resolves the data root and options, then starts the server with a fresh token (spec §12). */
export async function startServer(input: StartInput): Promise<RunningServer> {
  const argv = input.argv ?? [];
  const args = parseArgs(argv);
  const vars = input.vars ?? process.env;
  const defaultRoot = defaultDataRoot({
    platform: input.platform ?? process.platform,
    home: input.home ?? homedir(),
    vars,
    dev: args.dev || vars.DRAMATIS_DEV === "1",
  });
  const warnings: string[] = [];
  const options = await readOptions(join(defaultRoot, "Config", "options.json"), (message) =>
    warnings.push(message),
  );
  const paths = resolveDataPaths({ argv, vars, defaultRoot, options });

  let logger: Logger | undefined;
  try {
    logger = createLogger(paths.logsDir);
  } catch {
    // An unusable data root is reported by /api/status; the server still starts.
  }
  for (const warning of warnings) logger?.warn(warning);

  const token = randomBytes(32).toString("base64url");
  const host = input.host ?? args.host ?? options.listenAddress;
  const app = await buildServer({
    paths,
    options,
    token,
    version: input.version,
    listenAddress: host,
    webRoot: input.webRoot,
    openPath: input.openPath,
    logger,
  });
  await app.listen({ port: input.port ?? args.port ?? options.port, host });

  const { port } = app.server.address() as AddressInfo;
  const url = `http://${host.includes(":") ? `[${host}]` : host}:${port}`;
  logger?.info({ url, dataRoot: paths.dataRoot, source: paths.source }, "server started");
  return {
    url,
    launchUrl: `${url}/?token=${token}`,
    token,
    paths,
    close: async () => {
      await app.close();
      logger?.flush();
    },
  };
}
