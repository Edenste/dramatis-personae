import { AppStateFileSchema } from "@dramatis-personae/schema";
import { readAppState, writeAppState } from "../config/app-state.ts";
import type { App, ServerContext } from "../context.ts";
import { requireRead } from "../http/permissions.ts";
import { requireDataRoot } from "./worlds.ts";

/** App-wide interface state (the last world opened), kept in Config/ under the data root. */
export function appStateRoutes(app: App, ctx: ServerContext): void {
  app.get(
    "/api/app-state",
    { schema: { response: { 200: AppStateFileSchema } } },
    async (request) => {
      requireRead(request.user);
      requireDataRoot(ctx);
      return readAppState(ctx.paths.appStateFile);
    },
  );

  app.put(
    "/api/app-state",
    { schema: { body: AppStateFileSchema, response: { 200: AppStateFileSchema } } },
    async (request) => {
      requireRead(request.user);
      requireDataRoot(ctx);
      await writeAppState(ctx.paths.appStateFile, request.body);
      return request.body;
    },
  );
}
