import { describe, expect, it } from "vitest";
import type { ServerMessage } from "@dramatis-personae/schema";
import { IDS, WORLD, characterFile, snapshot } from "../test-utils/fixtures.ts";
import {
  applyMessage,
  characterById,
  characterList,
  fromSnapshot,
  worldName,
} from "./world-mirror.ts";

const renamedMerlin = (seq: number): ServerMessage => ({
  type: "changed",
  world: WORLD,
  seq,
  files: [characterFile(IDS.merlin, "Myrddin")],
  removed: [],
});

describe("the world mirror", () => {
  it("lists characters by name, with their colours", () => {
    const state = fromSnapshot(snapshot());
    expect(characterList(state)).toEqual([
      { id: IDS.arthur, name: "Arthur", color: "#99aab5" },
      { id: IDS.lancelot, name: "Lancelot", color: "#3b6fd4" },
      { id: IDS.merlin, name: "Merlin", color: "#99aab5" },
    ]);
    expect(characterById(state, IDS.lancelot)?.name).toBe("Lancelot");
    expect(characterById(state, "nobodyxxxxxxxxxx")).toBeNull();
    expect(worldName(state)).toBe("Camelot");
  });

  it("applies a newer change", () => {
    const next = applyMessage(fromSnapshot(snapshot()), renamedMerlin(6));
    expect(next).not.toBe("reload");
    if (next === "reload") return;
    expect(characterById(next, IDS.merlin)?.name).toBe("Myrddin");
    expect(next.seq).toBe(6);
  });

  it("ignores a push that isn't newer than the snapshot", () => {
    const state = fromSnapshot(snapshot());
    expect(applyMessage(state, renamedMerlin(5))).toBe(state);
    expect(applyMessage(state, renamedMerlin(4))).toBe(state);
  });

  it("removes deleted files", () => {
    const next = applyMessage(fromSnapshot(snapshot()), {
      type: "changed",
      world: WORLD,
      seq: 6,
      files: [],
      removed: [`character:${IDS.merlin}`],
    });
    if (next === "reload") throw new Error("unexpected reload");
    expect(characterById(next, IDS.merlin)).toBeNull();
  });

  it("asks for a reload", () => {
    expect(applyMessage(fromSnapshot(snapshot()), { type: "reload", world: WORLD, seq: 6 })).toBe(
      "reload",
    );
  });

  it("tracks the unsaved state and problems", () => {
    const state = fromSnapshot(snapshot());
    const unsaved = applyMessage(state, {
      type: "save-state",
      world: WORLD,
      seq: 6,
      unsaved: true,
      message: "Couldn't save your change.",
    });
    if (unsaved === "reload") throw new Error("unexpected reload");
    expect(unsaved.unsaved).toEqual({ message: "Couldn't save your change." });
    const problem = {
      code: "invalid-json" as const,
      path: "characters/kay.json",
      message: "Not valid JSON",
    };
    const withProblems = applyMessage(unsaved, {
      type: "problems",
      world: WORLD,
      seq: 7,
      problems: [problem],
    });
    if (withProblems === "reload") throw new Error("unexpected reload");
    expect(withProblems.problems).toEqual([problem]);
  });
});
