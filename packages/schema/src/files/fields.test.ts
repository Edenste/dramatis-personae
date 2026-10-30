import { describe, expect, it } from "vitest";
import { FieldDefinitionSchema, FieldsFileSchema, fieldValueSchema } from "./fields.ts";

const measurement = { key: "shoeSize", label: "Shoe size", type: "measurement", default: false };

describe("fields file", () => {
  it("defaults the subtitle to null and keeps one that is set", () => {
    expect(FieldsFileSchema.parse({ fields: [] }).subtitle).toBeNull();
    expect(FieldsFileSchema.parse({ fields: [], subtitle: "title" }).subtitle).toBe("title");
  });

  it("allows a unit on a measurement field", () => {
    expect(FieldDefinitionSchema.parse({ ...measurement, unit: "EU" }).unit).toBe("EU");
  });

  it("rejects a unit on any other field", () => {
    const result = FieldsFileSchema.safeParse({
      fields: [{ key: "title", label: "Title", type: "text", default: true, unit: "EU" }],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["fields", 0, "unit"]);
  });

  it("accepts a measurement with an empty unit", () => {
    expect(fieldValueSchema("measurement").safeParse({ value: 42, unit: "" }).success).toBe(true);
  });
});
