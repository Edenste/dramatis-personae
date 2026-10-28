import { z } from "zod";
import { CommandBatchSchema } from "./commands.ts";
import { ThemeSchema } from "./config.ts";
import { IdSchema } from "./files/common.ts";
import { ProblemSchema } from "./problems.ts";
import { FileRefSchema } from "./refs.ts";

/** Every error the API returns. */
export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});
export type ApiErrorBody = z.infer<typeof ApiErrorSchema>;

export const WorldSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  folder: z.string(),
  schemaVersion: z.number().int().nullable(),
  problem: z.string().optional(),
});
export type WorldSummary = z.infer<typeof WorldSummarySchema>;

/** One file of a world as the API sends it. */
export const FileEntrySchema = z.object({
  ref: FileRefSchema,
  path: z.string(),
  data: z.unknown(),
  fingerprint: z.string(),
});
export type FileEntry = z.infer<typeof FileEntrySchema>;

export const WorldSnapshotSchema = z.object({
  world: WorldSummarySchema,
  readOnly: z.boolean(),
  /** Set while a change is kept in memory because it couldn't be written. */
  unsaved: z.object({ message: z.string() }).nullable(),
  files: z.array(FileEntrySchema),
  problems: z.array(ProblemSchema),
});
export type WorldSnapshot = z.infer<typeof WorldSnapshotSchema>;

export const CharacterViewSchema = z.object({
  file: FileEntrySchema,
  color: z.string(),
  shownFieldKeys: z.array(z.string()),
});
export type CharacterView = z.infer<typeof CharacterViewSchema>;

export const CommandResultSchema = z.object({
  inverse: CommandBatchSchema,
  /** New fingerprint per ref key; null for removed files. */
  fingerprints: z.record(z.string(), z.string().nullable()),
});
export type CommandResult = z.infer<typeof CommandResultSchema>;

export const FixRequestSchema = z.discriminatedUnion("fix", [
  z.object({ fix: z.literal("assignNewId"), path: z.string().min(1) }),
  z.object({ fix: z.literal("removeReference"), ref: FileRefSchema }),
]);
export type FixRequest = z.infer<typeof FixRequestSchema>;

export const StatusSchema = z.object({
  version: z.string(),
  dataRoot: z.string(),
  writable: z.boolean(),
  problem: z.string().optional(),
});
export type Status = z.infer<typeof StatusSchema>;

export const SettingsSchema = z.object({
  dataRoot: z.string(),
  defaultDataRoot: z.string(),
  dataPath: z.string().nullable(),
  theme: ThemeSchema,
});
export type Settings = z.infer<typeof SettingsSchema>;

/** Absolute on Windows (C:\…, \\server\…) or POSIX (/…). Not node:path: this runs in browsers too. */
const AbsolutePathSchema = z
  .string()
  .regex(/^(?:[A-Za-z]:[\\/]|\\\\|\/)/, "must be an absolute path");

export const SettingsUpdateSchema = z.object({
  theme: ThemeSchema.optional(),
  dataPath: AbsolutePathSchema.nullable().optional(),
});
export type SettingsUpdate = z.infer<typeof SettingsUpdateSchema>;

export const SettingsResultSchema = z.object({
  settings: SettingsSchema,
  /** A new data path takes effect after a restart. */
  restartRequired: z.boolean(),
});
export type SettingsResult = z.infer<typeof SettingsResultSchema>;

/** Messages the server pushes over the world's WebSocket. */
export const ServerMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("changed"),
    world: IdSchema,
    files: z.array(FileEntrySchema),
    /** Ref keys of removed files. */
    removed: z.array(z.string()),
  }),
  z.object({ type: z.literal("problems"), world: IdSchema, problems: z.array(ProblemSchema) }),
  z.object({
    type: z.literal("conflict"),
    world: IdSchema,
    refs: z.array(z.string()),
    message: z.string(),
  }),
  z.object({
    type: z.literal("save-state"),
    world: IdSchema,
    unsaved: z.boolean(),
    message: z.string().optional(),
  }),
  /** The world was reloaded from disk; fetch a new snapshot. */
  z.object({ type: z.literal("reload"), world: IdSchema }),
]);
export type ServerMessage = z.infer<typeof ServerMessageSchema>;
