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
      const { theme, dataPath } = request.body;
      const next: OptionsFile = { ...ctx.options, ...(theme ? { theme } : {}) };
      if (dataPath === null) delete next.dataPath;
      else if (dataPath !== undefined) next.dataPath = dataPath;
      const restartRequired = (next.dataPath ?? null) !== (ctx.options.dataPath ?? null);
      await writeOptions(ctx.paths.optionsFile, next);
      ctx.options = next;
      return { settings: settingsOf(ctx), restartRequired };
    },
  );

  app.post("/api/data-folder/open", async (_request, reply) => {
    if (!ctx.openPath) {
      throw new ApiError(501, "not-supported", "Opening folders isn't available here");
    }
    await ctx.openPath(ctx.paths.dataRoot);
    return reply.code(204).send();
  });
}
