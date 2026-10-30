import sharp, { type Sharp } from "sharp";
import { describe, expect, it } from "vitest";
import { THUMBNAIL_SIZE, cropFits, inspectImage, makeThumbnail } from "./images.ts";

const RED = { r: 255, g: 0, b: 0 };
const BLUE = { r: 0, g: 0, b: 255 };

/** A width × height image whose left half is red and right half is blue. */
async function halves(width: number, height: number): Promise<Sharp> {
  const left = await sharp({
    create: { width: width / 2, height, channels: 3, background: RED },
  })
    .png()
    .toBuffer();
  return sharp({ create: { width, height, channels: 3, background: BLUE } }).composite([
    { input: left, left: 0, top: 0 },
  ]);
}

const solid = (width: number, height: number, background = RED) =>
  sharp({ create: { width, height, channels: 3, background } });

async function centrePixel(bytes: Uint8Array): Promise<[number, number, number]> {
  const { data, info } = await sharp(bytes).raw().toBuffer({ resolveWithObject: true });
  const at =
    (Math.floor(info.height / 2) * info.width + Math.floor(info.width / 2)) * info.channels;
  return [data[at]!, data[at + 1]!, data[at + 2]!];
}

/** WebP is lossy, so colours are compared within a few steps. */
function expectNear(actual: number[], expected: number[]): void {
  for (const [i, value] of expected.entries()) expect(Math.abs(actual[i]! - value)).toBeLessThan(8);
}

describe("inspectImage", () => {
  it("names the extension and size of each accepted format", async () => {
    const base = solid(400, 200);
    const cases = [
      [".png", await base.clone().png().toBuffer()],
      [".jpg", await base.clone().jpeg().toBuffer()],
      [".webp", await base.clone().webp().toBuffer()],
      [".gif", await base.clone().gif().toBuffer()],
      [".avif", await base.clone().avif().toBuffer()],
    ] as const;
    for (const [ext, bytes] of cases) {
      expect(await inspectImage(bytes), ext).toEqual({ ext, width: 400, height: 200 });
    }
  });

  it("refuses SVG, text and empty input", async () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>');
    expect(await inspectImage(svg)).toBeNull();
    expect(await inspectImage(new TextEncoder().encode("not an image"))).toBeNull();
    expect(await inspectImage(new Uint8Array())).toBeNull();
  });

  it("measures after the EXIF rotation", async () => {
    const rotated = await solid(400, 200).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    expect(await inspectImage(rotated)).toEqual({ ext: ".jpg", width: 200, height: 400 });
  });
});

describe("cropFits", () => {
  it("accepts a square inside the image and refuses one that overflows", () => {
    expect(cropFits({ x: 0.5, y: 0, size: 1 }, 400, 200)).toBe(true);
    expect(cropFits({ x: 0.6, y: 0, size: 1 }, 400, 200)).toBe(false);
  });
});

describe("makeThumbnail", () => {
  it("cuts the crop square and resizes it to 256 × 256 WebP", async () => {
    const original = await (await halves(400, 200)).png().toBuffer();
    const thumb = await makeThumbnail(original, { x: 0, y: 0, size: 1 });
    const meta = await sharp(thumb).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual([
      "webp",
      THUMBNAIL_SIZE,
      THUMBNAIL_SIZE,
    ]);
    // The crop covers x 0–200: all red.
    expectNear(await centrePixel(thumb), [255, 0, 0]);
    const right = await makeThumbnail(original, { x: 0.5, y: 0, size: 1 });
    expectNear(await centrePixel(right), [0, 0, 255]);
  });

  it("applies crop coordinates to the upright image, not the stored pixels", async () => {
    // Stored 400 × 200, left red and right blue; orientation 6 shows it 200 × 400 with red on top.
    const stored = await (
      await halves(400, 200)
    )
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const top = await centrePixel(await makeThumbnail(stored, { x: 0, y: 0, size: 1 }));
    const bottom = await centrePixel(await makeThumbnail(stored, { x: 0, y: 0.5, size: 1 }));
    expect(top[0]).toBeGreaterThan(200);
    expect(top[2]).toBeLessThan(60);
    expect(bottom[2]).toBeGreaterThan(200);
    expect(bottom[0]).toBeLessThan(60);
  });

  it("uses the first frame of an animated GIF", async () => {
    const frame = (c: { r: number; g: number; b: number }) =>
      Buffer.from(Array.from({ length: 16 * 16 }, () => [c.r, c.g, c.b]).flat());
    const raw = Buffer.concat([frame(RED), frame(BLUE)]);
    const gif = await sharp(raw, { raw: { width: 16, height: 32, channels: 3, pageHeight: 16 } })
      .gif({ loop: 0, delay: [100, 100] })
      .toBuffer();
    expect((await sharp(gif, { pages: -1 }).metadata()).pages).toBe(2);
    expectNear(await centrePixel(await makeThumbnail(gif, { x: 0, y: 0, size: 1 })), [255, 0, 0]);
  });
});
