import type { WorldState } from "./world-mirror.ts";

const assets = (world: string, file: string) =>
  `/api/worlds/${world}/assets/portraits/${encodeURIComponent(file)}`;

/**
 * The 256 × 256 thumbnail the server makes from a portrait. `fingerprint` is the
 * character file's, so a new photo or crop is fetched afresh instead of from cache.
 */
export const thumbnailUrl = (world: string, file: string, fingerprint: string): string =>
  `${assets(world, file)}.thumb.webp?v=${fingerprint}`;

/** The uploaded image itself, which only the crop sheet loads. */
export const originalUrl = (world: string, file: string, fingerprint: string): string =>
  `${assets(world, file)}?v=${fingerprint}`;

/** A character's thumbnail address, or null when they have no portrait. */
export function portraitSrc(state: WorldState, world: string, id: string): string | null {
  const entry = state.files.get(`character:${id}`);
  const file = (entry?.data as { portrait?: { file: string } } | undefined)?.portrait?.file;
  return entry && file ? thumbnailUrl(world, file, entry.fingerprint) : null;
}
