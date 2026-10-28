import { z } from "zod";
import { ColourSchema, IdSchema, fileBase } from "./common.ts";

export const RoleSchema = z.looseObject({
  id: IdSchema,
  name: z.string().min(1),
  kind: z.enum(["major", "minor"]),
  color: ColourSchema.nullable(),
  leaders: z.array(IdSchema).default([]),
});
export type Role = z.infer<typeof RoleSchema>;

/** List order is priority, highest first, within each kind. */
export const RolesFileSchema = z.looseObject({
  ...fileBase,
  roles: z.array(RoleSchema),
});
export type RolesFile = z.infer<typeof RolesFileSchema>;
