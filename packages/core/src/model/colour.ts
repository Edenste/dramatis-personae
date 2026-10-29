import { DEFAULT_CHARACTER_COLOR, resolveCharacterColor } from "@dramatis-personae/schema";
import type { WorldModel } from "./world-model.ts";

/** The colour bordering a character's portrait (spec §6), or grey for an unknown character. */
export function characterColor(model: WorldModel, characterId: string): string {
  const character = model.get("character", characterId);
  if (!character) return DEFAULT_CHARACTER_COLOR;
  return resolveCharacterColor(character, model.library("roles").roles);
}
