import { DEFAULT_CHARACTER_COLOR } from "../defaults.ts";
import type { WorldModel } from "./world-model.ts";

/**
 * The colour bordering a character's portrait (spec §6): their own colour, then
 * their highest-ranked major role with a colour, then minor, then grey.
 */
export function characterColor(model: WorldModel, characterId: string): string {
  const character = model.get("character", characterId);
  if (!character) return DEFAULT_CHARACTER_COLOR;
  if (character.color) return character.color;
  const held = new Set(character.roles);
  const roles = model.library("roles").roles;
  for (const kind of ["major", "minor"] as const) {
    const role = roles.find((r) => r.kind === kind && r.color !== null && held.has(r.id));
    if (role?.color) return role.color;
  }
  return DEFAULT_CHARACTER_COLOR;
}
