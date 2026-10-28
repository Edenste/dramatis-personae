import type { IncomingMessage, ServerResponse } from "node:http";
import type { FastifyBaseLogger, FastifyInstance, RawServerDefault } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { OptionsFile } from "@dramatis-personae/schema";
import type { DataPaths } from "./config/data-root.ts";

/** The Fastify instance with Zod schemas typing every route. */
export type App = FastifyInstance<
  RawServerDefault,
  IncomingMessage,
  ServerResponse<IncomingMessage>,
  FastifyBaseLogger,
  ZodTypeProvider
>;

/** What the routes share. */
export interface ServerContext {
  paths: DataPaths;
  /** The options as last saved; a new data path only applies after a restart. */
  options: OptionsFile;
  version: string;
  dataRoot: { writable: true } | { writable: false; problem: string };
  openPath?: (path: string) => Promise<void>;
}
