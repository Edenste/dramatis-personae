import { z } from "zod";
import { PortraitSchema } from "./files/character.ts";
import { ColourSchema, IdSchema } from "./files/common.ts";
import { FileRefSchema } from "./refs.ts";

/** Character keys a command may set directly. */
const CharacterSetSchema = z
  .object({
    name: z.string().min(1),
    color: ColourSchema.nullable(),
    roles: z.array(IdSchema),
    templates: z.array(IdSchema),
    extraFields: z.array(z.string()),
    portrait: PortraitSchema.nullable(),
    body: z.string(),
  })
  .partial();

export const WorldRenameSchema = z.object({
  type: z.literal("world.rename"),
  name: z.string().min(1),
});

export const CharacterCreateSchema = z.object({
  type: z.literal("character.create"),
  character: CharacterSetSchema.extend({
    id: IdSchema.optional(),
    name: z.string().min(1),
    fields: z.record(z.string(), z.unknown()).optional(),
  }),
});

export const CharacterUpdateSchema = z.object({
  type: z.literal("character.update"),
  id: IdSchema,
  set: CharacterSetSchema.optional(),
  setFields: z.record(z.string(), z.unknown()).optional(),
  unsetFields: z.array(z.string()).optional(),
});

export const CharacterDeleteSchema = z.object({
  type: z.literal("character.delete"),
  id: IdSchema,
});

/** Puts files back exactly as they were (`data: null` deletes). Undo uses this. */
export const RestoreSchema = z.object({
  type: z.literal("restore"),
  files: z.array(
    z.object({ ref: FileRefSchema, fileName: z.string().nullable(), data: z.unknown() }),
  ),
});

export const CommandSchema = z.discriminatedUnion("type", [
  WorldRenameSchema,
  CharacterCreateSchema,
  CharacterUpdateSchema,
  CharacterDeleteSchema,
  RestoreSchema,
]);
export type Command = z.infer<typeof CommandSchema>;

export const CommandBatchSchema = z.object({
  commands: z.array(CommandSchema),
  /** Fingerprint each file must currently have, by ref key; null means it must not exist. */
  expect: z.record(z.string(), z.string().nullable()).optional(),
});
export type CommandBatch = z.infer<typeof CommandBatchSchema>;
