import { WORLD_FILE } from "@dramatis-personae/schema";
import { withSchema, type HandlerContext, type HandlerResult } from "./types.ts";

/** Changes the display name only; the world's folder name is cosmetic and never renamed. */
export function renameWorld(ctx: HandlerContext, name: string): HandlerResult {
  const data = withSchema("world", { ...ctx.model.world, name });
  return { ok: true, writes: [{ ref: { kind: "world" }, fileName: WORLD_FILE, data }] };
}
