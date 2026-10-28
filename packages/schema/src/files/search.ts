import { z } from "zod";
import { IdSchema, fileBase } from "./common.ts";

export const SearchFileSchema = z.looseObject({
  ...fileBase,
  id: IdSchema,
  name: z.string().min(1),
  /** Shape defined by the roles and search spec. */
  query: z.record(z.string(), z.unknown()),
});
export type SearchFile = z.infer<typeof SearchFileSchema>;
