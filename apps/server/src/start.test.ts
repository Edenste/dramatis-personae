import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { tempDataRoot, type TempDataRoot } from "@dramatis-personae/core/testing";
import { startServer } from "./start.ts";

describe("startServer", () => {
  let temp: TempDataRoot;
  let server: Awaited<ReturnType<typeof startServer>> | undefined;

  beforeEach(async () => {
    temp = await tempDataRoot();
  });
  afterEach(async () => {
    await server?.close();
    server = undefined;
    await temp.cleanup();
  });

  const start = () =>
    startServer({
      argv: ["--data-path", join(temp.dataRoot, "data")],
      vars: {},
      home: join(temp.dataRoot, "home"),
      port: 0,
      version: "0.0.0-test",
    });

  it("listens on a free port and needs the per-launch token", async () => {
    server = await start();
    expect(server.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    expect(server.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(server.launchUrl).toBe(`${server.url}/?token=${server.token}`);

    expect((await fetch(`${server.url}/api/status`)).status).toBe(401);
    const status = await fetch(`${server.url}/api/status`, {
      headers: { authorization: `Bearer ${server.token}` },
    });
    expect(status.status).toBe(200);
    expect(await status.json()).toMatchObject({
      dataRoot: join(temp.dataRoot, "data"),
      writable: true,
    });
  });

  it("swaps the launch link for a cookie", async () => {
    server = await start();
    const response = await fetch(server.launchUrl, { redirect: "manual" });
    expect(response.status).toBe(302);
    expect(response.headers.get("set-cookie")).toContain("dp_token=");
    expect(response.headers.get("location")).toBe("/");
  });

  it("writes its log under the data root", async () => {
    server = await start();
    await fetch(`${server.url}/api/status`);
    expect(existsSync(join(temp.dataRoot, "data", "Logs", "server.log"))).toBe(true);
  });

  it("makes a new token on every launch", async () => {
    server = await start();
    const first = server.token;
    await server.close();
    server = await start();
    expect(server.token).not.toBe(first);
  });

  it("stops listening when closed", async () => {
    server = await start();
    const { url } = server;
    await server.close();
    server = undefined;
    await expect(fetch(`${url}/api/status`)).rejects.toThrow();
  });
});
