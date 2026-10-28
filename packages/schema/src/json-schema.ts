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

/**
 * The world's `world.schema.json`: one definition per file kind, with each
 * character's `fields` typed from the world's field library.
 */
export function buildWorldJsonSchema(fields: FieldDefinition[]): JsonSchema {
  const $defs: Record<string, JsonSchema> = {};
  for (const kind of FILE_KINDS) $defs[kind] = toJsonSchema(FILE_SCHEMAS[kind]);

  const character = $defs.character as { properties: Record<string, JsonSchema> };
  character.properties.fields = {
    type: "object",
    properties: Object.fromEntries(fields.map((field) => [field.key, fieldSchema(field)])),
    // Values whose field isn't shown are kept, so unknown keys are allowed.
    additionalProperties: true,
  };

  return { $schema: "https://json-schema.org/draft/2020-12/schema", $defs };
}

/** The `$schema` value a file of this kind uses: documents live one folder down. */
export function schemaRefFor(kind: FileKind): string {
  const base = isDocumentKind(kind) ? "../world.schema.json" : "./world.schema.json";
  return `${base}#/$defs/${kind}`;
}
