import { describe, expect, it } from "vitest";
import { IDS, WORLD, snapshot, withData } from "../test-utils/fixtures.ts";
import { originalUrl, portraitSrc, thumbnailUrl } from "./portraits.ts";
import { SYSTEM_COLOURS } from "./system-colours.ts";
import { fromSnapshot } from "./world-mirror.ts";

describe("portraitSrc", () => {
  const withPortrait = () => {
    const base = snapshot();
    base.files = base.files.map((f) =>
      f.ref.kind === "character" && f.ref.id === IDS.lancelot
        ? withData(f, { portrait: { file: "lancelot-x.png", crop: { x: 0, y: 0, size: 1 } } })
        : f,
    );
    return fromSnapshot(base);
  };

  it("gives the thumbnail address for a character with a portrait", () => {
    const state = withPortrait();
    const print = state.files.get(`character:${IDS.lancelot}`)!.fingerprint;
    expect(portraitSrc(state, WORLD, IDS.lancelot)).toBe(
      `/api/worlds/${WORLD}/assets/portraits/lancelot-x.png.thumb.webp?v=${print}`,
    );
  });

  it("is null for a character without one, or who doesn't exist", () => {
    const state = withPortrait();
    expect(portraitSrc(state, WORLD, IDS.arthur)).toBeNull();
    expect(portraitSrc(state, WORLD, "zzzzzzzzzzzzzzzz")).toBeNull();
  });
});

describe("portrait addresses", () => {
  it("point at the thumbnail, carrying the character file's fingerprint", () => {
    expect(thumbnailUrl("w", "lancelot-x.png", "abc")).toBe(
      "/api/worlds/w/assets/portraits/lancelot-x.png.thumb.webp?v=abc",
    );
  });

  it("point at the original without the thumbnail suffix", () => {
    expect(originalUrl("w", "lancelot-x.png", "abc")).toBe(
      "/api/worlds/w/assets/portraits/lancelot-x.png?v=abc",
    );
  });

  it("encode file names", () => {
    expect(thumbnailUrl("w", "a b.png", "1")).toContain("a%20b.png.thumb.webp");
  });
});

describe("system colours", () => {
  it("are the thirteen Apple colours, in order", () => {
    expect(SYSTEM_COLOURS).toHaveLength(13);
    expect(SYSTEM_COLOURS[0]).toEqual({ name: "Red", hex: "#FF3B30" });
    expect(SYSTEM_COLOURS[7]).toEqual({ name: "Blue", hex: "#007AFF" });
    expect(SYSTEM_COLOURS.at(-1)).toEqual({ name: "Grey", hex: "#8E8E93" });
  });
});
