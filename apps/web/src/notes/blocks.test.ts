import { describe, expect, it } from "vitest";
import { BLOCKS, blockAt, turnInto, type BlockType } from "./blocks.ts";

/** Applies changes given in the original text's positions. */
function apply(doc: string, changes: Array<{ from: number; to: number; insert: string }>): string {
  return [...changes]
    .sort((a, b) => b.from - a.from)
    .reduce((text, c) => text.slice(0, c.from) + c.insert + text.slice(c.to), doc);
}
const into = (doc: string, type: BlockType, from = 0, to = doc.length) =>
  apply(doc, turnInto(doc, from, to, type));

describe("BLOCKS", () => {
  it("lists the blocks the menus offer, in order", () => {
    expect(BLOCKS.map((b) => b.label)).toEqual([
      "Text",
      "Heading 1",
      "Heading 2",
      "Heading 3",
      "Bulleted list",
      "Numbered list",
      "To-do list",
      "Quote",
      "Divider",
      "Code block",
    ]);
  });
});

describe("turnInto", () => {
  it("swaps one block prefix for another", () => {
    expect(into("- a", "h2")).toBe("## a");
    expect(into("## a", "text")).toBe("a");
    expect(into("> a", "bullet")).toBe("- a");
    expect(into("1. a", "todo")).toBe("- [ ] a");
    expect(into("- [x] a", "h1")).toBe("# a");
  });

  it("adds a prefix to plain text", () => {
    expect(into("a", "h1")).toBe("# a");
    expect(into("a", "h3")).toBe("### a");
    expect(into("a", "quote")).toBe("> a");
    expect(into("a", "bullet")).toBe("- a");
  });

  it("turns every line a selection touches, numbering a numbered list", () => {
    expect(into("a\nb", "todo")).toBe("- [ ] a\n- [ ] b");
    expect(into("a\nb", "ordered")).toBe("1. a\n2. b");
    expect(into("a\nb\nc", "quote", 2, 3)).toBe("a\n> b\nc");
  });

  it("wraps a code block around the lines", () => {
    expect(into("x", "code")).toBe("```\nx\n```");
    expect(into("a\nb", "code")).toBe("```\na\nb\n```");
  });

  it("makes a divider without losing what the line says", () => {
    expect(into("", "divider")).toBe("---");
    expect(into("a", "divider")).toBe("a\n---");
  });

  it("works on the line the cursor is in", () => {
    expect(into("one\ntwo\nthree", "h2", 5, 5)).toBe("one\n## two\nthree");
  });
});

describe("blockAt", () => {
  const doc = "a\n\n- b\n- c";

  it("finds the list item holding the position", () => {
    expect(blockAt(doc, 9)).toEqual({ from: 7, to: 10 });
    expect(blockAt(doc, 5)).toEqual({ from: 3, to: 6 });
  });

  it("finds a paragraph and a heading", () => {
    expect(blockAt(doc, 0)).toEqual({ from: 0, to: 1 });
    expect(blockAt("# Title\n\ntext", 3)).toEqual({ from: 0, to: 7 });
  });

  it("finds a whole fenced code block from a line inside it", () => {
    const code = "x\n\n```\nlet a = 1;\nlet b = 2;\n```\n\ny";
    expect(blockAt(code, 14)).toEqual({ from: 3, to: 32 });
  });

  it("finds a whole quote", () => {
    expect(blockAt("> one\n> two", 8)).toEqual({ from: 0, to: 11 });
  });

  it("finds nothing on a blank line", () => {
    expect(blockAt(doc, 2)).toBeNull();
  });
});
