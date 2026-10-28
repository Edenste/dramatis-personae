import { z } from "zod";
import { IdSchema } from "@dramatis-personae/schema";
import type { App, ServerContext } from "../context.ts";
import type { WorldSessions } from "../worlds/world-sessions.ts";

/** Close code for a world that can't be opened. */
export const WORLD_UNAVAILABLE = 4004;

/** A WebSocket close reason may be at most 123 bytes. */
const reason = (message: string) => Buffer.from(message).subarray(0, 120).toString();

/**
 * GET /ws?world=<id>: pushes the world's ServerMessages as JSON. The upgrade
 * goes through the same Host, Origin and token checks as every request.
 */
export function wsRoutes(app: App, ctx: ServerContext, sessions: WorldSessions): void {
  app.get(
    "/ws",
    { websocket: true, schema: { hide: true, querystring: z.object({ world: z.string() }) } },
    (socket, request) => {
      const world = request.query.world;
      if (!ctx.dataRoot.writable || !IdSchema.safeParse(world).success) {
        socket.close(WORLD_UNAVAILABLE, "No such world");
        return;
      }
      sessions.get(world).then(
        (session) => {
          if (socket.readyState !== socket.OPEN) return;
          const unsubscribe = session.subscribe((message) => socket.send(JSON.stringify(message)));
          socket.on("close", unsubscribe);
        },
        (error: Error) => socket.close(WORLD_UNAVAILABLE, reason(error.message)),
      );
      socket.on("message", () => undefined); // clients have nothing to say yet
    },
  );
}
