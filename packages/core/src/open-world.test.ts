import { existsSync } from "node:fs";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { unzipSync } from "fflate";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MigrationError, type Migration } from "./migrations/migrations.ts";
import { openWorld } from "./open-world.ts";
import { JsonFileStorage } from "./storage/json-files/json-file-storage.ts";
import { ScriptedFs } from "./test-utils/scripted-fs.ts";
import { copyCamelot, type TempCamelot } from "./test-utils/temp-world.ts";

type Json = Record<string, unknown>;

const tagsToRoles: Migration = {
  from: 0,
  to: 1,
  migrate: (files) =>
    files.map(({ path, data }) => {
      const d = { ...(data as Json) };
      if (path === "world.json") d.schemaVersion = 1;
      if (path.startsWith("characters/")) {
        d.roles = d.tags;
        delete d.tags;
      }
      return { path, data: d };
    }),
};

const breaksCharacters: Migration = {
  from: 0,
  to: 1,
  migrate: (files) =>
    files.map(({ path, data }) => ({
      path,
      data: path.startsWith("characters/") ? { ...(data as Json), name: "" } : data,
    })),
};

async function listFiles(dir: string, prefix = ""): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...(await listFiles(join(dir, entry.name), rel)));
    else out.push(rel);
  }
  return out.sort();
}

async function snapshotDisk(dir: string): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const file of await listFiles(dir)) result[file] = await readFile(join(dir, file), "base64");
  return result;
}

describe("openWorld", () => {
  let camelot: TempCamelot;
  let storage: JsonFileStorage;
  const backups = () => join(camelot.dataRoot, "Backups");

  async function setVersion(version: number, characterEdit?: (d: Json) => void) {
    const worldFile = join(camelot.worldPath, "world.json");
    const world = JSON.parse(await readFile(worldFile, "utf8")) as Json;
    world.schemaVersion = version;
    await writeFile(worldFile, JSON.stringify(world, null, 2) + "\n");
    if (!characterEdit) return;
    const dir = join(camelot.worldPath, "characters");
    for (const name of await readdir(dir)) {
      const data = JSON.parse(await readFile(join(dir, name), "utf8")) as Json;
      characterEdit(data);
      await writeFile(join(dir, name), JSON.stringify(data, null, 2) + "\n");
    }
  }

  beforeEach(async () => {
    camelot = await copyCamelot();
    storage = new JsonFileStorage({ dataRoot: camelot.dataRoot });
  });
  afterEach(async () => {
    await camelot.cleanup();
  });

  it("opens a current world for editing without a backup", async () => {
    const { model, readOnly } = await openWorld(storage, camelot.worldId);
    expect(readOnly).toBe(false);
    expect(model.problems()).toEqual([]);
    expect(existsSync(backups())).toBe(false);
  });

  it("backs up, migrates and writes an older world", async () => {
    await setVersion(0, (d) => {
      d.tags = d.roles;
      delete d.roles;
    });
    const { model, readOnly } = await openWorld(storage, camelot.worldId, {
      migrations: [tagsToRoles],
      currentVersion: 1,
    });
    expect(readOnly).toBe(false);
    expect(model.problems()).toEqual([]);
    expect(model.world.schemaVersion).toBe(1);
    expect(await readdir(backups())).toHaveLength(1);
    const dir = join(camelot.worldPath, "characters");
    const first = JSON.parse(await readFile(join(dir, (await readdir(dir))[0]!), "utf8")) as Json;
    expect(first).toHaveProperty("roles");
    expect(first).not.toHaveProperty("tags");
  });

  it("writes nothing when a migration produces invalid files", async () => {
    await setVersion(0);
    const before = await snapshotDisk(camelot.worldPath);
    await expect(
      openWorld(storage, camelot.worldId, { migrations: [breaksCharacters], currentVersion: 1 }),
    ).rejects.toBeInstanceOf(MigrationError);
    expect(await snapshotDisk(camelot.worldPath)).toEqual(before);
    expect(await readdir(backups())).toHaveLength(1);
  });

  it("leaves the world at its old version if writing a migrated document fails", async () => {
    await setVersion(0, (d) => {
      d.tags = d.roles;
      delete d.roles;
    });
    const fs = new ScriptedFs();
    fs.failRenameTo = /\/characters\/[^/]+\.json$/;
    const failing = new JsonFileStorage({
      dataRoot: camelot.dataRoot,
      fs,
      sleep: () => Promise.resolve(),
    });
    await expect(
      openWorld(failing, camelot.worldId, { migrations: [tagsToRoles], currentVersion: 1 }),
    ).rejects.toMatchObject({ code: "locked" });
    const world = JSON.parse(await readFile(join(camelot.worldPath, "world.json"), "utf8")) as Json;
    expect(world.schemaVersion).toBe(0);
  });

  it("opens a world from a newer version read-only and writes nothing", async () => {
    await setVersion(2);
    const before = await snapshotDisk(camelot.worldPath);
    const { readOnly } = await openWorld(storage, camelot.worldId, { currentVersion: 1 });
    expect(readOnly).toBe(true);
    expect(await snapshotDisk(camelot.worldPath)).toEqual(before);
  });
});

describe("JsonFileStorage.backup", () => {
  it("zips the whole world into Backups/<folder>-<timestamp>.zip", async () => {
    const camelot = await copyCamelot();
    try {
      const storage = new JsonFileStorage({ dataRoot: camelot.dataRoot });
      const path = await storage.backup(camelot.worldId);
      expect(path.startsWith(join(camelot.dataRoot, "Backups"))).toBe(true);
      expect(basename(path)).toMatch(
        new RegExp(`^${basename(camelot.worldPath)}-\\d{8}-\\d{6}\\.zip$`),
      );
      const zipped = Object.keys(unzipSync(await readFile(path))).sort();
      expect(zipped).toEqual(await listFiles(camelot.worldPath));
    } finally {
      await camelot.cleanup();
    }
  });
});
