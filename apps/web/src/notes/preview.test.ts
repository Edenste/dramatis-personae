import { describe, expect, it } from "vitest";
import { previewRanges, type PreviewRange } from "./preview.ts";

const none = new Set<number>();
const kinds = (ranges: PreviewRange[]) => ranges.map((r) => r.kind);
const slice = (text: string, r: PreviewRange) => text.slice(r.from, r.to);
const of = (ranges: PreviewRange[], kind: PreviewRange["kind"]) =>
  ranges.filter((r) => r.kind === kind);

describe("headings", () => {
  const text = "# Backstory";

  it("hides the # and styles the line in view mode", () => {
    const ranges = previewRanges(text, none, "view");
    expect(of(ranges, "hide").map((r) => slice(text, r))).toEqual(["# "]);
    const heading = of(ranges, "heading");
    expect(heading).toHaveLength(1);
    expect(heading[0]).toMatchObject({ from: 0, to: text.length, level: 1 });
  });

  it("shows the # on the line the cursor is on, but keeps the style", () => {
    const ranges = previewRanges(text, new Set([1]), "edit");
    expect(of(ranges, "hide")).toEqual([]);
    expect(of(ranges, "heading")).toHaveLength(1);
  });

  it("hides the # on other lines while editing", () => {
    const ranges = previewRanges("# A\n\nplain", new Set([3]), "edit");
    expect(of(ranges, "hide").map((r) => slice("# A\n\nplain", r))).toEqual(["# "]);
  });

  it("ignores which lines are active in view mode", () => {
    expect(of(previewRanges(text, new Set([1]), "view"), "hide")).toHaveLength(1);
  });

  it("styles levels 2 and 3, and shows anything deeper as level 3", () => {
    const levels = (t: string) => of(previewRanges(t, none, "view"), "heading")[0]?.level;
    expect(levels("## B")).toBe(2);
    expect(levels("### C")).toBe(3);
    expect(levels("#### Deep")).toBe(3);
  });
});

describe("lists", () => {
  const text = "- a\n1. b\n- [x] c\n- [ ] d";
  const ranges = previewRanges(text, none, "view");

  it("makes a bullet, a number and checkboxes", () => {
    expect(kinds(ranges).filter((k) => ["bullet", "ordered", "task"].includes(k))).toEqual([
      "bullet",
      "ordered",
      "task",
      "task",
    ]);
  });

  it("knows which checkboxes are ticked, and where the box is", () => {
    const tasks = of(ranges, "task");
    expect(tasks.map((t) => t.checked)).toEqual([true, false]);
    expect(tasks.map((t) => text.slice(t.at, t.at! + 3))).toEqual(["[x]", "[ ]"]);
  });

  it("keeps bullets and boxes on the cursor's line", () => {
    const active = previewRanges(text, new Set([1, 3]), "edit");
    expect(of(active, "bullet")).toHaveLength(1);
    expect(of(active, "task")).toHaveLength(2);
  });
});

describe("blocks", () => {
  it("styles a quote and hides its marker", () => {
    const text = "> q";
    const ranges = previewRanges(text, none, "view");
    expect(of(ranges, "quote")).toHaveLength(1);
    expect(of(ranges, "hide").map((r) => slice(text, r))).toEqual(["> "]);
  });

  it("makes a divider and hides its dashes", () => {
    const text = "above\n\n---\n\nbelow";
    const ranges = previewRanges(text, none, "view");
    expect(of(ranges, "divider")).toHaveLength(1);
    expect(of(ranges, "hide").map((r) => slice(text, r))).toContain("---");
  });

  it("styles each line of a fenced code block", () => {
    const text = "```\nlet a = 1;\n```";
    const ranges = previewRanges(text, none, "view");
    expect(of(ranges, "code-block")).toHaveLength(1);
    expect(slice(text, of(ranges, "code-block")[0]!)).toBe(text);
  });

  it("styles nothing for a table", () => {
    expect(previewRanges("| a | b |\n|---|---|\n| 1 | 2 |", none, "view")).toEqual([]);
  });
});

describe("inline styles", () => {
  const text = "**b** *i* ~~s~~ `c`";
  const ranges = previewRanges(text, none, "view");

  it("styles bold, italic, strikethrough and code", () => {
    expect(kinds(ranges).filter((k) => k !== "hide")).toEqual([
      "bold",
      "italic",
      "strike",
      "inline-code",
    ]);
  });

  it("hides every marker", () => {
    expect(of(ranges, "hide").map((r) => slice(text, r))).toEqual([
      "**",
      "**",
      "*",
      "*",
      "~~",
      "~~",
      "`",
      "`",
    ]);
  });

  it("shows the markers on the cursor's line", () => {
    expect(of(previewRanges(text, new Set([1]), "edit"), "hide")).toEqual([]);
  });
});

describe("links", () => {
  const id = "c1a9m3x8k2q7v5w0";

  it("makes a character link of a character: href", () => {
    const text = `[Arthur](character:${id})`;
    const ranges = previewRanges(text, none, "view");
    const link = of(ranges, "character-link");
    expect(link).toHaveLength(1);
    expect(link[0]).toMatchObject({ from: 0, to: text.length, id, label: "Arthur" });
  });

  it("shows a character link's markup, not the chip, on the cursor's line", () => {
    const text = `see [Arthur](character:${id})`;
    expect(of(previewRanges(text, new Set([1]), "edit"), "character-link")).toEqual([]);
  });

  it("makes a web link, hiding the brackets and address", () => {
    const text = "[a page](https://example.com)";
    const ranges = previewRanges(text, none, "view");
    const link = of(ranges, "web-link");
    expect(link).toHaveLength(1);
    expect(link[0]).toMatchObject({ href: "https://example.com" });
    expect(slice(text, link[0]!)).toBe("a page");
    expect(of(ranges, "hide").map((r) => slice(text, r))).toEqual(["[", "](https://example.com)"]);
  });

  it("keeps a web link styled while its markup shows", () => {
    const ranges = previewRanges("[a page](https://example.com)", new Set([1]), "edit");
    expect(of(ranges, "web-link")).toHaveLength(1);
    expect(of(ranges, "hide")).toEqual([]);
  });

  it("leaves a link to an unsafe address as plain text", () => {
    const ranges = previewRanges("[x](javascript:alert(1))", none, "view");
    expect(kinds(ranges)).toEqual(["plain-link"]);
  });
});
