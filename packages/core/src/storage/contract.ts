import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { refKey } from "@dramatis-personae/schema";
import { fingerprint, serialize } from "../serialize.ts";
import type { WorldStorage } from "./types.ts";

export interface ContractSubject {
  storage: WorldStorage;
  cleanup: () => Promise<void>;
}

/**
 * Behaviour every WorldStorage implementation must have. Only the interface is
 * used, so a database-backed adapter can run the same suite.
 */
export function defineStorageContract(name: string, make: () => Promise<ContractSubject>): void {
  describe(`${name}: WorldStorage contract`, () => {
    let subject: ContractSubject;
    beforeEach(async () => {
      subject = await make();
    });
    afterEach(async () => {
      await subject.cleanup();
    });

    it("lists a world after creating it", async () => {
      const id = await subject.storage.createWorld({ name: "Logres" });
      const worlds = await subject.storage.listWorlds();
      expect(worlds).toContainEqual(
        expect.objectContaining({ id, name: "Logres", schemaVersion: 1 }),
      );
    });

    it("loads a new world with its manifest, libraries and main view and no problems", async () => {
      const id = await subject.storage.createWorld({ name: "Logres" });
      const world = await subject.storage.loadWorld(id);
      expect(world.problems).toEqual([]);
      const kinds = world.files.map((f) => f.ref.kind).sort();
      expect(kinds).toEqual(
        ["fields", "relationshipTypes", "roles", "templates", "view", "world"].sort(),
      );
    });

    it("writes, reloads and deletes a document, reporting fingerprints", async () => {
      const worldId = await subject.storage.createWorld({ name: "Logres" });
      await subject.storage.loadWorld(worldId);
      const ref = { kind: "character", id: "ector00000000000" } as const;
      const text = serialize({ id: ref.id, name: "Ector" });

      const put = await subject.storage.write(worldId, [
        { op: "put", ref, fileName: "ector-ector00000000000.json", text },
      ]);
      expect(put.fingerprints).toEqual({ [refKey(ref)]: fingerprint(text) });
      const reloaded = await subject.storage.loadWorld(worldId);
      expect(reloaded.files.find((f) => refKey(f.ref) === refKey(ref))?.data).toMatchObject({
        name: "Ector",
      });

      const removed = await subject.storage.write(worldId, [{ op: "delete", ref }]);
      expect(removed.fingerprints).toEqual({ [refKey(ref)]: null });
    });

    it("writes raw files back unchanged and makes a backup", async () => {
      const worldId = await subject.storage.createWorld({ name: "Logres" });
      const before = await subject.storage.loadWorld(worldId);
      const raw = await subject.storage.loadRaw(worldId);
      expect(raw.map((f) => f.path)).toContain("world.json");
      await subject.storage.writeRaw(worldId, raw);
      const after = await subject.storage.loadWorld(worldId);
      expect(after.files.map((f) => f.fingerprint).sort()).toEqual(
        before.files.map((f) => f.fingerprint).sort(),
      );
      expect(typeof (await subject.storage.backup(worldId))).toBe("string");
    });

    it("deletes a document it wrote", async () => {
      const worldId = await subject.storage.createWorld({ name: "Logres" });
      await subject.storage.loadWorld(worldId);
      const ref = { kind: "character", id: "ector00000000000" } as const;
      await subject.storage.write(worldId, [
        { op: "put", ref, fileName: "ector.json", text: serialize({ id: ref.id, name: "Ector" }) },
      ]);
      const removed = await subject.storage.write(worldId, [{ op: "delete", ref }]);
      expect(removed.fingerprints).toEqual({ [refKey(ref)]: null });
      const after = await subject.storage.loadWorld(worldId);
      expect(after.files.some((f) => refKey(f.ref) === refKey(ref))).toBe(false);
    });

    it("says when the watcher is ready", async () => {
      const worldId = await subject.storage.createWorld({ name: "Logres" });
      await subject.storage.loadWorld(worldId);
      let stop = () => {};
      await new Promise<void>((resolve) => {
        stop = subject.storage.watch(worldId, () => undefined, { onReady: resolve });
      });
      stop();
    });

    it("reads back a portrait it wrote, and nothing outside the portraits folder", async () => {
      const worldId = await subject.storage.createWorld({ name: "Logres" });
      await subject.storage.loadWorld(worldId);
      await subject.storage.write(worldId, [
        { op: "putAsset", fileName: "kay.png", bytes: new Uint8Array([1, 2, 3]) },
      ]);
      expect([...((await subject.storage.readAsset(worldId, "kay.png")) ?? [])]).toEqual([1, 2, 3]);
      expect(await subject.storage.readAsset(worldId, "missing.png")).toBeNull();
      await expect(subject.storage.readAsset(worldId, "../world.json")).rejects.toMatchObject({
        code: "io",
      });
    });

    it("tells when a file last changed, or null when it isn't there", async () => {
      const worldId = await subject.storage.createWorld({ name: "Logres" });
      await subject.storage.loadWorld(worldId);
      const path = "assets/portraits/kay.png";
      expect(await subject.storage.modifiedAt(worldId, path)).toBeNull();
      expect(typeof (await subject.storage.modifiedAt(worldId, "world.json"))).toBe("number");

      const put = () =>
        subject.storage.write(worldId, [
          { op: "putAsset", fileName: "kay.png", bytes: new Uint8Array([1]) },
        ]);
      await put();
      const first = await subject.storage.modifiedAt(worldId, path);
      expect(typeof first).toBe("number");
      await new Promise((resolve) => setTimeout(resolve, 30));
      await put();
      expect(await subject.storage.modifiedAt(worldId, path)).toBeGreaterThan(first!);

      await expect(subject.storage.modifiedAt(worldId, "../outside.json")).rejects.toMatchObject({
        code: "io",
      });
    });

    it("gives a copied document a new id", async () => {
      const worldId = await subject.storage.createWorld({ name: "Logres" });
      await subject.storage.loadWorld(worldId);
      const ref = { kind: "character", id: "ector00000000000" } as const;
      const text = serialize({ id: ref.id, name: "Ector" });
      await subject.storage.write(worldId, [
        { op: "put", ref, fileName: `ector-${ref.id}.json`, text },
      ]);
      await subject.storage.writeRaw(worldId, [{ path: "characters/zz-ector-copy.json", text }]);
      const loaded = await subject.storage.loadWorld(worldId);
      expect(loaded.problems).toEqual([
        expect.objectContaining({ code: "duplicate-id", path: "characters/zz-ector-copy.json" }),
      ]);

      const file = await subject.storage.assignNewId(worldId, "characters/zz-ector-copy.json");
      const newId = "id" in file.ref ? file.ref.id : "";
      expect(file.ref.kind).toBe("character");
      expect(newId).toMatch(/^[a-z0-9]{16}$/);
      expect(newId).not.toBe(ref.id);

      const after = await subject.storage.loadWorld(worldId);
      expect(after.problems).toEqual([]);
      expect(after.files.filter((f) => f.ref.kind === "character")).toHaveLength(2);
    });

    it("refuses to reassign the id of a missing file or a non-document", async () => {
      const worldId = await subject.storage.createWorld({ name: "Logres" });
      await subject.storage.loadWorld(worldId);
      await expect(
        subject.storage.assignNewId(worldId, "characters/nobody.json"),
      ).rejects.toMatchObject({ code: "not-found" });
      await expect(subject.storage.assignNewId(worldId, "roles.json")).rejects.toMatchObject({
        code: "io",
      });
    });
  });
}
