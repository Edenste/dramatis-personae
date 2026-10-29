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

/** Counts the messages a world has pushed; a client ignores any push not newer than its snapshot. */
const SeqSchema = z.number().int().min(0);

export const WorldSnapshotSchema = z.object({
  world: WorldSummarySchema,
  readOnly: z.boolean(),
  /** Set while a change is kept in memory because it couldn't be written. */
  unsaved: z.object({ message: z.string() }).nullable(),
  files: z.array(FileEntrySchema),
  problems: z.array(ProblemSchema),
  /** The sequence number of the last message pushed before this snapshot was taken. */
  seq: SeqSchema,
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
  /** Why options.json was partly or wholly ignored. */
  optionsProblem: z.string().optional(),
  /** Set when the desktop app runs the server: which side its window buttons sit on. */
  desktop: z.object({ windowControls: z.enum(["left", "right"]) }).nullable(),
});
export type Status = z.infer<typeof StatusSchema>;

/** The folder picked in the desktop app's folder picker, or null if it was cancelled. */
export const ChooseFolderResultSchema = z.object({ path: z.string().nullable() });
export type ChooseFolderResult = z.infer<typeof ChooseFolderResultSchema>;

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

/** Messages the server pushes over the world's WebSocket, each with the world's next `seq`. */
export const ServerMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("changed"),
    world: IdSchema,
    seq: SeqSchema,
    files: z.array(FileEntrySchema),
    /** Ref keys of removed files. */
    removed: z.array(z.string()),
  }),
  z.object({
    type: z.literal("problems"),
    world: IdSchema,
    seq: SeqSchema,
    problems: z.array(ProblemSchema),
  }),
  z.object({
    type: z.literal("conflict"),
    world: IdSchema,
    seq: SeqSchema,
    refs: z.array(z.string()),
    message: z.string(),
  }),
  z.object({
    type: z.literal("save-state"),
    world: IdSchema,
    seq: SeqSchema,
    unsaved: z.boolean(),
    message: z.string().optional(),
  }),
  /** The world was reloaded from disk; fetch a new snapshot. */
  z.object({ type: z.literal("reload"), world: IdSchema, seq: SeqSchema }),
]);
export type ServerMessage = z.infer<typeof ServerMessageSchema>;
