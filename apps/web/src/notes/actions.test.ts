import { describe, expect, it } from "vitest";
import { contextGroups, deleteBlockChange, filterActions, toggleMarks } from "./actions.ts";

const apply = (doc: string, changes: Array<{ from: number; to: number; insert: string }>) =>
  [...changes]
    .sort((a, b) => b.from - a.from)
    .reduce((text, c) => text.slice(0, c.from) + c.insert + text.slice(c.to), doc);

describe("contextGroups", () => {
  it("has Turn into, the clipboard and Delete block, plus formatting with a selection", () => {
    const without = contextGroups(false).map((g) => g.map((a) => a.label));
    expect(without).toEqual([["Turn into"], ["Cut", "Copy", "Paste"], ["Delete block"]]);
    const withText = contextGroups(true).map((g) => g.map((a) => a.label));
    expect(withText).toEqual([
      ["Turn into"],
      ["Bold", "Italic", "Strikethrough", "Code", "Link…"],
      ["Cut", "Copy", "Paste"],
      ["Delete block"],
    ]);
  });

  it("gives Turn into a submenu of the blocks, and marks Delete block as dangerous", () => {
    const groups = contextGroups(false);
    expect(groups[0]![0]!.submenu!.map((a) => a.id)).toContain("turn:h1");
    expect(groups.at(-1)![0]!.danger).toBe(true);
  });
});

describe("filterActions", () => {
  it("matches labels, looking inside the Turn into submenu", () => {
    const labels = (q: string) => filterActions(contextGroups(true), q).map((a) => a.label);
    expect(labels("head")).toEqual(["Heading 1", "Heading 2", "Heading 3"]);
    expect(labels("BOLD")).toEqual(["Bold"]);
    expect(labels("zzz")).toEqual([]);
  });

  it("lists every action, flat, for an empty search", () => {
    const all = filterActions(contextGroups(true), "").map((a) => a.id);
    expect(all).toContain("turn:code");
    expect(all).toContain("paste");
    expect(all).not.toContain("turn-into");
  });
});

describe("toggleMarks", () => {
  it("wraps the selection in the marker", () => {
    expect(apply("x", toggleMarks("x", 0, 1, "**"))).toBe("**x**");
    expect(apply("a b c", toggleMarks("a b c", 2, 3, "~~"))).toBe("a ~~b~~ c");
  });

  it("takes the marker off a selection it already surrounds", () => {
    expect(apply("**x**", toggleMarks("**x**", 2, 3, "**"))).toBe("x");
  });

  it("takes the marker off a selection that includes it", () => {
    expect(apply("**x**", toggleMarks("**x**", 0, 5, "**"))).toBe("x");
  });

  it("doesn't mistake bold's markers for italic's", () => {
    expect(apply("**x**", toggleMarks("**x**", 2, 3, "*"))).toBe("***x***");
  });
});

describe("deleteBlockChange", () => {
  it("removes the block and the line break after it", () => {
    const doc = "a\n\n- b\n- c";
    expect(apply(doc, [deleteBlockChange(doc, 5)!])).toBe("a\n\n- c");
  });

  it("removes the line break before the last block", () => {
    const doc = "a\n\n- b\n- c";
    expect(apply(doc, [deleteBlockChange(doc, 9)!])).toBe("a\n\n- b");
  });

  it("does nothing on a blank line", () => {
    expect(deleteBlockChange("a\n\nb", 2)).toBeNull();
  });
});
