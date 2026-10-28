import { z } from "zod";
import { IdSchema } from "./files/common.ts";

export const THEMES = ["system", "light", "dark"] as const;
export const ThemeSchema = z.enum(THEMES);

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

/** `Config/workspaces/<worldId>.json`: one user's interface state for a world. */
export const WorkspaceFileSchema = z.looseObject({
  /** World-relative addresses such as "graph", "dashboard" or "character/<id>". */
  tabs: z.array(z.string()).default([]),
  activeTab: z.string().nullable().default(null),
  recentCharacters: z.array(IdSchema).max(20).default([]),
});
export type WorkspaceFile = z.infer<typeof WorkspaceFileSchema>;
