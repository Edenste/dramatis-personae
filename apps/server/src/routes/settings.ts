import { posix, win32 } from "node:path";
import {
  SettingsResultSchema,
  SettingsSchema,
  SettingsUpdateSchema,
  type OptionsFile,
  type Settings,
} from "@dramatis-personae/schema";
import { writeOptions } from "../config/options.ts";
import type { App, ServerContext } from "../context.ts";
import { ApiError } from "../http/errors.ts";
import { requireOwner } from "../http/permissions.ts";

/** True when `path` is `folder` itself or inside it; Windows-style paths compare as Windows paths. */
function isInside(path: string, folder: string): boolean {
  const flavour = /^[A-Za-z]:|^\\/.test(folder) ? win32 : posix;
  const relative = flavour.relative(folder, path);
  return relative === "" || (!relative.startsWith("..") && !flavour.isAbsolute(relative));
}

function settingsOf(ctx: ServerContext): Settings {
  return {
    dataRoot: ctx.paths.dataRoot,
    defaultDataRoot: ctx.paths.defaultRoot,
    dataPath: ctx.options.dataPath ?? null,
    theme: ctx.options.theme,
  };
}

export function settingsRoutes(app: App, ctx: ServerContext): void {
  app.get("/api/settings", { schema: { response: { 200: SettingsSchema } } }, () =>
    settingsOf(ctx),
  );

  app.put(
    "/api/settings",
    { schema: { body: SettingsUpdateSchema, response: { 200: SettingsResultSchema } } },
    async (request) => {
      requireOwner(request.user);
      const { theme, dataPath } = request.body;
      const installDir = ctx.desktop?.installDir;
      if (dataPath && installDir && isInside(dataPath, installDir)) {
        throw new ApiError(
          400,
          "invalid",
          "That folder is inside the app's own folder, which is deleted when the app is uninstalled. Choose another.",
          { path: "dataPath" },
        );
      }
      const next: OptionsFile = { ...ctx.options, ...(theme ? { theme } : {}) };
      if (dataPath === null) delete next.dataPath;
      else if (dataPath !== undefined) next.dataPath = dataPath;
      const restartRequired = (next.dataPath ?? null) !== (ctx.options.dataPath ?? null);
      await writeOptions(ctx.paths.optionsFile, next);
      ctx.options = next;
      if (theme) ctx.desktop?.appearanceChanged(theme);
      return { settings: settingsOf(ctx), restartRequired };
    },
  );

  app.post("/api/data-folder/open", async (request, reply) => {
    requireOwner(request.user);
    if (!ctx.openPath) {
      throw new ApiError(501, "not-supported", "Opening folders isn't available here");
    }
    try {
      await ctx.openPath(ctx.paths.dataRoot);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new ApiError(500, "open-failed", `Couldn't open the data folder: ${reason}`);
    }
    return reply.code(204).send();
  });
}
