import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { tempDataRoot } from "@dramatis-personae/core/testing";
import { AUTH, testPaths, testServer, type TestServer } from "../test-utils/server.ts";

describe("settings and status", () => {
  let server: TestServer;
  afterEach(async () => {
    await server.close();
  });

  it("reports the data root and the default theme", async () => {
    server = await testServer();
    const response = await server.app.inject({
      method: "GET",
      url: "/api/settings",
      headers: AUTH,
    });
    expect(response.json()).toEqual({
      dataRoot: server.paths.dataRoot,
      defaultDataRoot: server.paths.defaultRoot,
      dataPath: null,
      theme: "system",
    });
  });

  it("saves the theme without needing a restart", async () => {
    server = await testServer();
    const response = await server.app.inject({
      method: "PUT",
      url: "/api/settings",
      headers: AUTH,
      payload: { theme: "dark" },
    });
    expect(response.json()).toMatchObject({ settings: { theme: "dark" }, restartRequired: false });
    const saved = JSON.parse(await readFile(server.paths.optionsFile, "utf8")) as object;
    expect(saved).toMatchObject({ theme: "dark" });
  });

  it("saves a new data path, which needs a restart", async () => {
    server = await testServer();
    const elsewhere = await mkdtemp(join(tmpdir(), "dp-elsewhere-"));
    const response = await server.app.inject({
      method: "PUT",
      url: "/api/settings",
      headers: AUTH,
      payload: { dataPath: elsewhere },
    });
    expect(response.json()).toMatchObject({
      settings: { dataPath: elsewhere, dataRoot: server.paths.dataRoot },
      restartRequired: true,
    });
    const saved = JSON.parse(await readFile(server.paths.optionsFile, "utf8")) as object;
    expect(saved).toMatchObject({ dataPath: elsewhere });
  });

  it("opens the data folder through the host", async () => {
    const opened: string[] = [];
    server = await testServer({
      openPath: (path) => {
        opened.push(path);
        return Promise.resolve();
      },
    });
    const response = await server.app.inject({
      method: "POST",
      url: "/api/data-folder/open",
      headers: AUTH,
    });
    expect(response.statusCode).toBe(204);
    expect(opened).toEqual([server.paths.dataRoot]);
  });

  it("reports problems with options.json in the status", async () => {
    server = await testServer({ optionsProblems: ["options.json is invalid: port is too big"] });
    const response = await server.app.inject({ method: "GET", url: "/api/status", headers: AUTH });
    expect(response.json()).toMatchObject({
      writable: true,
      optionsProblem: "options.json is invalid: port is too big",
    });
  });

  it("reports a folder that couldn't be opened, and keeps running", async () => {
    server = await testServer({ openPath: () => Promise.reject(new Error("xdg-open not found")) });
    const response = await server.app.inject({
      method: "POST",
      url: "/api/data-folder/open",
      headers: AUTH,
    });
    expect(response.statusCode).toBe(500);
    expect(response.json()).toMatchObject({
      code: "open-failed",
      message: expect.stringContaining("xdg-open not found"),
    });
    const status = await server.app.inject({ method: "GET", url: "/api/status", headers: AUTH });
    expect(status.statusCode).toBe(200);
  });

  it("still answers when the data root can't be written to", async () => {
    const temp = await tempDataRoot();
    const file = join(temp.dataRoot, "a-file");
    await writeFile(file, "not a folder");
    server = await testServer({ temp, paths: testPaths(temp, file) });
    const response = await server.app.inject({ method: "GET", url: "/api/status", headers: AUTH });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      version: "0.0.0-test",
      dataRoot: file,
      writable: false,
      problem: expect.stringContaining(file),
    });
  });
});
