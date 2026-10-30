import { describe, expect, it } from "vitest";
import { cropToPixels, largestCentredCrop, moveCrop, resizeCrop } from "./crop.ts";

describe("largestCentredCrop", () => {
  it("is the whole shorter side, centred along the longer one", () => {
    expect(largestCentredCrop(400, 200)).toEqual({ x: 0.25, y: 0, size: 1 });
    expect(largestCentredCrop(200, 400)).toEqual({ x: 0, y: 0.25, size: 1 });
    expect(largestCentredCrop(300, 300)).toEqual({ x: 0, y: 0, size: 1 });
  });
});

describe("moveCrop", () => {
  it("moves by a fraction of the shorter side", () => {
    // 0.1 of 200 px is 20 px, which is 0.05 of the 400 px width.
    expect(moveCrop({ x: 0, y: 0, size: 0.5 }, 0.1, 0, 400, 200).x).toBeCloseTo(0.05);
    expect(moveCrop({ x: 0, y: 0, size: 0.5 }, 0, 0.25, 400, 200).y).toBeCloseTo(0.25);
  });

  it("stops at the edges of the image", () => {
    const crop = { x: 0.25, y: 0, size: 1 };
    expect(moveCrop(crop, 5, 0, 400, 200).x).toBeCloseTo(0.5); // 200 + 200 px = the right edge
    expect(moveCrop(crop, -5, 0, 400, 200).x).toBe(0);
    expect(moveCrop(crop, 0, 5, 400, 200).y).toBe(0); // as tall as the image: nowhere to go
  });

  it("keeps the size", () => {
    expect(moveCrop({ x: 0.1, y: 0.1, size: 0.4 }, 0.1, 0.1, 400, 400).size).toBe(0.4);
  });
});

describe("resizeCrop", () => {
  it("keeps the centre", () => {
    const crop = resizeCrop({ x: 0.25, y: 0, size: 1 }, 0.5, 400, 200);
    expect(crop.size).toBe(0.5);
    expect(crop.x).toBeCloseTo(0.375); // centre 200 px, side 100 px
    expect(crop.y).toBeCloseTo(0.25);
  });

  it("never goes below a tenth or above the whole side", () => {
    expect(resizeCrop({ x: 0, y: 0, size: 0.5 }, 0.05, 400, 400).size).toBe(0.1);
    expect(resizeCrop({ x: 0, y: 0, size: 0.5 }, 3, 400, 400).size).toBe(1);
  });

  it("slides back inside the image when growing at an edge", () => {
    const crop = resizeCrop({ x: 0.75, y: 0.5, size: 0.5 }, 1, 400, 200);
    expect(crop.x).toBeCloseTo(0.5);
    expect(crop.y).toBe(0);
  });
});

describe("cropToPixels", () => {
  it("gives the square's corner and side in pixels", () => {
    expect(cropToPixels({ x: 0.25, y: 0, size: 1 }, 400, 200)).toEqual({
      left: 100,
      top: 0,
      side: 200,
    });
  });
});
