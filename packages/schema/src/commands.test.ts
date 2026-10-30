import { describe, expect, it } from "vitest";
import { CommandSchema, PORTRAIT_UPLOAD_LIMIT, PortraitCropSchema } from "./commands.ts";

const id = "t2m8x4k1q9v7r3w5";

describe("library commands", () => {
  it.each([
    {
      type: "field.create",
      field: {
        key: "shoeSize",
        label: "Shoe size",
        type: "measurement",
        default: false,
        unit: "EU",
      },
    },
    { type: "field.update", key: "shoeSize", set: { label: "Shoe", unit: null, default: true } },
    { type: "field.move", key: "shoeSize", index: 0 },
    { type: "field.delete", key: "shoeSize" },
    { type: "fields.setSubtitle", key: "title" },
    { type: "fields.setSubtitle", key: null },
    { type: "template.create", template: { name: "Knight" } },
    { type: "template.create", template: { id, name: "Knight", role: null, fields: ["weapon"] } },
    { type: "template.update", id, set: { name: "Squire", role: null, fields: [] } },
    { type: "template.move", id, index: 1 },
    { type: "template.delete", id },
  ])("accepts $type", (command) => {
    expect(CommandSchema.safeParse(command).success).toBe(true);
  });

  it.each([
    { type: "field.move", key: "title", index: -1 },
    { type: "template.create", template: { name: "" } },
    { type: "fields.setSubtitle" },
    { type: "template.move", id: "BAD", index: 0 },
  ])("rejects a malformed command", (command) => {
    expect(CommandSchema.safeParse(command).success).toBe(false);
  });
});

describe("portrait upload", () => {
  it("reads the crop from query strings", () => {
    expect(PortraitCropSchema.parse({ x: "0.1", y: "0", size: "1" })).toEqual({
      x: 0.1,
      y: 0,
      size: 1,
    });
  });

  it("refuses a crop outside 0–1 or with no size", () => {
    expect(PortraitCropSchema.safeParse({ x: "1.5", y: "0", size: "1" }).success).toBe(false);
    expect(PortraitCropSchema.safeParse({ x: "0", y: "0", size: "0" }).success).toBe(false);
  });

  it("limits uploads to 20 MB", () => {
    expect(PORTRAIT_UPLOAD_LIMIT).toBe(20 * 1024 * 1024);
  });
});
