import { StatusSchema } from "@dramatis-personae/schema";
import type { App, ServerContext } from "../context.ts";

export function statusRoutes(app: App, ctx: ServerContext): void {
  app.get("/api/status", { schema: { response: { 200: StatusSchema } } }, () => ({
    version: ctx.version,
    dataRoot: ctx.paths.dataRoot,
    writable: ctx.dataRoot.writable,
    ...(ctx.dataRoot.writable ? {} : { problem: ctx.dataRoot.problem }),
    ...(ctx.optionsProblems.length > 0 ? { optionsProblem: ctx.optionsProblems.join("\n") } : {}),
    desktop: ctx.desktop ? { windowControls: ctx.desktop.windowControls } : null,
  }));
}
