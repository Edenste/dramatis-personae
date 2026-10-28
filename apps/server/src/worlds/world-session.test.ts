import { cp, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  JsonFileStorage,
  type ExternalChange,
  type FileSystem,
  type Migration,
} from "@dramatis-personae/core";
import { ScriptedFs, copyCamelot, type TempCamelot } from "@dramatis-personae/core/testing";
import { CAMELOT_IDS } from "@dramatis-personae/samples";
import { refKey, type FileRef, type ServerMessage } from "@dramatis-personae/schema";
import { WorldSessions } from "./world-sessions.ts";
import type { WorldSession } from "./world-session.ts";

const owner = { id: "local", role: "owner" } as const;
const WAIT = { timeout: 3000, interval: 50 };
const kayId = CAMELOT_IDS.characters.Kay!;
const gawainId = CAMELOT_IDS.characters.Gawain!;
const kay: FileRef = { kind: "character", id: kayId };

type Json = Record<string, unknown>;

describe("WorldSession", () => {
  let camelot: TempCamelot;
  let sessions: WorldSessions;
  let session: WorldSession;
  let messages: ServerMessage[];
  const characters = () => join(camelot.worldPath, "characters");

  async function fileOf(prefix: string): Promise<string> {
    return join(
      characters(),
      (await readdir(characters())).find((n) => n.startsWith(prefix))!,
    );
  }

  async function open(options: { fs?: FileSystem; migrations?: Migration[] } = {}) {
    const storage = new JsonFileStorage({
      dataRoot: camelot.dataRoot,
      ...(options.fs ? { fs: options.fs, sleep: () => Promise.resolve() } : {}),
    });
    sessions = new WorldSessions(
      storage,
      options.migrations ? { migrations: options.migrations, currentVersion: 1 } : undefined,
    );
    session = await sessions.get(camelot.worldId);
    messages = [];
    session.subscribe((message) => messages.push(message));
  }

  const renameKay = (name: string, expect?: Record<string, string | null>) =>
    session.apply(
      {
        commands: [{ type: "character.update", id: kayId, set: { name } }],
        ...(expect ? { expect } : {}),
      },
      owner,
    );
  const changedKeys = () =>
    messages.flatMap((m) => (m.type === "changed" ? m.files.map((f) => refKey(f.ref)) : []));

  beforeEach(async () => {
    camelot = await copyCamelot();
  });
  afterEach(async () => {
    await sessions.closeAll();
    await camelot.cleanup();
  });

  it("opens a world for editing with its files and no problems", async () => {
    await open();
    expect(session.readOnly).toBe(false);
    expect(session.unsaved).toBeNull();
    expect(session.model.problems()).toEqual([]);
    expect(session.model.all("character")).toHaveLength(12);
  });

  it("applies a command, writes it, pushes the change and re-indexes search", async () => {
    await open();
    const result = await renameKay("Cai the Tall");
    expect(result.inverse.commands).toHaveLength(1);
    expect(result.fingerprints[refKey(kay)]).toMatch(/^[0-9a-f]{64}$/);
    const onDisk = JSON.parse(await readFile(await fileOf("cai-the-tall-"), "utf8")) as Json;
    expect(onDisk.name).toBe("Cai the Tall");
    expect(changedKeys()).toContain(refKey(kay));
    expect(session.search("Cai").map((hit) => hit.id)).toContain(kayId);
  });

  it("applies concurrent batches strictly in order, losing none", async () => {
    await open();
    const creates = Array.from({ length: 20 }, (_, i) =>
      session.apply(
        { commands: [{ type: "character.create", character: { name: `Squire ${i}` } }] },
        owner,
      ),
    );
    const updates = [
      { set: { color: "#123456" } },
      { set: { body: "Seneschal of Camelot." } },
      { setFields: { title: "Seneschal" } },
      { setFields: { weapon: "Sword" } },
      { setFields: { steed: "A grey horse" } },
    ].map((change) =>
      session.apply({ commands: [{ type: "character.update", id: kayId, ...change }] }, owner),
    );
    await Promise.all([...creates, ...updates]);

    expect(session.model.all("character")).toHaveLength(32);
    expect((await readdir(characters())).filter((n) => n.endsWith(".json"))).toHaveLength(32);
    const kayOnDisk = JSON.parse(await readFile(await fileOf("kay-"), "utf8")) as {
      color: string;
      body: string;
      fields: Json;
    };
    expect(kayOnDisk.color).toBe("#123456");
    expect(kayOnDisk.body).toBe("Seneschal of Camelot.");
    expect(kayOnDisk.fields).toMatchObject({
      title: "Seneschal",
      weapon: "Sword",
      steed: "A grey horse",
    });
  });

  it("takes in an outside edit and pushes it", async () => {
    await open();
    const path = await fileOf("kay-");
    const data = JSON.parse(await readFile(path, "utf8")) as Json;
    await writeFile(path, JSON.stringify({ ...data, name: "Kay of the Outside" }, null, 2) + "\n");
    await vi.waitFor(() => expect(changedKeys()).toContain(refKey(kay)), WAIT);
    expect(session.model.get("character", kayId)?.name).toBe("Kay of the Outside");
    expect(session.search("Outside").map((hit) => hit.id)).toContain(kayId);
  });

  it("lists a broken outside edit under problems and blocks writes to that file", async () => {
    await open();
    await writeFile(await fileOf("kay-"), "{ broken");
    await vi.waitFor(
      () =>
        expect(
          messages.some(
            (m) => m.type === "problems" && m.problems.some((p) => p.code === "invalid-json"),
          ),
        ).toBe(true),
      WAIT,
    );
    await expect(renameKay("Kay again")).rejects.toMatchObject({ status: 409, code: "blocked" });
  });

  it("re-indexes every member when a library changes", async () => {
    await open();
    const roles = session.model.library("roles");
    const knights = roles.roles.find((r) => r.name === "Knights of the Round Table")!;
    const renamed = {
      ...roles,
      roles: roles.roles.map((r) =>
        r.id === knights.id ? { ...r, name: "Companions of Logres" } : r,
      ),
    };
    await session.apply(
      {
        commands: [
          { type: "restore", files: [{ ref: { kind: "roles" }, fileName: null, data: renamed }] },
        ],
      },
      owner,
    );
    const hits = session.search("Logres").map((hit) => hit.id);
    for (const member of session.model.membersOf(knights.id)) expect(hits).toContain(member);
  });

  it("refuses an edit whose expected fingerprint is stale, and pushes the conflict", async () => {
    await open();
    await expect(renameKay("Kay", { [refKey(kay)]: "0".repeat(64) })).rejects.toMatchObject({
      status: 409,
      code: "conflict",
    });
    expect(messages).toContainEqual(
      expect.objectContaining({ type: "conflict", refs: [refKey(kay)] }),
    );
  });

  describe("when a file is locked", () => {
    let fs: ScriptedFs;
    beforeEach(async () => {
      fs = new ScriptedFs();
      await open({ fs });
      fs.alwaysFailRename = "EBUSY";
    });

    it("keeps the change unsaved, refuses new edits, and saves it on retry", async () => {
      await expect(renameKay("Cai")).rejects.toMatchObject({ status: 503, code: "save-failed" });
      expect(session.unsaved).not.toBeNull();
      expect(session.model.get("character", kayId)?.name).toBe("Cai");
      expect(messages).toContainEqual(
        expect.objectContaining({ type: "save-state", unsaved: true }),
      );
      await expect(renameKay("Cai again")).rejects.toMatchObject({ status: 409, code: "unsaved" });

      fs.alwaysFailRename = null;
      const result = await session.retry();
      expect(result.inverse.commands).toHaveLength(1);
      expect(session.unsaved).toBeNull();
      const onDisk = JSON.parse(await readFile(await fileOf("cai-"), "utf8")) as Json;
      expect(onDisk.name).toBe("Cai");
      expect(messages).toContainEqual(
        expect.objectContaining({ type: "save-state", unsaved: false }),
      );
    });

    it("goes back to the files on disk when the change is discarded", async () => {
      await expect(renameKay("Cai")).rejects.toMatchObject({ code: "save-failed" });
      fs.alwaysFailRename = null;
      await session.discardUnsaved();
      expect(session.unsaved).toBeNull();
      expect(session.model.get("character", kayId)?.name).toBe("Kay");
      expect(messages).toContainEqual(expect.objectContaining({ type: "reload" }));
    });

    it("keeps seeing outside changes after a discard", async () => {
      await expect(renameKay("Cai")).rejects.toMatchObject({ code: "save-failed" });
      fs.alwaysFailRename = null;
      await session.discardUnsaved();
      const { fingerprints } = await session.apply(
        { commands: [{ type: "character.create", character: { name: "Squire Tom" } }] },
        owner,
      );
      const tomKey = Object.keys(fingerprints)[0]!;
      await new Promise((resolve) => setTimeout(resolve, 500));
      await unlink(await fileOf("squire-tom-"));
      await vi.waitFor(() => expect(session.model.all("character")).toHaveLength(12), WAIT);
      expect(messages).toContainEqual(
        expect.objectContaining({ type: "changed", removed: [tomKey] }),
      );
    });

    it("still takes in outside edits to other files", async () => {
      await expect(renameKay("Cai")).rejects.toMatchObject({ code: "save-failed" });
      const path = await fileOf("gawain-");
      const data = JSON.parse(await readFile(path, "utf8")) as Json;
      await writeFile(path, JSON.stringify({ ...data, name: "Gawain the Green" }, null, 2) + "\n");
      await vi.waitFor(
        () => expect(changedKeys()).toContain(refKey({ kind: "character", id: gawainId })),
        WAIT,
      );
      expect(session.model.get("character", gawainId)?.name).toBe("Gawain the Green");
    });

    it("has nothing to retry once saved", async () => {
      fs.alwaysFailRename = null;
      await expect(session.retry()).rejects.toMatchObject({ status: 409, code: "conflict" });
    });
  });

  describe("an outside edit arriving while the app writes the same file", () => {
    /** Storage whose writes wait for a gate, and which hands the test its watch callback. */
    class GatedStorage extends JsonFileStorage {
      gate: Promise<void> | null = null;
      onChange: ((change: ExternalChange) => void) | undefined;
      override async write(...args: Parameters<JsonFileStorage["write"]>) {
        if (this.gate) await this.gate;
        return super.write(...args);
      }
      override watch(...args: Parameters<JsonFileStorage["watch"]>) {
        this.onChange = args[1];
        return super.watch(...args);
      }
    }

    it("ends with memory and disk agreeing on the app's write", async () => {
      const storage = new GatedStorage({ dataRoot: camelot.dataRoot });
      sessions = new WorldSessions(storage);
      session = await sessions.get(camelot.worldId);
      const stale = session.model.files().find((f) => refKey(f.ref) === refKey(kay))!;

      let release = () => {};
      storage.gate = new Promise<void>((resolve) => (release = resolve));
      const writing = renameKay("Cai");
      await new Promise((resolve) => setTimeout(resolve, 20)); // the batch is now writing
      // The watcher read Kay's file just before the app's write landed on disk.
      storage.onChange!({
        type: "upsert",
        file: {
          ...stale,
          data: { ...(stale.data as Json), name: "Kay of the Outside" },
          fingerprint: "f".repeat(64),
        },
      });
      release();
      await writing;
      await session.apply({ commands: [] }, owner); // runs after everything already queued

      expect(session.model.get("character", kayId)?.name).toBe("Cai");
      const onDisk = JSON.parse(await readFile(await fileOf("cai-"), "utf8")) as Json;
      expect(onDisk.name).toBe("Cai");
    });
  });

  describe("a watcher that can't watch", () => {
    class BrokenWatchStorage extends JsonFileStorage {
      constructor(
        dataRoot: string,
        private readonly mode: "error" | "silent",
      ) {
        super({ dataRoot });
      }
      override watch(...[, , events]: Parameters<JsonFileStorage["watch"]>) {
        if (this.mode === "error") events?.onError?.(new Error("ENOSPC: watch limit reached"));
        return () => undefined;
      }
    }

    it("still opens the world, with a warning, when the watcher fails", async () => {
      const warnings: string[] = [];
      sessions = new WorldSessions(new BrokenWatchStorage(camelot.dataRoot, "error"), {
        onWarning: (message) => warnings.push(message),
      });
      session = await sessions.get(camelot.worldId);
      expect(session.model.all("character")).toHaveLength(12);
      expect(warnings.join("\n")).toContain("ENOSPC");
    });

    it("still opens the world, with a warning, when the watcher never gets ready", async () => {
      const warnings: string[] = [];
      sessions = new WorldSessions(new BrokenWatchStorage(camelot.dataRoot, "silent"), {
        onWarning: (message) => warnings.push(message),
        readyTimeoutMs: 100,
      });
      session = await sessions.get(camelot.worldId);
      expect(session.model.all("character")).toHaveLength(12);
      expect(warnings).toHaveLength(1);
    });
  });

  describe("fixes", () => {
    it("removes a dangling reference, undoably", async () => {
      await open();
      const path = await fileOf("kay-");
      const data = JSON.parse(await readFile(path, "utf8")) as { roles: string[] };
      await writeFile(
        path,
        JSON.stringify({ ...data, roles: [...data.roles, "zzzzzzzzzzzzzzzz"] }, null, 2) + "\n",
      );
      const dangling = () =>
        session.model.problems().filter((p) => p.code === "dangling-reference");
      await vi.waitFor(() => expect(dangling()).toHaveLength(1), WAIT);

      const result = await session.fix({ fix: "removeReference", ref: kay }, owner);
      expect(dangling()).toEqual([]);
      await session.apply(result.inverse, owner);
      expect(dangling()).toHaveLength(1);
    });

    it("gives a copied file a new id", async () => {
      await cp(await fileOf("kay-"), join(characters(), "kay-copy.json"));
      await open();
      expect(session.model.problems()).toContainEqual(
        expect.objectContaining({ code: "duplicate-id", path: "characters/kay-copy.json" }),
      );
      await session.fix({ fix: "assignNewId", path: "characters/kay-copy.json" }, owner);
      expect(session.model.problems()).toEqual([]);
      expect(session.model.all("character")).toHaveLength(13);
    });

    it("refuses a fix for a problem that isn't there", async () => {
      await open();
      await expect(session.fix({ fix: "removeReference", ref: kay }, owner)).rejects.toMatchObject({
        status: 404,
      });
      await expect(
        session.fix({ fix: "assignNewId", path: "characters/nobody.json" }, owner),
      ).rejects.toMatchObject({ status: 404 });
    });
  });

  describe("opening", () => {
    async function setVersion(version: number) {
      const file = join(camelot.worldPath, "world.json");
      const world = JSON.parse(await readFile(file, "utf8")) as Json;
      await writeFile(file, JSON.stringify({ ...world, schemaVersion: version }, null, 2) + "\n");
    }

    it("reports a failed migration and tries again on the next open", async () => {
      await setVersion(0);
      const breaks: Migration = {
        from: 0,
        to: 1,
        migrate: (files) =>
          files.map((file) =>
            file.path.startsWith("characters/")
              ? { ...file, data: { ...(file.data as Json), name: "" } }
              : file,
          ),
      };
      const storage = new JsonFileStorage({ dataRoot: camelot.dataRoot });
      const backup = vi.spyOn(storage, "backup");
      sessions = new WorldSessions(storage, { migrations: [breaks], currentVersion: 1 });
      await expect(sessions.get(camelot.worldId)).rejects.toMatchObject({
        status: 409,
        code: "migration-failed",
      });
      await expect(sessions.get(camelot.worldId)).rejects.toMatchObject({
        code: "migration-failed",
      });
      expect(backup).toHaveBeenCalledTimes(2);
    });

    it("opens a world from a newer version read-only", async () => {
      await setVersion(2);
      await open();
      expect(session.readOnly).toBe(true);
      await expect(renameKay("Cai")).rejects.toMatchObject({ status: 403, code: "read-only" });
    });

    it("says not-found for an unknown world", async () => {
      await open();
      await expect(sessions.get("0000000000000000")).rejects.toMatchObject({
        status: 404,
        code: "not-found",
      });
    });

    it("refuses a world whose folder is broken", async () => {
      await writeFile(join(camelot.worldPath, "world.json"), "{ broken");
      sessions = new WorldSessions(new JsonFileStorage({ dataRoot: camelot.dataRoot }));
      await expect(sessions.get(camelot.worldId)).rejects.toMatchObject({
        status: 409,
        code: "world-unavailable",
      });
    });
  });
});
