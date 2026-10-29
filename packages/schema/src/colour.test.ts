import { describe, expect, it } from "vitest";
import { DEFAULT_CHARACTER_COLOR, resolveCharacterColor } from "./colour.ts";
import type { Role } from "./files/roles.ts";

const role = (id: string, kind: Role["kind"], color: string | null): Role => ({
  id,
  name: id,
  kind,
  color,
  leaders: [],
});

const knights = role("knightsxxxxxxxxx", "major", "#3b6fd4");
const court = role("courtxxxxxxxxxxx", "major", "#e0a030");
const quest = role("questxxxxxxxxxxx", "minor", "#2bb673");
const plainMajor = role("plainmajorxxxxxx", "major", null);

describe("resolveCharacterColor", () => {
  it("uses the character's own colour first", () => {
    const character = { color: "#123456", roles: [knights.id] };
    expect(resolveCharacterColor(character, [knights])).toBe("#123456");
  });

  it("prefers a coloured major role over a coloured minor one", () => {
    const character = { color: null, roles: [quest.id, knights.id] };
    expect(resolveCharacterColor(character, [quest, knights])).toBe("#3b6fd4");
  });

  it("falls back to a coloured minor role when no major role has a colour", () => {
    const character = { color: null, roles: [plainMajor.id, quest.id] };
    expect(resolveCharacterColor(character, [plainMajor, quest])).toBe("#2bb673");
  });

  it("gives the default grey when no held role has a colour", () => {
    const character = { color: null, roles: [plainMajor.id] };
    expect(resolveCharacterColor(character, [plainMajor, knights])).toBe("#99aab5");
    expect(DEFAULT_CHARACTER_COLOR).toBe("#99aab5");
  });

  it("follows the roles list's order within a kind", () => {
    const character = { color: null, roles: [knights.id, court.id] };
    expect(resolveCharacterColor(character, [court, knights])).toBe("#e0a030");
    expect(resolveCharacterColor(character, [knights, court])).toBe("#3b6fd4");
  });
});
