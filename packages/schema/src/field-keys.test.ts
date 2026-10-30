import { describe, expect, it } from "vitest";
import { fieldKeyFor } from "./field-keys.ts";

const none = new Set<string>();

describe("fieldKeyFor", () => {
  it("makes a camelCase key from a label", () => {
    expect(fieldKeyFor("Shoe size", none)).toBe("shoeSize");
  });

  it("numbers a key that is taken", () => {
    expect(fieldKeyFor("Shoe size", new Set(["shoeSize"]))).toBe("shoeSize2");
    expect(fieldKeyFor("Shoe size", new Set(["shoeSize", "shoeSize2"]))).toBe("shoeSize3");
  });

  it("falls back to field when no usable letters are left", () => {
    expect(fieldKeyFor("???", none)).toBe("field");
    expect(fieldKeyFor("???", new Set(["field"]))).toBe("field2");
  });

  it("starts with a letter", () => {
    expect(fieldKeyFor("2nd weapon", none)).toBe("field2ndWeapon");
  });

  it("strips diacritics", () => {
    expect(fieldKeyFor("Épée", none)).toBe("epee");
  });

  it.each(["Shoe size", "???", "2nd weapon", "Épée", "ルフィ", "a_b c"])(
    "gives %j a valid key",
    (label) => {
      expect(fieldKeyFor(label, none)).toMatch(/^[A-Za-z][A-Za-z0-9_]*$/);
    },
  );
});
