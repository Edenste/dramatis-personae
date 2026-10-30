import { describe, expect, it } from "vitest";
import { characterHref, parseCharacterHref, safeWebHref } from "./links.ts";

const id = "pm6i0t9upq3sgptb";

describe("character links", () => {
  it("round-trips an id", () => {
    expect(characterHref(id)).toBe(`character:${id}`);
    expect(parseCharacterHref(characterHref(id))).toBe(id);
  });

  it.each(["character:BAD", "character:", `character:${id}x`, "https://example.com", id])(
    "doesn't read %j as a character",
    (href) => {
      expect(parseCharacterHref(href)).toBeNull();
    },
  );
});

describe("safeWebHref", () => {
  it.each(["https://example.com/a?b=1", "http://example.com", "mailto:kay@example.com"])(
    "keeps %s",
    (href) => {
      expect(safeWebHref(href)).toBe(href);
    },
  );

  it.each([
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "data:text/html,<b>x</b>",
    "file:///etc/passwd",
    "/relative/path",
    "example.com",
    "",
  ])("refuses %j", (href) => {
    expect(safeWebHref(href)).toBeNull();
  });
});
