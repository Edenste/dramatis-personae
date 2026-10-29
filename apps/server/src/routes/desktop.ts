import { ChooseFolderResultSchema } from "@dramatis-personae/schema";
import type { App, DesktopHooks, ServerContext } from "../context.ts";
import { ApiError } from "../http/errors.ts";
import { requireOwner } from "../http/permissions.ts";

function hooksOf(ctx: ServerContext): DesktopHooks {
  if (!ctx.desktop) throw new ApiError(501, "not-supported", "Only the desktop app can do that");
  return ctx.desktop;
}

/** Actions only the desktop app can carry out: the folder picker and restarting. */
export function desktopRoutes(app: App, ctx: ServerContext): void {
  app.post(
    "/api/data-folder/choose",
    { schema: { response: { 200: ChooseFolderResultSchema } } },
    async (request) => {
      requireOwner(request.user);
      return { path: await hooksOf(ctx).chooseFolder() };
    },
  );

  app.post("/api/restart", async (request, reply) => {
    requireOwner(request.user);
    const hooks = hooksOf(ctx);
    reply.raw.once("finish", () => setImmediate(() => hooks.restart()));
    return reply.code(202).send();
  });
}
