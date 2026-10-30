import type { Crop } from "@dramatis-personae/schema";

/**
 * Crop maths on the upright image. `x` and `y` are fractions of its width and
 * height; `size` is the square's side as a fraction of the shorter side.
 */

export const MIN_CROP = 0.1;

const clamp = (value: number, low: number, high: number) => Math.min(Math.max(value, low), high);

/** The farthest left or top a square of this side can start from. */
const room = (side: number, length: number) => Math.max(0, (length - side) / length);

/** The whole shorter side, centred along the longer one. */
export function largestCentredCrop(width: number, height: number): Crop {
  const side = Math.min(width, height);
  return { x: (width - side) / 2 / width, y: (height - side) / 2 / height, size: 1 };
}

export function cropToPixels(
  crop: Crop,
  width: number,
  height: number,
): { left: number; top: number; side: number } {
  return { left: crop.x * width, top: crop.y * height, side: Math.min(width, height) * crop.size };
}

/** Moves the square by `dx`, `dy` (fractions of the shorter side), keeping it inside the image. */
export function moveCrop(crop: Crop, dx: number, dy: number, width: number, height: number): Crop {
  const shorter = Math.min(width, height);
  const side = shorter * crop.size;
  return {
    ...crop,
    x: clamp(crop.x + (dx * shorter) / width, 0, room(side, width)),
    y: clamp(crop.y + (dy * shorter) / height, 0, room(side, height)),
  };
}

/** Resizes the square around its centre, from a tenth of the shorter side to all of it. */
export function resizeCrop(crop: Crop, size: number, width: number, height: number): Crop {
  const next = clamp(size, MIN_CROP, 1);
  const { left, top, side: before } = cropToPixels(crop, width, height);
  const side = Math.min(width, height) * next;
  const centreX = left + before / 2;
  const centreY = top + before / 2;
  return {
    x: clamp((centreX - side / 2) / width, 0, room(side, width)),
    y: clamp((centreY - side / 2) / height, 0, room(side, height)),
    size: next,
  };
}
