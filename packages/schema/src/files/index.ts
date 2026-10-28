import type { z } from "zod";
import type { FileKind } from "../kinds.ts";
import { CharacterFileSchema } from "./character.ts";
import { EventFileSchema } from "./event.ts";
import { FieldsFileSchema } from "./fields.ts";
import { RelationshipTypesFileSchema } from "./relationship-types.ts";
import { RelationshipFileSchema } from "./relationship.ts";
import { RolesFileSchema } from "./roles.ts";
import { SearchFileSchema } from "./search.ts";
import { TemplatesFileSchema } from "./templates.ts";
import { ViewFileSchema } from "./view.ts";
import { WorldFileSchema } from "./world.ts";

export * from "../kinds.ts";
export * from "./common.ts";
export * from "./character.ts";
export * from "./event.ts";
export * from "./fields.ts";
export * from "./relationship-types.ts";
export * from "./relationship.ts";
export * from "./roles.ts";
export * from "./search.ts";
export * from "./templates.ts";
export * from "./view.ts";
export * from "./world.ts";

export const FILE_SCHEMAS = {
  world: WorldFileSchema,
  fields: FieldsFileSchema,
  roles: RolesFileSchema,
  relationshipTypes: RelationshipTypesFileSchema,
  templates: TemplatesFileSchema,
  character: CharacterFileSchema,
  relationship: RelationshipFileSchema,
  event: EventFileSchema,
  view: ViewFileSchema,
  search: SearchFileSchema,
} satisfies Record<FileKind, z.ZodType>;

export type FileData<K extends FileKind> = z.infer<(typeof FILE_SCHEMAS)[K]>;
