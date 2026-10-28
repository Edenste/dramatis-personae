import { z } from "zod";
import { DateValueSchema } from "../date.ts";
import { ColourSchema, IdSchema, fileBase } from "./common.ts";

export const FIELD_TYPES = [
  "text",
  "number",
  "date",
  "colour",
  "select",
  "multiselect",
  "character",
  "measurement",
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const FieldDefinitionSchema = z
  .looseObject({
    key: z
      .string()
      .regex(/^[A-Za-z][A-Za-z0-9_]*$/, "must start with a letter and use letters, digits or _"),
    label: z.string().min(1),
    type: z.enum(FIELD_TYPES),
    section: z.string().optional(),
    default: z.boolean(),
    options: z.array(z.string()).optional(),
    calendar: z
      .object({ show: z.boolean(), color: ColourSchema.nullable(), title: z.string() })
      .optional(),
  })
  .superRefine((field, ctx) => {
    const hasOptions = field.type === "select" || field.type === "multiselect";
    if (hasOptions && field.options === undefined) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "select fields need options" });
    }
    if (!hasOptions && field.options !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message: "only select fields have options",
      });
    }
    if (field.type !== "date" && field.calendar !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["calendar"],
        message: "only date fields can appear on the calendar",
      });
    }
  });
export type FieldDefinition = z.infer<typeof FieldDefinitionSchema>;

export const FieldsFileSchema = z.looseObject({
  ...fileBase,
  fields: z.array(FieldDefinitionSchema),
});
export type FieldsFile = z.infer<typeof FieldsFileSchema>;

/** The schema a character's value for a field of this type must match. */
export function fieldValueSchema(type: FieldType): z.ZodType {
  switch (type) {
    case "text":
    case "select":
      return z.string();
    case "number":
      return z.number();
    case "date":
      return DateValueSchema;
    case "colour":
      return ColourSchema;
    case "multiselect":
      return z.array(z.string());
    case "character":
      return IdSchema;
    case "measurement":
      return z.object({ value: z.number(), unit: z.string().min(1) });
  }
}
