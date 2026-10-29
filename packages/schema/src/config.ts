import { z } from "zod";
import { IdSchema } from "./files/common.ts";

export const THEMES = ["system", "light", "dark"] as const;
export const ThemeSchema = z.enum(THEMES);
export type Theme = z.infer<typeof ThemeSchema>;

/** `Config/options.json`, which always lives under the default data root. */
export const OptionsFileSchema = z.looseObject({
  /** Where Data/, Backups/, Logs/ and Config/workspaces/ live instead of the default root. */
  dataPath: z.string().optional(),
  theme: ThemeSchema.default("system"),
  /** Port for the headless server; the desktop app always picks a free one. */
  port: z.number().int().min(0).max(65535).default(30300),
  listenAddress: z.string().default("127.0.0.1"),
});
export type OptionsFile = z.infer<typeof OptionsFileSchema>;

/** An open character card: position and size in CSS pixels within the page panel. */
export const CardStateSchema = z.object({
  character: IdSchema,
  x: z.number().min(0),
  y: z.number().min(0),
  width: z.number().positive(),
  height: z.number().positive(),
});
export type CardState = z.infer<typeof CardStateSchema>;

/** `Config/workspaces/<worldId>.json`: one user's interface state for a world. */
export const WorkspaceFileSchema = z.looseObject({
  /** World-relative addresses such as "graph", "dashboard" or "character/<id>". */
  tabs: z.array(z.string()).default([]),
  activeTab: z.string().nullable().default(null),
  recentCharacters: z.array(IdSchema).max(20).default([]),
  /** Open cards by tab address, front-most last. */
  cards: z.record(z.string(), z.array(CardStateSchema).max(50)).default({}),
});
export type WorkspaceFile = z.infer<typeof WorkspaceFileSchema>;

/** `Config/app-state.json` under the data root: app-wide interface state. */
export const AppStateFileSchema = z.looseObject({
  /** The world to open at start-up. */
  lastWorld: IdSchema.nullable().default(null),
});
export type AppStateFile = z.infer<typeof AppStateFileSchema>;
