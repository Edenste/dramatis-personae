import type { CharacterFile } from "./files/character.ts";
import type { FieldDefinition, FieldsFile } from "./files/fields.ts";
import type { TemplatesFile } from "./files/templates.ts";

export type FieldSource = "default" | "template" | "extra";

/**
 * The fields a character's profile shows, in library order: the world's
 * defaults, the fields of the character's templates, and their one-off fields
 * (Foundations spec §5.2). `template` names the first template that lists a field.
 */
export function shownFields(
  character: Pick<CharacterFile, "templates" | "extraFields">,
  fields: FieldsFile,
  templates: TemplatesFile,
): Array<{ field: FieldDefinition; source: FieldSource; template?: string }> {
  const held = character.templates.flatMap(
    (id) => templates.templates.find((t) => t.id === id) ?? [],
  );
  const extra = new Set(character.extraFields);
  const shown: Array<{ field: FieldDefinition; source: FieldSource; template?: string }> = [];
  for (const field of fields.fields) {
    if (field.default) {
      shown.push({ field, source: "default" });
      continue;
    }
    const template = held.find((t) => t.fields.includes(field.key));
    if (template) shown.push({ field, source: "template", template: template.name });
    else if (extra.has(field.key)) shown.push({ field, source: "extra" });
  }
  return shown;
}
