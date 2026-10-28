import { z } from "zod";
import { ColourSchema, IdSchema, fileBase } from "./common.ts";

export const RelationshipTypeSchema = z.looseObject({
  id: IdSchema,
  name: z.string().min(1),
  direction: z.enum(["two-way", "one-way"]),
  color: ColourSchema,
  line: z.looseObject({
    style: z.enum(["solid", "dashed", "dotted"]),
    weight: z.enum(["thin", "normal", "thick"]),
  }),
});
export type RelationshipType = z.infer<typeof RelationshipTypeSchema>;

export const RelationshipTypesFileSchema = z.looseObject({
  ...fileBase,
  types: z.array(RelationshipTypeSchema),
});
export type RelationshipTypesFile = z.infer<typeof RelationshipTypesFileSchema>;
