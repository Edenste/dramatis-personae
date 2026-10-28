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
  });
}
