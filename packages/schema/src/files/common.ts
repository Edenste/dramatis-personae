import { z } from "zod";
import { ID_PATTERN } from "../ids.ts";

export const IdSchema = z.string().regex(ID_PATTERN, "must be 16 lowercase letters and digits");
export const ColourSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "must be a hex colour like #3b6fd4");

/** Every file may point to the generated JSON Schema. */
export const fileBase = { $schema: z.string().optional() };
