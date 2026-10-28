import { describe, expect, it } from "vitest";
import { Ajv2020 } from "ajv/dist/2020.js";
import { FILE_KINDS, type FieldDefinition } from "./files/index.ts";
import { buildWorldJsonSchemas, schemaFileName, schemaRefFor } from "./json-schema.ts";

const fields: FieldDefinition[] = [
  { key: "title", label: "Title", type: "text", default: true },
  {
    key: "bloodType",
    label: "Blood type",
    type: "select",
    section: "personal",
    default: false,
    options: ["A", "B", "AB", "O"],
  },
];

const lancelot = {
  $schema: "../schemas/character.schema.json",
  id: "pm6i0t9upq3sgptb",
  name: "Lancelot",
  color: null,
  roles: [],
  templates: [],
  extraFields: ["bloodType"],
  fields: { title: "Knight of the Round Table", bloodType: "O" },
  body: "",
};

function characterValidator() {
  const ajv = new Ajv2020({ strict: false });
  return ajv.compile(buildWorldJsonSchemas(fields).character);
}

describe("buildWorldJsonSchemas", () => {
  it("has one standalone 2020-12 schema per file kind", () => {
    const schemas = buildWorldJsonSchemas(fields);
    expect(Object.keys(schemas).sort()).toEqual([...FILE_KINDS].sort());
    for (const kind of FILE_KINDS) {
      expect(schemas[kind].$schema).toBe("https://json-schema.org/draft/2020-12/schema");
      expect(JSON.stringify(schemas[kind])).not.toContain("world.schema.json");
    }
  });

  it("types the world's fields on characters", () => {
    const character = buildWorldJsonSchemas(fields).character as {
      properties: { fields: { properties: Record<string, unknown> } };
    };
    expect(character.properties.fields.properties.bloodType).toMatchObject({
      enum: ["A", "B", "AB", "O"],
    });
  });

  it("validates characters with Ajv", () => {
    const validate = characterValidator();
    expect(validate(lancelot)).toBe(true);
    expect(validate({ id: "x" })).toBe(false);
    expect(validate({ ...lancelot, fields: { bloodType: "Q" } })).toBe(false);
  });
});

describe("schemaRefFor", () => {
  it("points each kind at its own file in schemas/, with no fragment", () => {
    expect(schemaRefFor("character")).toBe("../schemas/character.schema.json");
    expect(schemaRefFor("world")).toBe("./schemas/world.schema.json");
    expect(schemaRefFor("relationshipTypes")).toBe("./schemas/relationship-types.schema.json");
    expect(schemaRefFor("roles")).toBe("./schemas/roles.schema.json");
    for (const kind of FILE_KINDS) expect(schemaRefFor(kind)).not.toContain("#");
  });

  it("names one file per kind", () => {
    expect(FILE_KINDS.map(schemaFileName)).toEqual([
      "world.schema.json",
      "fields.schema.json",
      "roles.schema.json",
      "relationship-types.schema.json",
      "templates.schema.json",
      "character.schema.json",
      "relationship.schema.json",
      "event.schema.json",
      "view.schema.json",
      "search.schema.json",
    ]);
  });
});
