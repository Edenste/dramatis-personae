import { z } from "zod";
import { FileRefSchema } from "./refs.ts";

export const PROBLEM_CODES = [
  "invalid-json",
  "invalid-document",
  "duplicate-id",
  "dangling-reference",
  "leader-without-role",
  "duplicate-pair",
  "self-relationship",
  "type-direction-mismatch",
  "invalid-field-value",
  "missing-portrait",
  "unsupported-portrait",
] as const;
export type ProblemCode = (typeof PROBLEM_CODES)[number];

export const ProblemSchema = z.object({
  code: z.enum(PROBLEM_CODES),
  /** Relative to the world folder, with forward slashes. */
  path: z.string(),
  message: z.string(),
  line: z.number().int().optional(),
  ref: FileRefSchema.optional(),
  fix: z.enum(["assignNewId", "removeReference"]).optional(),
});
export type Problem = z.infer<typeof ProblemSchema>;
