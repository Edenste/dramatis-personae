import { shownFields } from "@dramatis-personae/schema";
import type { WorldModel } from "./world-model.ts";

/**
 * Keys of the fields a character's profile shows, in library order: the world's
 * defaults, plus their templates' fields, plus their one-off fields (spec §5.2).
 */
export function shownFieldKeys(model: WorldModel, characterId: string): string[] {
  const character = model.get("character", characterId);
  if (!character) return [];
  return shownFields(character, model.library("fields"), model.library("templates")).map(
    (shown) => shown.field.key,
  );
}
