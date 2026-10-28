import type { AddressInfo } from "node:net";
import fastifyCookie from "@fastify/cookie";
import fastifySwagger from "@fastify/swagger";
import fastifyWebsocket from "@fastify/websocket";
import Fastify, { type FastifyBaseLogger } from "fastify";
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import type { Logger } from "pino";
import {
  JsonFileStorage,
  type OpenWorldOptions,
  type User,
  type WorldStorage,
} from "@dramatis-personae/core";
import type { OptionsFile } from "@dramatis-personae/schema";
import type { DataPaths } from "./config/data-root.ts";
import { checkWritable } from "./config/options.ts";
import type { App, ServerContext } from "./context.ts";
import { notFound, registerErrorHandlers, sendError } from "./http/errors.ts";
import { stripToken } from "./http/logger.ts";
import { registerSecurity } from "./http/security.ts";
import { settingsRoutes } from "./routes/settings.ts";
import { statusRoutes } from "./routes/status.ts";
import { webRoutes } from "./routes/web.ts";
import { workspaceRoutes } from "./routes/workspace.ts";
import { worldRoutes } from "./routes/worlds.ts";
import { wsRoutes } from "./routes/ws.ts";
import { WorldSessions } from "./worlds/world-sessions.ts";

export interface ServerOptions {
  paths: DataPaths;
  options: OptionsFile;
  token: string;
  version: string;
  /** "host:port" values to answer to. Default: 127.0.0.1, localhost and the listen address, on the bound port. */
  allowedHosts?: string[];
  /** The address the server listens on, also accepted as a host. Default: options.listenAddress. */
  listenAddress?: string;
  /** The built web app. Without it, GET / serves a small placeholder page. */
  webRoot?: string;
  openPath?: (path: string) => Promise<void>;
  /** Where to log; nothing is logged without one. */
  logger?: Logger;
  /** Default: JSON files under the data root. */
  storage?: WorldStorage;
  /** Test hook for migrations. */
  openWorld?: OpenWorldOptions;
  /** Test hook: the user every authenticated request runs as. Defaults to the local owner. */
  user?: User;
}

const LOCAL_OWNER: User = { id: "local", role: "owner" };

function boundHosts(address: AddressInfo | string | null, listenAddress: string): string[] {
  if (address === null || typeof address === "string") return [];
  const names = new Set(["127.0.0.1", "localhost", "[::1]", listenAddress]);
  return [...names].map((name) => `${name}:${address.port}`);
}

export async function buildServer(opts: ServerOptions): Promise<App> {
  const app = Fastify({
    loggerInstance: opts.logger as FastifyBaseLogger | undefined,
    disableRequestLogging: true,
  }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  const ctx: ServerContext = {
    paths: opts.paths,
    options: opts.options,
    version: opts.version,
    dataRoot: await checkWritable(opts.paths),
    openPath: opts.openPath,
  };

  await app.register(fastifySwagger, {
    openapi: {
      openapi: "3.1.0",
      info: { title: "Dramatis Personae API", version: opts.version },
    },
    transform: jsonSchemaTransform,
  });
  await app.register(fastifyCookie);
  await app.register(fastifyWebsocket);

  let hosts = opts.allowedHosts;
  registerSecurity(app, {
    token: opts.token,
    allowedHosts: () => {
      if (hosts) return hosts;
      const bound = boundHosts(
        app.server.address(),
        opts.listenAddress ?? opts.options.listenAddress,
      );
      if (bound.length > 0) hosts = bound;
      return bound;
    },
    user: opts.user ?? LOCAL_OWNER,
  });
  registerErrorHandlers(app);
  app.addHook("onResponse", async (request, reply) => {
    request.log.info(
      {
        method: request.method,
        url: stripToken(request.url),
        status: reply.statusCode,
        ms: Math.round(reply.elapsedTime),
      },
      "request",
    );
  });

  const storage = opts.storage ?? new JsonFileStorage({ dataRoot: opts.paths.dataRoot });
  const sessions = new WorldSessions(storage, opts.openWorld);
  app.addHook("onClose", () => sessions.closeAll());

  statusRoutes(app, ctx);
  settingsRoutes(app, ctx);
  worldRoutes(app, ctx, sessions);
  workspaceRoutes(app, ctx, sessions);
  wsRoutes(app, ctx, sessions);
  app.get("/api/openapi.json", { schema: { hide: true } }, () => app.swagger());
  await webRoutes(app, opts.webRoot);

  app.setNotFoundHandler(async (request, reply) => {
    const path = new URL(request.url, "http://local").pathname;
    if (opts.webRoot && request.method === "GET" && !path.startsWith("/api")) {
      return reply.sendFile("index.html");
    }
    const error = notFound(request.method, request.url);
    return sendError(reply, error.status, error.code, error.message);
  });

  return app;
}
