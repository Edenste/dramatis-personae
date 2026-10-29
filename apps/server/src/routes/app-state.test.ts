import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AUTH, testServer, type TestServer } from "../test-utils/server.ts";

const logres = "l0gr3sxxxxxxxxxx";

describe("app state", () => {
  let server: TestServer;
  beforeEach(async () => {
    server = await testServer();
  });
  afterEach(async () => {
    await server.close();
  });

  const get = () => server.app.inject({ method: "GET", url: "/api/app-state", headers: AUTH });

  it("starts with no last world", async () => {
    const response = await get();
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ lastWorld: null });
  });

  it("saves the last world under the data root's Config folder", async () => {
    const put = await server.app.inject({
      method: "PUT",
      url: "/api/app-state",
      headers: AUTH,
      payload: { lastWorld: logres },
    });
    expect(put.json()).toEqual({ lastWorld: logres });
    expect((await get()).json()).toEqual({ lastWorld: logres });
    expect(server.paths.appStateFile).toBe(
      join(dirname(server.paths.workspacesDir), "app-state.json"),
    );
    expect(JSON.parse(await readFile(server.paths.appStateFile, "utf8"))).toEqual({
      lastWorld: logres,
    });
  });

  it("gives the defaults for an invalid file", async () => {
    await mkdir(dirname(server.paths.appStateFile), { recursive: true });
    await writeFile(server.paths.appStateFile, "{ broken");
    expect((await get()).json()).toEqual({ lastWorld: null });
  });
});
