import { z } from "zod";
import { PortraitSchema } from "./files/character.ts";
import { ColourSchema, FileNameSchema, IdSchema } from "./files/common.ts";
import { FIELD_TYPES, FieldDefinitionSchema } from "./files/fields.ts";
import { FileRefSchema, parseRefKey } from "./refs.ts";

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

const Index = z.number().int().min(0);

export const FieldCreateSchema = z.object({
  type: z.literal("field.create"),
  field: FieldDefinitionSchema,
});

export const FieldUpdateSchema = z.object({
  type: z.literal("field.update"),
  key: z.string().min(1),
  set: z
    .object({
      label: z.string().min(1),
      type: z.enum(FIELD_TYPES),
      /** `null` removes the unit. */
      unit: z.string().nullable(),
      options: z.array(z.string()),
      default: z.boolean(),
    })
    .partial(),
});

export const FieldMoveSchema = z.object({
  type: z.literal("field.move"),
  key: z.string().min(1),
  index: Index,
});

export const FieldDeleteSchema = z.object({
  type: z.literal("field.delete"),
  key: z.string().min(1),
});

export const FieldsSetSubtitleSchema = z.object({
  type: z.literal("fields.setSubtitle"),
  key: z.string().min(1).nullable(),
});

export const TemplateCreateSchema = z.object({
  type: z.literal("template.create"),
  template: z.object({
    id: IdSchema.optional(),
    name: z.string().min(1),
    role: IdSchema.nullable().optional(),
    fields: z.array(z.string()).optional(),
  }),
});

export const TemplateUpdateSchema = z.object({
  type: z.literal("template.update"),
  id: IdSchema,
  set: z
    .object({ name: z.string().min(1), role: IdSchema.nullable(), fields: z.array(z.string()) })
    .partial(),
});

export const TemplateMoveSchema = z.object({
  type: z.literal("template.move"),
  id: IdSchema,
  index: Index,
});

export const TemplateDeleteSchema = z.object({
  type: z.literal("template.delete"),
  id: IdSchema,
});

/** Puts files back exactly as they were (`data: null` deletes). Undo uses this. */
export const RestoreSchema = z.object({
  type: z.literal("restore"),
  files: z.array(
    z.object({ ref: FileRefSchema, fileName: FileNameSchema.nullable(), data: z.unknown() }),
  ),
});

export const CommandSchema = z.discriminatedUnion("type", [
  WorldRenameSchema,
  CharacterCreateSchema,
  CharacterUpdateSchema,
  CharacterDeleteSchema,
  FieldCreateSchema,
  FieldUpdateSchema,
  FieldMoveSchema,
  FieldDeleteSchema,
  FieldsSetSubtitleSchema,
  TemplateCreateSchema,
  TemplateUpdateSchema,
  TemplateMoveSchema,
  TemplateDeleteSchema,
  RestoreSchema,
]);
export type Command = z.infer<typeof CommandSchema>;

/** The crop square of a portrait upload, read from the query string. */
export const PortraitCropSchema = z.object({
  x: z.coerce.number().min(0).max(1),
  y: z.coerce.number().min(0).max(1),
  size: z.coerce.number().gt(0).max(1),
});
export type Crop = z.infer<typeof PortraitCropSchema>;

export const PORTRAIT_UPLOAD_LIMIT = 20 * 1024 * 1024;

const RefKeySchema = z.string().refine((key) => {
  try {
    parseRefKey(key);
    return true;
  } catch {
    return false;
  }
}, "must be a ref key such as character:<id>");

export const CommandBatchSchema = z.object({
  commands: z.array(CommandSchema),
  /** Fingerprint each file must currently have, by ref key; null means it must not exist. */
  expect: z.record(RefKeySchema, z.string().nullable()).optional(),
});
export type CommandBatch = z.infer<typeof CommandBatchSchema>;
