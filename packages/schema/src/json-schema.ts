import { z } from "zod";
import { FILE_SCHEMAS, fieldValueSchema, type FieldDefinition } from "./files/index.ts";
import { isDocumentKind, FILE_KINDS, type FileKind } from "./kinds.ts";

type JsonSchema = Record<string, unknown>;

function toJsonSchema(schema: z.ZodType): JsonSchema {
  // "input" mode: keys with defaults are optional, as they are in hand-written files.
  const json = z.toJSONSchema(schema, { target: "draft-2020-12", io: "input" }) as JsonSchema;
  delete json.$schema;
  return json;
}

function fieldSchema(field: FieldDefinition): JsonSchema {
  const json = toJsonSchema(fieldValueSchema(field.type));
  if (field.type === "select" && field.options) json.enum = field.options;
  if (field.type === "multiselect" && field.options) json.items = { enum: field.options };
  json.title = field.label;
  return json;
}

/** Generated schemas live in this folder of every world, one file per kind. */
export const SCHEMAS_FOLDER = "schemas";

const SCHEMA_FILE_STEMS: Record<FileKind, string> = {
  world: "world",
  fields: "fields",
  roles: "roles",
  relationshipTypes: "relationship-types",
  templates: "templates",
  character: "character",
  relationship: "relationship",
  event: "event",
  view: "view",
  search: "search",
};

export function schemaFileName(kind: FileKind): string {
  return `${SCHEMA_FILE_STEMS[kind]}.schema.json`;
}

/**
 * A world's `schemas/` files: one standalone schema per file kind, with each
 * character's `fields` typed from the world's field library.
 */
export function buildWorldJsonSchemas(fields: FieldDefinition[]): Record<FileKind, JsonSchema> {
  const schemas = {} as Record<FileKind, JsonSchema>;
  for (const kind of FILE_KINDS) {
    schemas[kind] = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      ...toJsonSchema(FILE_SCHEMAS[kind]),
    };
  }

  const character = schemas.character as { properties: Record<string, JsonSchema> };
  character.properties.fields = {
    type: "object",
    properties: Object.fromEntries(fields.map((field) => [field.key, fieldSchema(field)])),
    // Values whose field isn't shown are kept, so unknown keys are allowed.
    additionalProperties: true,
  };

  return schemas;
}

/**
 * The `$schema` value a file of this kind uses: documents live one folder down.
 * No `#` fragment: VS Code reads a fragment in `$schema` as part of the file name.
 */
export function schemaRefFor(kind: FileKind): string {
  return `${isDocumentKind(kind) ? ".." : "."}/${SCHEMAS_FOLDER}/${schemaFileName(kind)}`;
}
