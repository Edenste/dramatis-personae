import { extname } from "node:path";
import { z } from "zod";
import { StorageError, can } from "@dramatis-personae/core";
import {
  CharacterViewSchema,
  CommandBatchSchema,
  CommandResultSchema,
  FileNameSchema,
  FixRequestSchema,
  IdSchema,
  ProblemSchema,
  WorldSnapshotSchema,
  WorldSummarySchema,
  refKey,
} from "@dramatis-personae/schema";
import type { App, ServerContext } from "../context.ts";
import { ApiError } from "../http/errors.ts";
import type { WorldSessions } from "../worlds/world-sessions.ts";

const World = z.object({ w: IdSchema });

const PORTRAIT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
};

const PortraitFileSchema = FileNameSchema.refine(
  (name) => extname(name).toLowerCase() in PORTRAIT_TYPES,
  "must be a jpg, png, webp, gif or avif file",
);

/** Every /api/worlds route needs a usable data root. */
export function requireDataRoot(ctx: ServerContext): void {
  if (!ctx.dataRoot.writable) {
    throw new ApiError(503, "data-root-unavailable", ctx.dataRoot.problem);
  }
}

function requireRead(user: { role: "owner" | "editor" | "viewer"; id: string }): void {
  if (!can(user, "read")) throw new ApiError(403, "forbidden", "You can't open this world");
}

export function worldRoutes(app: App, ctx: ServerContext, sessions: WorldSessions): void {
  app.addHook("onRequest", (request, _reply, done) => {
    try {
      if (request.url.startsWith("/api/worlds")) requireDataRoot(ctx);
      done();
    } catch (error) {
      done(error as Error);
    }
  });

  app.get(
    "/api/worlds",
    { schema: { response: { 200: z.array(WorldSummarySchema) } } },
    async (request) => {
      requireRead(request.user);
      return sessions.list();
    },
  );

  app.post(
    "/api/worlds",
    {
      schema: {
        body: z.object({ name: z.string().trim().min(1) }),
        response: { 201: WorldSummarySchema },
      },
    },
    async (request, reply) => {
      if (!can(request.user, "edit")) {
        throw new ApiError(403, "forbidden", "You can't create worlds");
      }
      return reply.code(201).send(await sessions.create(request.body.name));
    },
  );

  app.get(
    "/api/worlds/:w",
    { schema: { params: World, response: { 200: WorldSnapshotSchema } } },
    async (request) => {
      requireRead(request.user);
      const session = await sessions.get(request.params.w);
      return session.snapshot(await sessions.summary(request.params.w));
    },
  );

  app.get(
    "/api/worlds/:w/characters/:id",
    {
      schema: {
        params: World.extend({ id: IdSchema }),
        response: { 200: CharacterViewSchema },
      },
    },
    async (request) => {
      requireRead(request.user);
      const { model } = await sessions.get(request.params.w);
      const key = refKey({ kind: "character", id: request.params.id });
      const file = model.files().find((f) => refKey(f.ref) === key);
      if (!file) throw new ApiError(404, "not-found", "No such character");
      return {
        file,
        color: model.characterColor(request.params.id),
        shownFieldKeys: model.shownFieldKeys(request.params.id),
      };
    },
  );

  app.get(
    "/api/worlds/:w/problems",
    { schema: { params: World, response: { 200: z.array(ProblemSchema) } } },
    async (request) => {
      requireRead(request.user);
      return (await sessions.get(request.params.w)).model.problems();
    },
  );

  app.get(
    "/api/worlds/:w/search",
    {
      schema: {
        params: World,
        querystring: z.object({ q: z.string().min(1) }),
        response: { 200: z.array(z.object({ id: z.string(), score: z.number() })) },
      },
    },
    async (request) => {
      requireRead(request.user);
      return (await sessions.get(request.params.w)).search(request.query.q);
    },
  );

  app.get(
    "/api/worlds/:w/assets/portraits/:file",
    { schema: { params: World.extend({ file: PortraitFileSchema }) } },
    async (request, reply) => {
      requireRead(request.user);
      const session = await sessions.get(request.params.w);
      let bytes: Uint8Array | null;
      try {
        bytes = await session.readAsset(request.params.file);
      } catch (error) {
        if (error instanceof StorageError && error.code === "io") {
          throw new ApiError(400, "invalid", "Not a portrait file name");
        }
        throw error;
      }
      if (!bytes) throw new ApiError(404, "not-found", "No such portrait");
      return reply
        .type(PORTRAIT_TYPES[extname(request.params.file).toLowerCase()]!)
        .header("cache-control", "no-cache")
        .send(Buffer.from(bytes));
    },
  );

  app.post(
    "/api/worlds/:w/commands",
    { schema: { params: World, body: CommandBatchSchema, response: { 200: CommandResultSchema } } },
    async (request) => (await sessions.get(request.params.w)).apply(request.body, request.user),
  );

  app.post(
    "/api/worlds/:w/retry",
    { schema: { params: World, response: { 200: CommandResultSchema } } },
    async (request) => {
      if (!can(request.user, "edit")) throw new ApiError(403, "forbidden", "You can't edit");
      return (await sessions.get(request.params.w)).retry();
    },
  );

  app.post(
    "/api/worlds/:w/discard-unsaved",
    { schema: { params: World } },
    async (request, reply) => {
      if (!can(request.user, "edit")) throw new ApiError(403, "forbidden", "You can't edit");
      await (await sessions.get(request.params.w)).discardUnsaved();
      return reply.code(204).send();
    },
  );

  app.post(
    "/api/worlds/:w/fixes",
    { schema: { params: World, body: FixRequestSchema, response: { 200: CommandResultSchema } } },
    async (request) => (await sessions.get(request.params.w)).fix(request.body, request.user),
  );
}
