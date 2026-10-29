import { describe, expect, it } from "vitest";
import type { CommandResult } from "@dramatis-personae/schema";
import { UndoHistory, historyFor, toBatch } from "./undo.ts";

const result = (name: string): CommandResult => ({
  inverse: { commands: [{ type: "world.rename", name }] },
  fingerprints: { world: name.padEnd(64, "0").slice(0, 64) },
});

describe("UndoHistory", () => {
  it("undoes with the fingerprints that followed the edit", () => {
    const history = new UndoHistory();
    expect(history.canUndo).toBe(false);
    history.recordEdit(result("Camelot"));
    expect(history.canUndo).toBe(true);
    const entry = history.takeUndo()!;
    expect(toBatch(entry)).toEqual({
      commands: [{ type: "world.rename", name: "Camelot" }],
      expect: result("Camelot").fingerprints,
    });
    expect(history.canUndo).toBe(false);
  });

  it("turns an undo into a redo, and a new edit clears the redos", () => {
    const history = new UndoHistory();
    history.recordEdit(result("Camelot"));
    history.takeUndo();
    history.recordUndone(result("Logres"));
    expect(history.canRedo).toBe(true);
    history.takeRedo();
    history.recordRedone(result("Camelot"));
    expect(history.canUndo).toBe(true);
    history.recordUndone(result("Logres"));
    history.recordEdit(result("Avalon"));
    expect(history.canRedo).toBe(false);
  });

  it("keeps the newest 100 edits", () => {
    const history = new UndoHistory();
    for (let i = 0; i < 101; i++) history.recordEdit(result(`World ${i}`));
    let count = 0;
    let last;
    while (history.canUndo) {
      last = history.takeUndo();
      count++;
    }
    expect(count).toBe(100);
    expect(last?.inverse.commands[0]).toEqual({ type: "world.rename", name: "World 1" });
  });
});

describe("historyFor", () => {
  it("keeps one history per world for the page's lifetime", () => {
    expect(historyFor("a")).toBe(historyFor("a"));
    expect(historyFor("a")).not.toBe(historyFor("b"));
  });
});
