import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { copyCamelot, type TempCamelot } from "@dramatis-personae/core/testing";
import { CAMELOT_IDS } from "@dramatis-personae/samples";
import type { CommandResult, WorldSnapshot } from "@dramatis-personae/schema";
import { AUTH, testPaths, testServer, type TestServer } from "../test-utils/server.ts";

const WAIT = { timeout: 3000, interval: 50 };
const kayId = CAMELOT_IDS.characters.Kay!;
const kayRef = { kind: "character", id: kayId } as const;

describe("world routes", () => {
  let camelot: TempCamelot;
  let server: TestServer;
  let base: string;

  async function start(overrides: Parameters<typeof testServer>[0] = {}) {
    server = await testServer({ temp: camelot, paths: testPaths(camelot), ...overrides });
  }
  const get = (url: string) => server.app.inject({ method: "GET", url, headers: AUTH });
  const send = (method: "POST" | "PUT", url: string, payload?: object) =>
    server.app.inject({ method, url, headers: AUTH, ...(payload ? { payload } : {}) });
  const characterCount = (snapshot: WorldSnapshot) =>
    snapshot.files.filter((f) => f.ref.kind === "character").length;

  beforeEach(async () => {
    camelot = await copyCamelot();
    base = `/api/worlds/${camelot.worldId}`;
  });
  afterEach(async () => {
    await server.close();
  });

  it("lists and creates worlds", async () => {
    await start();
    const list = (await get("/api/worlds")).json<Array<{ id: string }>>();
    expect(list.map((w) => w.id)).toEqual([camelot.worldId]);
    const created = await send("POST", "/api/worlds", { name: "Logres" });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ name: "Logres", schemaVersion: 1 });
    expect((await get("/api/worlds")).json<unknown[]>()).toHaveLength(2);
  });

  it("serves a world's snapshot and one character", async () => {
    await start();
    const snapshot = (await get(base)).json<WorldSnapshot>();
    expect(snapshot).toMatchObject({ readOnly: false, unsaved: null, problems: [] });
    expect(snapshot.world.id).toBe(camelot.worldId);
    expect(characterCount(snapshot)).toBe(12);

    const lancelot = await get(`${base}/characters/${CAMELOT_IDS.characters.Lancelot}`);
    expect(lancelot.json()).toMatchObject({
      file: { ref: { kind: "character" } },
      color: expect.stringMatching(/^#[0-9a-f]{6}$/i),
      shownFieldKeys: expect.arrayContaining(["title"]),
    });
    const missing = await get(`${base}/characters/zzzzzzzzzzzzzzzz`);
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toMatchObject({ code: "not-found" });
  });

  it("rejects a world id that isn't one", async () => {
    await start();
    const response = await get("/api/worlds/not-an-id");
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: "invalid", details: { path: "w" } });
  });

  it("applies a command and its inverse", async () => {
    await start();
    const created = await send("POST", `${base}/commands`, {
      commands: [{ type: "character.create", character: { name: "Ector" } }],
    });
    expect(created.statusCode).toBe(200);
    const { inverse } = created.json<CommandResult>();
    expect(characterCount((await get(base)).json())).toBe(13);
    expect((await send("POST", `${base}/commands`, inverse)).statusCode).toBe(200);
    expect(characterCount((await get(base)).json())).toBe(12);
  });

  it("names the failing part of an invalid batch", async () => {
    await start();
    const response = await send("POST", `${base}/commands`, { commands: [{ type: "nope" }] });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: "invalid",
      details: { path: expect.stringContaining("commands.0") },
    });
  });

  it("refuses a stale expect with a conflict", async () => {
    await start();
    const response = await send("POST", `${base}/commands`, {
      commands: [{ type: "character.update", id: kayId, set: { name: "Cai" } }],
      expect: { [`character:${kayId}`]: "0".repeat(64) },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ code: "conflict" });
  });

  it("serves a portrait and nothing outside the portraits folder", async () => {
    await start();
    const portraits = join(camelot.worldPath, "assets", "portraits");
    const arthur = (await readdir(portraits)).find((n) => n.startsWith("arthur-"))!;
    const response = await get(`${base}/assets/portraits/${arthur}`);
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toBe("image/jpeg");
    expect(response.headers["cache-control"]).toBe("no-cache");
    expect(response.rawPayload.equals(await readFile(join(portraits, arthur)))).toBe(true);

    for (const name of [
      "..%2Fworld.json",
      "..%5Cworld.json",
      "..%2F..%2Fworld.json",
      "%2Fetc%2Fpasswd",
      "world.json",
      "kay.svg",
      "missing.png",
    ]) {
      const attempt = await get(`${base}/assets/portraits/${name}`);
      expect([400, 404], name).toContain(attempt.statusCode);
    }
  });

  it("keeps each world's workspace under Config/workspaces", async () => {
    await start();
    expect((await get(`${base}/workspace`)).json()).toEqual({
      tabs: [],
      activeTab: null,
      recentCharacters: [],
      cards: {},
    });
    const workspace = {
      tabs: ["graph", `character/${kayId}`],
      activeTab: "graph",
      recentCharacters: [kayId],
      cards: { graph: [{ character: kayId, x: 24, y: 16, width: 280, height: 220 }] },
    };
    expect((await send("PUT", `${base}/workspace`, workspace)).json()).toEqual(workspace);
    const saved = await readFile(
      join(server.paths.workspacesDir, `${camelot.worldId}.json`),
      "utf8",
    );
    expect(JSON.parse(saved)).toEqual(workspace);
  });

  it("fixes a dangling reference", async () => {
    await start();
    await get(base); // open the world, so the watcher sees the edit
    await new Promise((resolve) => setTimeout(resolve, 300));
    const characters = join(camelot.worldPath, "characters");
    const file = join(
      characters,
      (await readdir(characters)).find((n) => n.startsWith("kay-"))!,
    );
    const data = JSON.parse(await readFile(file, "utf8")) as { roles: string[] };
    data.roles.push("zzzzzzzzzzzzzzzz");
    await writeFile(file, JSON.stringify(data, null, 2) + "\n");
    await vi.waitFor(
      async () => expect((await get(`${base}/problems`)).json<unknown[]>()).toHaveLength(1),
      WAIT,
    );
    const fixed = await send("POST", `${base}/fixes`, { fix: "removeReference", ref: kayRef });
    expect(fixed.statusCode).toBe(200);
    expect((await get(`${base}/problems`)).json()).toEqual([]);
  });

  it("finds characters by search", async () => {
    await start();
    const hits = (await get(`${base}/search?q=Lancelot`)).json<Array<{ id: string }>>();
    expect(hits[0]?.id).toBe(CAMELOT_IDS.characters.Lancelot);
  });

  it("lets a viewer read but not edit", async () => {
    await start({ user: { id: "v", role: "viewer" } });
    expect((await get(base)).statusCode).toBe(200);
    const command = await send("POST", `${base}/commands`, {
      commands: [{ type: "character.update", id: kayId, set: { name: "Cai" } }],
    });
    expect(command.statusCode).toBe(403);
    expect(command.json()).toMatchObject({ code: "forbidden" });
    const fix = await send("POST", `${base}/fixes`, { fix: "removeReference", ref: kayRef });
    expect(fix.statusCode).toBe(403);
    expect(fix.json()).toMatchObject({ code: "forbidden" });
  });

  it("refuses world routes when the data root can't be written to", async () => {
    const file = join(camelot.dataRoot, "a-file");
    await writeFile(file, "not a folder");
    server = await testServer({ temp: camelot, paths: testPaths(camelot, file) });
    const response = await get("/api/worlds");
    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ code: "data-root-unavailable" });
  });
});
