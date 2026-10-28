import { describe, expect, it } from "vitest";
import {
  documentFileName,
  generateId,
  isId,
  relationshipFileName,
  slugify,
  worldFolderName,
} from "./ids.ts";

const id = "pm6i0t9upq3sgptb";

describe("generateId", () => {
  it("produces 16 lowercase letters and digits", () => {
    expect(generateId()).toMatch(/^[a-z0-9]{16}$/);
  });

  it("does not repeat across 10,000 ids", () => {
    const ids = new Set(Array.from({ length: 10_000 }, () => generateId()));
    expect(ids.size).toBe(10_000);
  });
});

describe("isId", () => {
  it("accepts a valid id and rejects uppercase", () => {
    expect(isId(id)).toBe(true);
    expect(isId("PM6i0t9upq3sgptb")).toBe(false);
  });
});

describe("slugify", () => {
  it.each([
    ["Sir Lancelot du Lac", "sir-lancelot-du-lac"],
    ['Morgan: "le" Fay?', "morgan-le-fay"],
    ["Lancelot's sword", "lancelots-sword"],
    ["St. Kay.", "st-kay"],
    ["ルフィ", "ルフィ"],
    ["???", "untitled"],
    ["   ", "untitled"],
  ])("slugify(%j) is %j", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it("normalises to NFC", () => {
    expect(slugify("Café")).toBe("café");
  });

  it("caps slugs at 60 characters without a trailing dash", () => {
    expect(slugify("a".repeat(200))).toHaveLength(60);
    expect(slugify("ab-".repeat(30)).endsWith("-")).toBe(false);
  });
});

describe("file and folder names", () => {
  it("appends the id, so a reserved Windows name is never the whole base name", () => {
    expect(documentFileName("Con", id)).toBe("con-pm6i0t9upq3sgptb.json");
  });

  it("names a relationship after both characters", () => {
    expect(relationshipFileName("Arthur", "Mordred", id)).toBe(
      "arthur-mordred-pm6i0t9upq3sgptb.json",
    );
  });

  it("names a world folder", () => {
    expect(worldFolderName("Camelot", id)).toBe("camelot-pm6i0t9upq3sgptb");
  });
});
