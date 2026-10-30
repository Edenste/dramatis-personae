import type { IncomingMessage, ServerResponse } from "node:http";
import type { FastifyBaseLogger, FastifyInstance, RawServerDefault } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { OptionsFile, Theme } from "@dramatis-personae/schema";
import type { DataPaths } from "./config/data-root.ts";

/** The Fastify instance with Zod schemas typing every route. */
export type App = FastifyInstance<
  RawServerDefault,
  IncomingMessage,
  ServerResponse<IncomingMessage>,
  FastifyBaseLogger,
  ZodTypeProvider
>;

/** What the desktop app gives the server it runs in-process. */
export interface DesktopHooks {
  /** The folder the installer owns; deleted on uninstall, so no data folder may be inside it. */
  installDir?: string;
  /** Which side of the title bar the window buttons sit on. */
  windowControls: "left" | "right";
  /** Shows the system folder picker; null if it was cancelled. */
  chooseFolder(): Promise<string | null>;
  /** Restarts the app; called after the reply has been sent. */
  restart(): void;
  /** Called whenever the theme setting is saved, so the window can follow it. */
  appearanceChanged(theme: Theme): void;
}

/** What the routes share. */
export interface ServerContext {
  paths: DataPaths;
  /** The options as last saved; a new data path only applies after a restart. */
  options: OptionsFile;
  version: string;
  dataRoot: { writable: true } | { writable: false; problem: string };
  /** Problems found reading options.json at start-up. */
  optionsProblems: string[];
  openPath?: (path: string) => Promise<void>;
  desktop?: DesktopHooks;
}
