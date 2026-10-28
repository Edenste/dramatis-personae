import { z } from "zod";
import { IdSchema, WorkspaceFileSchema } from "@dramatis-personae/schema";
import { readWorkspace, writeWorkspace } from "../config/workspaces.ts";
import type { App, ServerContext } from "../context.ts";
import type { WorldSessions } from "../worlds/world-sessions.ts";

const World = z.object({ w: IdSchema });

/** Per-user interface state for a world (spec §7), kept in Config/, never in the world. */
export function workspaceRoutes(app: App, ctx: ServerContext, sessions: WorldSessions): void {
  app.get(
    "/api/worlds/:w/workspace",
    { schema: { params: World, response: { 200: WorkspaceFileSchema } } },
    async (request) => {
      await sessions.summary(request.params.w);
      return readWorkspace(ctx.paths.workspacesDir, request.params.w);
    },
  );

  app.put(
    "/api/worlds/:w/workspace",
    {
      schema: {
        params: World,
        body: WorkspaceFileSchema,
        response: { 200: WorkspaceFileSchema },
      },
    },
    async (request) => {
      await sessions.summary(request.params.w);
      await writeWorkspace(ctx.paths.workspacesDir, request.params.w, request.body);
      return request.body;
    },
  );
}
