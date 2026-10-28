import { z } from "zod";
import { IdSchema, fileBase } from "./common.ts";

/** Everything between one pair of characters. */
export const RelationshipFileSchema = z.looseObject({
  ...fileBase,
  id: IdSchema,
  a: IdSchema,
  b: IdSchema,
  twoWay: z.array(IdSchema).default([]),
  aToB: z.array(IdSchema).default([]),
  bToA: z.array(IdSchema).default([]),
  notes: z.object({ a: z.string(), b: z.string() }).default({ a: "", b: "" }),
});
export type RelationshipFile = z.infer<typeof RelationshipFileSchema>;
