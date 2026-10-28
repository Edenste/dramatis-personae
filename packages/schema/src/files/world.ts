import { z } from "zod";
import { IdSchema, fileBase } from "./common.ts";

export const WorldFileSchema = z.looseObject({
  ...fileBase,
  id: IdSchema,
  name: z.string().min(1),
  schemaVersion: z.number().int().min(0),
  mainView: IdSchema.nullable(),
});
export type WorldFile = z.infer<typeof WorldFileSchema>;
