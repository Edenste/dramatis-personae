import { readFile, readdir, rm, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CAMELOT_IDS } from "@dramatis-personae/samples";
import { serialize } from "../../serialize.ts";
import { copyCamelot, type TempCamelot } from "../../test-utils/temp-world.ts";
import type { ExternalChange } from "../types.ts";
import { JsonFileStorage } from "./json-file-storage.ts";

const kayId = CAMELOT_IDS.characters.Kay!;
const WAIT = { timeout: 3000, interval: 50 };
const quiet = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("JsonFileStorage.watch", () => {
  let camelot: TempCamelot;
  let storage: JsonFileStorage;
  let changes: ExternalChange[];
  let stop: () => void;
  let kayFile: string;
  const characters = () => join(camelot.worldPath, "characters");

  beforeEach(async () => {
    camelot = await copyCamelot();
    storage = new JsonFileStorage({ dataRoot: camelot.dataRoot });
    await storage.loadWorld(camelot.worldId);
    kayFile = (await readdir(characters())).find((n) => n.startsWith("kay-"))!;
    changes = [];
    stop = storage.watch(camelot.worldId, (change) => changes.push(change));
    await quiet(300); // let the watcher finish its initial scan
  });
  afterEach(async () => {
    stop();
    await camelot.cleanup();
  });

  async function editKay(edit: (data: Record<string, unknown>) => void): Promise<string> {
    const path = join(characters(), kayFile);
    const data = JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
    edit(data);
    const text = serialize(data);
    await writeFile(path, text);
    return text;
  }

  it("reports an outside edit as one upsert with the new content", async () => {
    await editKay((d) => {
      d.fields = { title: "Seneschal of Camelot" };
    });
    await vi.waitFor(() => expect(changes).toHaveLength(1), WAIT);
    expect(changes[0]).toMatchObject({
      type: "upsert",
      file: {
        ref: { kind: "character", id: kayId },
        data: { fields: { title: "Seneschal of Camelot" } },
      },
    });
  });

  it("reports an outside revert to what the app last wrote", async () => {
    const original = await readFile(join(characters(), kayFile), "utf8");
    await storage.write(camelot.worldId, [
      { op: "put", ref: { kind: "character", id: kayId }, fileName: kayFile, text: original },
    ]);
    await editKay((d) => void (d.name = "Sir Kay"));
    await vi.waitFor(() => expect(changes).toHaveLength(1), WAIT);
    await writeFile(join(characters(), kayFile), original);
    await vi.waitFor(() => expect(changes).toHaveLength(2), WAIT);
    expect(changes[1]).toMatchObject({ type: "upsert", file: { data: { name: "Kay" } } });
  });

  it("ignores the app's own writes", async () => {
    await storage.write(camelot.worldId, [
      {
        op: "put",
        ref: { kind: "character", id: kayId },
        fileName: kayFile,
        text: serialize({ id: kayId, name: "Kay" }),
      },
    ]);
    await quiet(600);
    expect(changes).toEqual([]);
  });

  it("reports broken JSON as invalid", async () => {
    await writeFile(join(characters(), kayFile), "{ not json");
    await vi.waitFor(() => expect(changes).toHaveLength(1), WAIT);
    expect(changes[0]).toMatchObject({
      type: "invalid",
      path: `characters/${kayFile}`,
      problem: { code: "invalid-json" },
    });
  });

  it("reports a deleted file as a removal of its document", async () => {
    await unlink(join(characters(), kayFile));
    await vi.waitFor(() => expect(changes).toHaveLength(1), WAIT);
    expect(changes[0]).toEqual({
      type: "remove",
      path: `characters/${kayFile}`,
      ref: { kind: "character", id: kayId },
    });
  });

  it("treats an editor's delete-and-recreate as one update, not a removal", async () => {
    const path = join(characters(), kayFile);
    const text = await readFile(path, "utf8");
    await rm(path);
    await quiet(20);
    await writeFile(path, text.replace('"Kay"', '"Sir Kay"'));
    await vi.waitFor(() => expect(changes).toHaveLength(1), WAIT);
    await quiet(300);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ type: "upsert", file: { data: { name: "Sir Kay" } } });
  });

  it("assigns an id to a new file without one, without a second event for the write-back", async () => {
    await writeFile(join(characters(), "ector.json"), JSON.stringify({ name: "Ector" }));
    await vi.waitFor(() => expect(changes).toHaveLength(1), WAIT);
    await quiet(500);
    expect(changes).toHaveLength(1);
    const change = changes[0]!;
    expect(change.type).toBe("upsert");
    const id = change.type === "upsert" && "id" in change.file.ref ? change.file.ref.id : "";
    expect(id).toMatch(/^[a-z0-9]{16}$/);
    const onDisk = JSON.parse(await readFile(join(characters(), "ector.json"), "utf8")) as {
      id: string;
    };
    expect(onDisk.id).toBe(id);
  });

  it("ignores temporary files", async () => {
    await writeFile(join(characters(), ".kay.json.abcd1234.tmp"), "{}");
    await quiet(600);
    expect(changes).toEqual([]);
  });

  it("stops reporting after unsubscribing", async () => {
    stop();
    await editKay((d) => {
      d.name = "Kay the Seneschal";
    });
    await quiet(600);
    expect(changes).toEqual([]);
  });
});
