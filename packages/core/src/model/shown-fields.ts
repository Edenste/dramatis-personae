import type { WorldModel } from "./world-model.ts";

/**
 * Keys of the fields a character's profile shows, in library order: the world's
 * defaults, plus their templates' fields, plus their one-off fields (spec §5.2).
 */
export function shownFieldKeys(model: WorldModel, characterId: string): string[] {
  const character = model.get("character", characterId);
  if (!character) return [];
  const shown = new Set(character.extraFields);
  const templates = model.library("templates").templates;
  for (const id of character.templates) {
    for (const key of templates.find((t) => t.id === id)?.fields ?? []) shown.add(key);
  }
  return model
    .library("fields")
    .fields.filter((field) => field.default || shown.has(field.key))
    .map((field) => field.key);
}
