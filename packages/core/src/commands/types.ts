import { schemaRefFor, type FileKind, type FileRef } from "@dramatis-personae/schema";
import type { WorldModel } from "../model/world-model.ts";

export interface CommandError {
  code: "forbidden" | "read-only" | "invalid" | "not-found" | "conflict" | "blocked";
  message: string;
  /** Path into the batch, such as "commands.1.set.roles.0". */
  path?: string;
}

/** One file a command writes or removes. */
export type Write =
  | { ref: FileRef; fileName: string; data: Record<string, unknown> }
  | { ref: FileRef; remove: true };

export type HandlerResult = { ok: true; writes: Write[] } | { ok: false; error: CommandError };

export interface HandlerContext {
  model: WorldModel;
  generateId: () => string;
}

export function invalid(message: string, path?: string): HandlerResult {
  return { ok: false, error: { code: "invalid", message, ...(path ? { path } : {}) } };
}

export function notFound(message: string, path?: string): HandlerResult {
  return { ok: false, error: { code: "not-found", message, ...(path ? { path } : {}) } };
}

/** `data` with its `$schema` pointing at the world schema, listed first. */
export function withSchema(kind: FileKind, data: Record<string, unknown>): Record<string, unknown> {
  const { $schema: _old, ...rest } = data;
  return { $schema: schemaRefFor(kind), ...rest };
}
