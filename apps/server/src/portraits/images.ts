import sharp from "sharp";
import type { Crop } from "@dramatis-personae/schema";

export const THUMBNAIL_SIZE = 256;

export type PortraitExt = ".jpg" | ".png" | ".webp" | ".gif" | ".avif";

/**
 * A square cut from an image, in the image's upright orientation: `x` and `y`
 * are fractions of its width and height, `size` is a fraction of its shorter side.
 */
export type { Crop };

const EXTENSIONS: Record<string, PortraitExt> = {
  jpeg: ".jpg",
  png: ".png",
  webp: ".webp",
  gif: ".gif",
};

/** The format and upright size of a supported portrait, or null for anything else (SVG, HEIC, junk). */
export async function inspectImage(
  bytes: Uint8Array,
): Promise<{ ext: PortraitExt; width: number; height: number } | null> {
  try {
    const meta = await sharp(bytes).metadata();
    const ext =
      meta.format === "heif" && meta.compression === "av1"
        ? ".avif"
        : meta.format
          ? EXTENSIONS[meta.format]
          : undefined;
    if (!ext || !meta.width || !meta.height) return null;
    // Orientations 5–8 turn the image on its side.
    const sideways = (meta.orientation ?? 1) >= 5;
    return {
      ext,
      width: sideways ? meta.height : meta.width,
      height: sideways ? meta.width : meta.height,
    };
  } catch {
    return null;
  }
}

/** Where a crop's square lands, in pixels of an image this size. */
function squareIn(crop: Crop, width: number, height: number) {
  const side = Math.min(width, height) * crop.size;
  return { left: crop.x * width, top: crop.y * height, side };
}

export function cropFits(crop: Crop, width: number, height: number): boolean {
  const { left, top, side } = squareIn(crop, width, height);
  const slack = 1e-6;
  return side > 0 && left + side <= width + slack && top + side <= height + slack;
}

/** A 256 × 256 WebP of the crop square, cut from the first frame of the original. */
export async function makeThumbnail(original: Uint8Array, crop: Crop): Promise<Uint8Array> {
  const info = await inspectImage(original);
  if (!info) throw new Error("Not a supported image");
  const { left, top, side } = squareIn(crop, info.width, info.height);
  const clamp = (value: number, max: number) => Math.min(Math.max(Math.round(value), 0), max);
  const size = Math.max(1, Math.min(Math.round(side), info.width, info.height));
  return sharp(original)
    .autoOrient()
    .extract({
      left: clamp(left, info.width - size),
      top: clamp(top, info.height - size),
      width: size,
      height: size,
    })
    .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE)
    .webp()
    .toBuffer();
}
