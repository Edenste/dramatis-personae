import {
  CommandBatchSchema,
  generateId as defaultGenerateId,
  parseRefKey,
  refKey,
  type Command,
  type CommandBatch,
  type FileRef,
} from "@dramatis-personae/schema";
import type { FileUpdate, WorldModel } from "../model/world-model.ts";
import { fingerprint, serialize } from "../serialize.ts";
import type { DocumentChange } from "../storage/types.ts";
import { createCharacter, deleteCharacter, updateCharacter } from "./character.ts";
import { createField, deleteField, moveField, setSubtitle, updateField } from "./fields.ts";
import { createTemplate, deleteTemplate, moveTemplate, updateTemplate } from "./templates.ts";
import { can, type User } from "./permissions.ts";
import { restoreFiles } from "./restore.ts";
import type { CommandError, HandlerContext, HandlerResult } from "./types.ts";
import { renameWorld } from "./world.ts";

export type ApplyResult =
  | { ok: true; model: WorldModel; changes: DocumentChange[]; inverse: CommandBatch }
  | { ok: false; error: CommandError };

export interface ApplyOptions {
  readOnly?: boolean;
  generateId?: () => string;
}

function fail(code: CommandError["code"], message: string, path?: string): ApplyResult {
  return { ok: false, error: { code, message, ...(path ? { path } : {}) } };
}

function handle(ctx: HandlerContext, command: Command): HandlerResult {
  switch (command.type) {
    case "world.rename":
      return renameWorld(ctx, command.name);
    case "character.create":
      return createCharacter(ctx, command);
    case "character.update":
      return updateCharacter(ctx, command);
    case "character.delete":
      return deleteCharacter(ctx, command.id);
    case "restore":
      return restoreFiles(ctx, command.files);
    case "field.create":
      return createField(ctx, command);
    case "field.update":
      return updateField(ctx, command);
    case "field.move":
      return moveField(ctx, command.key, command.index);
    case "field.delete":
      return deleteField(ctx, command.key);
    case "fields.setSubtitle":
      return setSubtitle(ctx, command.key);
    case "template.create":
      return createTemplate(ctx, command);
    case "template.update":
      return updateTemplate(ctx, command);
    case "template.move":
      return moveTemplate(ctx, command.id, command.index);
    case "template.delete":
      return deleteTemplate(ctx, command.id);
  }
}

/**
 * Applies a batch all-or-nothing. On success it returns the new model, the
 * file changes to write in order, and an inverse batch that undoes them.
 */
export function applyBatch(
  model: WorldModel,
  batch: CommandBatch,
  user: User,
  options: ApplyOptions = {},
): ApplyResult {
  if (!can(user, "edit")) return fail("forbidden", "You don't have edit access to this world");
  if (options.readOnly) return fail("read-only", "This world is open read-only");

  const parsed = CommandBatchSchema.safeParse(batch);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail("invalid", issue?.message ?? "Invalid batch", issue?.path.join("."));
  }

  for (const [key, expected] of Object.entries(parsed.data.expect ?? {})) {
    if ((model.fingerprint(parseRefKey(key)) ?? null) !== expected) {
      return fail("conflict", `${key} has changed since it was last read`);
    }
  }

  const ctx: HandlerContext = { model, generateId: options.generateId ?? defaultGenerateId };
  const changes: DocumentChange[] = [];
  /** State of each touched file before the batch, in the order first touched. */
  const previous = new Map<string, { ref: FileRef; fileName: string | null; data: unknown }>();
  const final = new Map<string, string | null>();

  for (const [i, command] of parsed.data.commands.entries()) {
    const result = handle(ctx, command);
    if (!result.ok) {
      const path = result.error.path ? `commands.${i}.${result.error.path}` : `commands.${i}`;
      return { ok: false, error: { ...result.error, path } };
    }
    const updates: FileUpdate[] = [];
    for (const write of result.writes) {
      const key = refKey(write.ref);
      if (ctx.model.isBlocked(write.ref)) {
        return fail("blocked", `${key} is broken on disk; fix the file first`, `commands.${i}`);
      }
      if (!previous.has(key)) {
        previous.set(key, {
          ref: write.ref,
          fileName: ctx.model.fileName(write.ref) ?? null,
          data: ctx.model.data(write.ref) ?? null,
        });
      }
      if ("remove" in write) {
        changes.push({ op: "delete", ref: write.ref });
        updates.push({ ref: write.ref, removed: true });
        final.set(key, null);
      } else {
        const text = serialize(write.raw ?? write.data);
        const print = fingerprint(text);
        changes.push({ op: "put", ref: write.ref, fileName: write.fileName, text });
        updates.push({
          ref: write.ref,
          fileName: write.fileName,
          data: write.data,
          fingerprint: print,
        });
        final.set(key, print);
      }
    }
    ctx.model = ctx.model.withFiles(updates);
  }

  // Restore in reverse, so a deleted character comes back before what points at it.
  const inverse: CommandBatch = {
    commands: [{ type: "restore", files: [...previous.values()].reverse() }],
    expect: Object.fromEntries(final),
  };
  return { ok: true, model: ctx.model, changes, inverse };
}
