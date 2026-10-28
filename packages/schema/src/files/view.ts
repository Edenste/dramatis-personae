import { z } from "zod";
import { IdSchema, fileBase } from "./common.ts";

export const ViewFileSchema = z.looseObject({
  ...fileBase,
  id: IdSchema,
  name: z.string().min(1),
  camera: z.looseObject({ x: z.number(), y: z.number(), zoom: z.number().positive() }),
  focus: IdSchema.nullable(),
  depth: z.number().int().min(0).nullable(),
  /** Shape defined by the graph views spec. */
  filters: z.record(z.string(), z.unknown()).default({}),
  clustering: z.enum(["highest", "all"]),
});
export type ViewFile = z.infer<typeof ViewFileSchema>;
