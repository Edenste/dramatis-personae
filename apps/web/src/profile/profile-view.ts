import {
  resolveCharacterColor,
  shownFields,
  type CharacterFile,
  type FieldDefinition,
  type FieldSource,
  type FieldsFile,
  type RolesFile,
  type Template,
  type TemplatesFile,
} from "@dramatis-personae/schema";
import { characterById, type WorldState } from "../lib/world-mirror.ts";
import { formatValue } from "./format.ts";

export interface FieldRow {
  field: FieldDefinition;
  /** The character's value, or undefined when they have none. */
  value: unknown;
  source: FieldSource;
  /** The name of the template that shows the field, when `source` is "template". */
  template?: string;
}

/** Everything a profile shows for one character, worked out from the world's files. */
export interface ProfileView {
  character: CharacterFile;
  /** Fingerprint of the character's file; it changes whenever the file does. */
  fingerprint: string;
  color: string;
  /** Where the colour comes from, in words. */
  colorReason: string;
  subtitle: string | null;
  roles: Array<{ id: string; name: string; color: string | null }>;
  rows: FieldRow[];
  /** The templates the character has, and the ones they don't. */
  templates: Template[];
  otherTemplates: Template[];
  /** Library fields the character doesn't show, for the Add a field list. */
  unshownFields: FieldDefinition[];
  /** True while the character's file is invalid on disk, so edits would be refused. */
  blocked: boolean;
}

const NO_FIELDS: FieldsFile = { subtitle: null, fields: [] };
const NO_TEMPLATES: TemplatesFile = { templates: [] };
const NO_ROLES: RolesFile = { roles: [] };

function colorReason(character: CharacterFile, roles: RolesFile["roles"]): string {
  if (character.color) return "Chosen for this character";
  const held = new Set(character.roles);
  for (const kind of ["major", "minor"] as const) {
    const role = roles.find((r) => r.kind === kind && r.color !== null && held.has(r.id));
    if (role) return `From ${role.name}`;
  }
  return "Default grey";
}

export function profileView(state: WorldState, id: string): ProfileView | null {
  const entry = state.files.get(`character:${id}`);
  if (!entry) return null;
  const character = entry.data as CharacterFile;
  const fields = (state.files.get("fields")?.data as FieldsFile | undefined) ?? NO_FIELDS;
  const templates =
    (state.files.get("templates")?.data as TemplatesFile | undefined) ?? NO_TEMPLATES;
  const rolesFile = (state.files.get("roles")?.data as RolesFile | undefined) ?? NO_ROLES;

  const shown = shownFields(character, fields, templates);
  const shownKeys = new Set(shown.map((s) => s.field.key));

  const subtitleField = fields.fields.find((f) => f.key === fields.subtitle);
  const subtitleValue = subtitleField ? character.fields[subtitleField.key] : undefined;
  let subtitle: string | null = null;
  if (subtitleField && subtitleValue !== undefined) {
    subtitle =
      subtitleField.type === "character"
        ? (characterById(state, subtitleValue as string)?.name ?? null)
        : formatValue(subtitleField, subtitleValue);
  }

  return {
    character,
    fingerprint: entry.fingerprint,
    color: resolveCharacterColor(character, rolesFile.roles),
    colorReason: colorReason(character, rolesFile.roles),
    subtitle: subtitle || null,
    roles: character.roles.flatMap((roleId) => {
      const role = rolesFile.roles.find((r) => r.id === roleId);
      return role ? [{ id: role.id, name: role.name, color: role.color }] : [];
    }),
    rows: shown.map(({ field, source, template }) => ({
      field,
      value: character.fields[field.key],
      source,
      ...(template === undefined ? {} : { template }),
    })),
    templates: character.templates.flatMap(
      (templateId) => templates.templates.find((t) => t.id === templateId) ?? [],
    ),
    otherTemplates: templates.templates.filter((t) => !character.templates.includes(t.id)),
    unshownFields: fields.fields.filter((f) => !shownKeys.has(f.key)),
    blocked: state.problems.some(
      (p) => p.path === entry.path && (p.code === "invalid-json" || p.code === "invalid-document"),
    ),
  };
}
