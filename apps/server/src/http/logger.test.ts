import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { HOST, TOKEN, testServer, type TestServer } from "../test-utils/server.ts";
import { createLogger, stripToken } from "./logger.ts";

describe("stripToken", () => {
  it("removes only the token from a URL", () => {
    expect(stripToken(`/?token=${TOKEN}&tab=graph`)).toBe("/?tab=graph");
    expect(stripToken(`/api/status?token=${TOKEN}`)).toBe("/api/status");
    expect(stripToken("/w/x/graph")).toBe("/w/x/graph");
  });
});

describe("stripToken on paths that would leave the site", () => {
  it.each(["/.//evil.example/x", "/x/..//evil.example/y", "/x/..\\/evil.example/y"])(
    "keeps %s on the app",
    (path) => {
      expect(stripToken(`${path}?token=${TOKEN}`)).toMatch(/^\/(?![/\\])/);
    },
  );
});

describe("server log", () => {
  let server: TestServer;
  afterEach(async () => {
    await server.close();
  });

  it("logs requests without ever writing the token", async () => {
    server = await testServer();
    await server.close();
    const logsDir = join(server.temp.dataRoot, "Logs");
    const logger = createLogger(logsDir);
    server = await testServer({ logger });
    await server.app.inject({ method: "GET", url: `/?token=${TOKEN}`, headers: { host: HOST } });
    await server.app.inject({
      method: "GET",
      url: `/api/status?token=${TOKEN}`,
      headers: { host: HOST, authorization: `Bearer ${TOKEN}` },
    });
    await server.app.inject({
      method: "GET",
      url: "/api/status",
      headers: { host: HOST, cookie: `dp_token_30300=${TOKEN}` },
    });
    logger.flush();
    const log = await readFile(join(logsDir, "server.log"), "utf8");
    expect(log).toContain("/api/status");
    expect(log).not.toContain(TOKEN);
  });
});
