import { z } from "zod";
import { IdSchema, fileBase } from "./common.ts";

export const TemplateSchema = z.looseObject({
  id: IdSchema,
  name: z.string().min(1),
  /** The role this template is offered for, if any. */
  role: IdSchema.nullable(),
  fields: z.array(z.string()),
});
export type Template = z.infer<typeof TemplateSchema>;

export const TemplatesFileSchema = z.looseObject({
  ...fileBase,
  templates: z.array(TemplateSchema),
});
export type TemplatesFile = z.infer<typeof TemplatesFileSchema>;
