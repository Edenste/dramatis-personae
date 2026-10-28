import { readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  FILE_KINDS,
  SCHEMAS_FOLDER,
  schemaFileName,
  worldFolderName,
} from "@dramatis-personae/schema";
import { CAMELOT_IDS } from "@dramatis-personae/samples";
import { defineStorageContract } from "../contract.ts";
import { StorageError } from "../errors.ts";
import { copyCamelot, tempDataRoot, type TempCamelot } from "../../test-utils/temp-world.ts";
import { JsonFileStorage } from "./json-file-storage.ts";

defineStorageContract("JsonFileStorage", async () => {
  const root = await tempDataRoot();
  return { storage: new JsonFileStorage({ dataRoot: root.dataRoot }), cleanup: root.cleanup };
});

const kayId = CAMELOT_IDS.characters.Kay!;

describe("JsonFileStorage loading", () => {
  let camelot: TempCamelot;
  let storage: JsonFileStorage;
  const characters = () => join(camelot.worldPath, "characters");

  beforeEach(async () => {
    camelot = await copyCamelot();
    storage = new JsonFileStorage({ dataRoot: camelot.dataRoot });
  });
  afterEach(async () => {
    await camelot.cleanup();
  });

  it("loads the sample world with its twelve characters and no problems", async () => {
    const world = await storage.loadWorld(camelot.worldId);
    expect(world.problems).toEqual([]);
    expect(world.files.filter((f) => f.ref.kind === "character")).toHaveLength(12);
    expect(world.assets).toContain(`arthur-${CAMELOT_IDS.characters.Arthur}.jpg`);
  });

  it("creates a world folder named after the world, with every folder in the layout", async () => {
    const id = await storage.createWorld({ name: "Logres" });
    const folder = join(camelot.dataRoot, "Data", "worlds", worldFolderName("Logres", id));
    for (const sub of [
      "characters",
      "relationships",
      "events",
      "views",
      "searches",
      "assets/portraits",
    ]) {
      expect(existsSync(join(folder, sub)), sub).toBe(true);
    }
    for (const kind of FILE_KINDS) {
      expect(existsSync(join(folder, SCHEMAS_FOLDER, schemaFileName(kind))), kind).toBe(true);
    }
    expect(existsSync(join(folder, "world.schema.json"))).toBe(false);
    expect((await storage.loadWorld(id)).problems).toEqual([]);
  });

  it("reports broken JSON with its line and leaves the document out", async () => {
    await writeFile(
      join(characters(), "broken.json"),
      '{\n  "$schema": "../schemas/character.schema.json",\n  "id": "zzzzzzzzzzzzzzzz" "name": "Kay"\n}\n',
    );
    const world = await storage.loadWorld(camelot.worldId);
    expect(world.problems).toEqual([
      expect.objectContaining({ code: "invalid-json", path: "characters/broken.json", line: 3 }),
    ]);
    expect(world.files.some((f) => f.path === "characters/broken.json")).toBe(false);
  });

  it("reports a file that fails its schema, naming the failing key", async () => {
    const roles = join(camelot.worldPath, "roles.json");
    const data = JSON.parse(await readFile(roles, "utf8")) as { roles: Array<{ kind: string }> };
    data.roles[0]!.kind = "huge";
    await writeFile(roles, JSON.stringify(data, null, 2));
    const world = await storage.loadWorld(camelot.worldId);
    expect(world.problems).toHaveLength(1);
    expect(world.problems[0]).toMatchObject({ code: "invalid-document", path: "roles.json" });
    expect(world.problems[0]!.message).toContain("roles.0.kind");
  });

  it("loads files saved with a BOM and Windows line endings", async () => {
    const file = (await readdir(characters())).find((n) => n.startsWith("kay-"))!;
    const text = await readFile(join(characters(), file), "utf8");
    await writeFile(join(characters(), file), "﻿" + text.replace(/\n/g, "\r\n"));
    const world = await storage.loadWorld(camelot.worldId);
    expect(world.problems).toEqual([]);
    expect(world.files.find((f) => f.path === `characters/${file}`)?.ref).toEqual({
      kind: "character",
      id: kayId,
    });
  });

  it("assigns an id to a file without one and writes it back", async () => {
    await writeFile(join(characters(), "new.json"), JSON.stringify({ name: "Ector" }));
    const world = await storage.loadWorld(camelot.worldId);
    const ector = world.files.find((f) => f.path === "characters/new.json");
    expect(ector?.ref).toEqual({ kind: "character", id: expect.stringMatching(/^[a-z0-9]{16}$/) });
    const onDisk = JSON.parse(await readFile(join(characters(), "new.json"), "utf8")) as {
      id: string;
    };
    expect(onDisk.id).toBe((ector?.ref as { id: string }).id);
  });

  it("keeps the first of two files with the same id and reports the second", async () => {
    const file = (await readdir(characters())).find((n) => n.startsWith("kay-"))!;
    await writeFile(join(characters(), "zz-copy.json"), await readFile(join(characters(), file)));
    const world = await storage.loadWorld(camelot.worldId);
    expect(world.files.filter((f) => "id" in f.ref && f.ref.id === kayId)).toHaveLength(1);
    expect(world.problems).toEqual([
      expect.objectContaining({
        code: "duplicate-id",
        path: "characters/zz-copy.json",
        fix: "assignNewId",
      }),
    ]);
  });

  it("deletes leftover temporary files and ignores files that aren't JSON", async () => {
    await writeFile(join(characters(), ".x.json.ab12.tmp"), "{");
    await writeFile(join(characters(), "notes.txt"), "not json");
    const world = await storage.loadWorld(camelot.worldId);
    expect(world.problems).toEqual([]);
    expect(existsSync(join(characters(), ".x.json.ab12.tmp"))).toBe(false);
    expect(existsSync(join(characters(), "notes.txt"))).toBe(true);
  });

  it("reports a file that isn't UTF-8 instead of loading garbled text", async () => {
    const latin1 = Uint8Array.from(
      [...'{"id":"ectorectorectorr","name":"Caf']
        .map((c) => c.charCodeAt(0))
        .concat([0xe9, 0x22, 0x7d]),
    );
    await writeFile(join(characters(), "latin1.json"), latin1);
    const world = await storage.loadWorld(camelot.worldId);
    expect(world.problems).toEqual([
      expect.objectContaining({ code: "invalid-json", path: "characters/latin1.json" }),
    ]);
    expect(world.problems[0]?.message).toContain("UTF-8");
  });

  it("loads a UTF-16 file with a byte-order mark", async () => {
    const text = JSON.stringify({ id: "ectorectorectorr", name: "Café" });
    const bytes = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, "utf16le")]);
    await writeFile(join(characters(), "utf16.json"), bytes);
    const world = await storage.loadWorld(camelot.worldId);
    expect(world.problems).toEqual([]);
    expect(world.files.find((f) => f.path === "characters/utf16.json")?.data).toMatchObject({
      name: "Café",
    });
  });

  it("lists a world whose world.json is broken, with the problem", async () => {
    await writeFile(join(camelot.worldPath, "world.json"), "{ broken");
    const worlds = await storage.listWorlds();
    expect(worlds).toEqual([
      expect.objectContaining({
        id: camelot.worldId,
        problem: expect.stringContaining("world.json"),
      }),
    ]);
    await expect(storage.loadWorld(camelot.worldId)).rejects.toMatchObject({ code: "io" });
  });

  it("flags two world folders with the same id and refuses to guess between them", async () => {
    const { cp } = await import("node:fs/promises");
    await cp(camelot.worldPath, `${camelot.worldPath}-copy`, { recursive: true });
    const worlds = await storage.listWorlds();
    expect(worlds).toHaveLength(2);
    for (const world of worlds) expect(world.problem).toContain("same id");
    await expect(storage.loadWorld(camelot.worldId)).rejects.toMatchObject({ code: "ambiguous" });
  });

  it("refuses to write to a world that hasn't been loaded", async () => {
    await expect(storage.write(camelot.worldId, [])).rejects.toMatchObject({
      name: "StorageError",
      code: "not-loaded",
    });
    await expect(storage.write(camelot.worldId, [])).rejects.toBeInstanceOf(StorageError);
  });
});
