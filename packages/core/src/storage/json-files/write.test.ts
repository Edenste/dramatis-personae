import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CAMELOT_IDS } from "@dramatis-personae/samples";
import { serialize } from "../../serialize.ts";
import { copyCamelot, type TempCamelot } from "../../test-utils/temp-world.ts";
import { ScriptedFs } from "../../test-utils/scripted-fs.ts";
import { JsonFileStorage } from "./json-file-storage.ts";

const kay = { kind: "character", id: CAMELOT_IDS.characters.Kay! } as const;

describe("JsonFileStorage writes", () => {
  let camelot: TempCamelot;
  let fs: ScriptedFs;
  let sleeps: number[];
  let storage: JsonFileStorage;
  const characters = () => join(camelot.worldPath, "characters");
  const kayText = (title: string) => serialize({ id: kay.id, name: "Kay", fields: { title } });

  beforeEach(async () => {
    camelot = await copyCamelot();
    fs = new ScriptedFs();
    sleeps = [];
    storage = new JsonFileStorage({
      dataRoot: camelot.dataRoot,
      fs,
      sleep: (ms) => {
        sleeps.push(ms);
        return Promise.resolve();
      },
    });
    await storage.loadWorld(camelot.worldId);
    fs.ops.length = 0;
  });
  afterEach(async () => {
    await camelot.cleanup();
  });

  it("renames a document whose file name changes, leaving only the new file", async () => {
    const before = (await readdir(characters())).find((n) => n.startsWith("kay-"))!;
    await storage.write(camelot.worldId, [
      { op: "put", ref: kay, fileName: `sir-kay-${kay.id}.json`, text: kayText("Seneschal") },
    ]);
    const names = await readdir(characters());
    expect(names).not.toContain(before);
    expect(names).toContain(`sir-kay-${kay.id}.json`);
    expect(await readFile(join(characters(), `sir-kay-${kay.id}.json`), "utf8")).toBe(
      kayText("Seneschal"),
    );
  });

  it("applies changes in the order given, each through a temporary file", async () => {
    const ector = { kind: "character", id: "ector00000000000" } as const;
    await storage.write(camelot.worldId, [
      { op: "put", ref: ector, fileName: "ector.json", text: "{}\n" },
      { op: "delete", ref: ector },
    ]);
    const temp = join(characters(), ".ector.json.");
    expect(fs.ops[0]).toMatch(new RegExp(`^write ${escape(temp)}[a-z0-9]{8}\\.tmp$`));
    expect(fs.ops[1]).toMatch(new RegExp(`-> ${escape(join(characters(), "ector.json"))}$`));
    expect(fs.ops[2]).toBe(`unlink ${join(characters(), "ector.json")}`);
  });

  it("leaves the original intact and cleans up when a rename fails", async () => {
    const file = (await readdir(characters())).find((n) => n.startsWith("kay-"))!;
    const original = await readFile(join(characters(), file), "utf8");
    fs.renameFailures = ["ENOSPC"];
    await expect(
      storage.write(camelot.worldId, [
        { op: "put", ref: kay, fileName: file, text: kayText("Broken") },
      ]),
    ).rejects.toMatchObject({ name: "StorageError", code: "io" });
    expect(await readFile(join(characters(), file), "utf8")).toBe(original);
    expect((await readdir(characters())).filter((n) => n.endsWith(".tmp"))).toEqual([]);
  });

  it("retries a rename blocked by a lock until it succeeds", async () => {
    const file = (await readdir(characters())).find((n) => n.startsWith("kay-"))!;
    fs.renameFailures = ["EPERM", "EPERM", "EPERM"];
    await storage.write(camelot.worldId, [
      { op: "put", ref: kay, fileName: file, text: kayText("Seneschal") },
    ]);
    expect(sleeps).toEqual([50, 100, 200]);
    expect(await readFile(join(characters(), file), "utf8")).toBe(kayText("Seneschal"));
  });

  it("gives up on a file that stays locked", async () => {
    const file = (await readdir(characters())).find((n) => n.startsWith("kay-"))!;
    fs.alwaysFailRename = "EBUSY";
    await expect(
      storage.write(camelot.worldId, [
        { op: "put", ref: kay, fileName: file, text: kayText("Seneschal") },
      ]),
    ).rejects.toMatchObject({ name: "StorageError", code: "locked" });
    expect(sleeps).toEqual([50, 100, 200, 400, 800]);
  });

  it("keeps the last of two rapid saves of the same document", async () => {
    const file = (await readdir(characters())).find((n) => n.startsWith("kay-"))!;
    await Promise.all([
      storage.write(camelot.worldId, [{ op: "put", ref: kay, fileName: file, text: kayText("A") }]),
      storage.write(camelot.worldId, [{ op: "put", ref: kay, fileName: file, text: kayText("B") }]),
    ]);
    expect(await readFile(join(characters(), file), "utf8")).toBe(kayText("B"));
    expect((await readdir(characters())).filter((n) => n.endsWith(".tmp"))).toEqual([]);
  });

  it("writes and deletes portraits", async () => {
    const portraits = join(camelot.worldPath, "assets", "portraits");
    await storage.write(camelot.worldId, [
      { op: "putAsset", fileName: "kay.png", bytes: new Uint8Array([1, 2, 3]) },
    ]);
    expect([...(await readFile(join(portraits, "kay.png")))]).toEqual([1, 2, 3]);
    await storage.write(camelot.worldId, [{ op: "deleteAsset", fileName: "kay.png" }]);
    expect(existsSync(join(portraits, "kay.png"))).toBe(false);
  });
});

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
