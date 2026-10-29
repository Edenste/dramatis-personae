import { describe, expect, it } from "vitest";
import { contrastRatio } from "./contrast.ts";

describe("contrastRatio", () => {
  it("gives 21 for black on white", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
  });

  it("matches the WCAG reference grey that just passes AA", () => {
    const ratio = contrastRatio("#767676", "#ffffff");
    expect(ratio).toBeGreaterThan(4.54);
    expect(ratio).toBeLessThan(4.55);
  });

  it("gives 1 for identical colours, and reads short hex", () => {
    expect(contrastRatio("#abc", "#aabbcc")).toBeCloseTo(1, 5);
  });

  it("blends a translucent colour over the background first", () => {
    expect(contrastRatio("rgba(0, 0, 0, 0)", "#ffffff")).toBeCloseTo(1, 5);
    expect(contrastRatio("rgba(0, 0, 0, 1)", "#ffffff")).toBeCloseTo(21, 5);
  });
});
