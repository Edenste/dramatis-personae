import { describe, expect, it } from "vitest";
import { Ajv2020 } from "ajv/dist/2020.js";
import { FILE_KINDS, type FieldDefinition } from "./files/index.ts";
import { buildWorldJsonSchema, schemaRefFor } from "./json-schema.ts";

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
  $schema: "../world.schema.json#/$defs/character",
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
  ajv.addSchema(buildWorldJsonSchema(fields), "world");
  return ajv.compile({ $ref: "world#/$defs/character" });
}

describe("buildWorldJsonSchema", () => {
  it("has one definition per file kind", () => {
    const schema = buildWorldJsonSchema(fields) as { $defs: Record<string, unknown> };
    expect(Object.keys(schema.$defs).sort()).toEqual([...FILE_KINDS].sort());
  });

  it("types the world's fields on characters", () => {
    const schema = buildWorldJsonSchema(fields) as {
      $defs: { character: { properties: { fields: { properties: Record<string, unknown> } } } };
    };
    expect(schema.$defs.character.properties.fields.properties.bloodType).toMatchObject({
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
  it("points documents one folder up and libraries alongside", () => {
    expect(schemaRefFor("character")).toBe("../world.schema.json#/$defs/character");
    expect(schemaRefFor("roles")).toBe("./world.schema.json#/$defs/roles");
    expect(schemaRefFor("world")).toBe("./world.schema.json#/$defs/world");
  });
});
