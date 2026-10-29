import type { Role } from "./files/roles.ts";

/** The colour of a character with no colour of their own and no coloured role. */
export const DEFAULT_CHARACTER_COLOR = "#99aab5";

/**
 * The colour bordering a character's portrait (spec §6): their own colour, then
 * their highest-ranked major role with a colour, then minor, then grey.
 */
export function resolveCharacterColor(
  character: { color: string | null; roles: readonly string[] },
  roles: readonly Role[],
): string {
  if (character.color) return character.color;
  const held = new Set(character.roles);
  for (const kind of ["major", "minor"] as const) {
    const role = roles.find((r) => r.kind === kind && r.color !== null && held.has(r.id));
    if (role?.color) return role.color;
  }
  return DEFAULT_CHARACTER_COLOR;
}
