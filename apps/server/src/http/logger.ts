import { join } from "node:path";
import { pino, type Logger } from "pino";

/** The URL with its `token` query parameter removed, so the token never reaches a log. */
export function stripToken(url: string): string {
  const parsed = new URL(url, "http://local");
  parsed.searchParams.delete("token");
  return parsed.pathname + parsed.search;
}

/** The URL's path without any query string. */
export function pathOnly(url: string): string {
  return new URL(url, "http://local").pathname;
}

/**
 * The server log, Logs/server.log. Requests are logged by the server itself
 * (method, token-free URL, status, time), never their headers or bodies.
 */
export function createLogger(logsDir: string): Logger {
  return pino(
    { level: "info", base: undefined },
    pino.destination({ dest: join(logsDir, "server.log"), mkdir: true, sync: true }),
  );
}
