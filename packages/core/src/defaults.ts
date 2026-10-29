import {
  CURRENT_SCHEMA_VERSION,
  FILE_KINDS,
  SCHEMAS_FOLDER,
  buildWorldJsonSchemas,
  generateId as defaultGenerateId,
  schemaFileName,
  schemaRefFor,
  type FieldDefinition,
  type FieldsFile,
  type RelationshipType,
  type RelationshipTypesFile,
  type RolesFile,
  type TemplatesFile,
  type ViewFile,
  type WorldFile,
} from "@dramatis-personae/schema";

export { DEFAULT_CHARACTER_COLOR } from "@dramatis-personae/schema";

type TypeDefaults = Pick<RelationshipType, "name" | "direction" | "color" | "line">;

function type(
  name: string,
  direction: RelationshipType["direction"],
  color: string,
  style: RelationshipType["line"]["style"],
  weight: RelationshipType["line"]["weight"] = "normal",
): TypeDefaults {
  return { name, direction, color, line: { style, weight } };
}

/** Copied into every new world, each with a fresh id (spec §5.4). */
export const DEFAULT_RELATIONSHIP_TYPES: readonly TypeDefaults[] = [
  type("Family", "two-way", "#e0a030", "solid"),
  type("Friends", "two-way", "#3fa34d", "solid"),
  type("Close friends", "two-way", "#2bb673", "solid", "thick"),
  type("Acquaintances", "two-way", "#9aa0a6", "dotted"),
  type("Partners", "two-way", "#e05a8a", "solid", "thick"),
  type("Former partners", "two-way", "#c99aae", "dashed"),
  type("Allies", "two-way", "#3b82f6", "solid"),
  type("Colleagues", "two-way", "#64748b", "solid", "thin"),
  type("Rivals", "two-way", "#f08c2e", "dashed"),
  type("Enemies", "two-way", "#d64545", "dashed", "thick"),
  type("Crush", "one-way", "#f29cc0", "dotted"),
  type("Mentor", "one-way", "#8b5cf6", "solid"),
  type("Student", "one-way", "#a78bfa", "dashed"),
  type("Leader", "one-way", "#4f46e5", "solid"),
  type("Follower", "one-way", "#818cf8", "dashed"),
  type("Parent", "one-way", "#e0a030", "solid"),
  type("Child", "one-way", "#e0a030", "dashed"),
  type("Admirer", "one-way", "#f2b8d0", "dotted", "thin"),
  type("Protector", "one-way", "#0ea5a4", "solid"),
];

export const DEFAULT_FIELDS: readonly FieldDefinition[] = [
  {
    key: "birthday",
    label: "Birthday",
    type: "date",
    section: "personal",
    default: true,
    calendar: { show: true, color: "#e0a030", title: "{name}'s birthday" },
  },
];

export interface NewWorldFiles {
  world: WorldFile;
  fields: FieldsFile;
  roles: RolesFile;
  relationshipTypes: RelationshipTypesFile;
  templates: TemplatesFile;
  mainView: ViewFile;
}

export function newWorldFiles(name: string, generateId = defaultGenerateId): NewWorldFiles {
  const mainView: ViewFile = {
    $schema: schemaRefFor("view"),
    id: generateId(),
    name: "Main",
    camera: { x: 0, y: 0, zoom: 1 },
    focus: null,
    depth: null,
    filters: {},
    clustering: "highest",
  };
  return {
    world: {
      $schema: schemaRefFor("world"),
      id: generateId(),
      name,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      mainView: mainView.id,
    },
    fields: { $schema: schemaRefFor("fields"), fields: DEFAULT_FIELDS.map((f) => ({ ...f })) },
    roles: { $schema: schemaRefFor("roles"), roles: [] },
    relationshipTypes: {
      $schema: schemaRefFor("relationshipTypes"),
      types: DEFAULT_RELATIONSHIP_TYPES.map((t) => ({
        id: generateId(),
        ...t,
        line: { ...t.line },
      })),
    },
    templates: { $schema: schemaRefFor("templates"), templates: [] },
    mainView,
  };
}

/** The generated `schemas/` files for a world with these fields, as world-relative paths. */
export function schemaFiles(fields: FieldDefinition[]): Array<{ path: string; data: unknown }> {
  const schemas = buildWorldJsonSchemas(fields);
  return FILE_KINDS.map((kind) => ({
    path: `${SCHEMAS_FOLDER}/${schemaFileName(kind)}`,
    data: schemas[kind],
  }));
}
