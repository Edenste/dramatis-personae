import { z } from "zod";
import { ColourSchema, FileNameSchema, IdSchema, fileBase } from "./common.ts";

const fraction = z.number().min(0).max(1);

export const PortraitSchema = z.looseObject({
  /** File name inside assets/portraits/. */
  file: FileNameSchema,
  /** Crop square, as fractions of the original image's size. */
  crop: z.looseObject({ x: fraction, y: fraction, size: fraction }),
});

export const CharacterFileSchema = z.looseObject({
  ...fileBase,
  id: IdSchema,
  name: z.string().min(1),
  color: ColourSchema.nullable().default(null),
  roles: z.array(IdSchema).default([]),
  templates: z.array(IdSchema).default([]),
  /** Keys of one-off fields shown on this character only. */
  extraFields: z.array(z.string()).default([]),
  fields: z.record(z.string(), z.unknown()).default({}),
  portrait: PortraitSchema.optional(),
  body: z.string().default(""),
});
export type CharacterFile = z.infer<typeof CharacterFileSchema>;
