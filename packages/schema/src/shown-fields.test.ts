import { describe, expect, it } from "vitest";
import type { FieldsFile } from "./files/fields.ts";
import type { TemplatesFile } from "./files/templates.ts";
import { shownFields } from "./shown-fields.ts";

const field = (key: string, isDefault: boolean) => ({
  key,
  label: key,
  type: "text" as const,
  default: isDefault,
});
const fields: FieldsFile = {
  subtitle: null,
  fields: [
    field("title", true),
    field("weapon", false),
    field("steed", false),
    field("bloodType", false),
    field("shoeSize", false),
  ],
};
const templates: TemplatesFile = {
  templates: [{ id: "t2m8x4k1q9v7r3w5", name: "Knight", role: null, fields: ["weapon", "steed"] }],
};

describe("shownFields", () => {
  it("lists defaults, template fields and one-off fields in library order, with their source", () => {
    const shown = shownFields(
      { templates: ["t2m8x4k1q9v7r3w5"], extraFields: ["bloodType"] },
      fields,
      templates,
    );
    expect(shown.map((s) => [s.field.key, s.source, s.template])).toEqual([
      ["title", "default", undefined],
      ["weapon", "template", "Knight"],
      ["steed", "template", "Knight"],
      ["bloodType", "extra", undefined],
    ]);
  });

  it("hides fields whose template was removed", () => {
    const shown = shownFields({ templates: [], extraFields: [] }, fields, templates);
    expect(shown.map((s) => s.field.key)).toEqual(["title"]);
  });
});
