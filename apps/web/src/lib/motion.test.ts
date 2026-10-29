import { afterEach, describe, expect, it, vi } from "vitest";
import { easeSettle, settleIn, settleOut } from "./motion.ts";

describe("easeSettle", () => {
  it("starts at 0 and ends at 1", () => {
    expect(easeSettle(0)).toBeCloseTo(0, 6);
    expect(easeSettle(1)).toBeCloseTo(1, 6);
  });

  it("is cubic-bezier(.2,.8,.2,1): most of the way there by halfway", () => {
    expect(easeSettle(0.5)).toBeGreaterThan(0.94);
    expect(easeSettle(0.5)).toBeLessThan(0.95);
  });

  it("never goes backwards", () => {
    let last = 0;
    for (let i = 1; i <= 100; i++) {
      const value = easeSettle(i / 100);
      expect(value).toBeGreaterThanOrEqual(last);
      last = value;
    }
  });
});

describe("settle transitions", () => {
  const div = () => document.createElement("div");
  afterEach(() => vi.restoreAllMocks());

  it("fade and grow in from 96% over 200ms", () => {
    const config = settleIn(div());
    expect(config.duration).toBe(200);
    expect(config.css?.(0.5, 0.5)).toContain("scale(0.98)");
    expect(config.css?.(0.5, 0.5)).toContain("opacity: 0.5");
  });

  it("fade and shrink out to 98% over 150ms", () => {
    const config = settleOut(div());
    expect(config.duration).toBe(150);
    expect(config.css?.(0, 1)).toContain("scale(0.98)");
  });

  it("only fade when the system asks for reduced motion", () => {
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query) => ({ matches: query.includes("reduce"), media: query }) as unknown as MediaQueryList,
    );
    expect(settleIn(div()).css?.(0.5, 0.5)).not.toContain("transform");
    expect(settleOut(div()).css?.(0.5, 0.5)).not.toContain("transform");
  });
});
