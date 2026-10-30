import {
  LIBRARY_FILES,
  documentFileName,
  schemaRefFor,
  type FileKind,
  type FileRef,
  type LibraryKind,
} from "@dramatis-personae/schema";
import type { WorldModel } from "../model/world-model.ts";

export interface CommandError {
  code: "forbidden" | "read-only" | "invalid" | "not-found" | "conflict" | "blocked";
  message: string;
  /** Path into the batch, such as "commands.1.set.roles.0". */
  path?: string;
}

/** One file a command writes or removes. */
export type Write =
  | {
      ref: FileRef;
      fileName: string;
      /** What the model holds. */
      data: Record<string, unknown>;
      /** What the file is written from, when it differs from `data` (restore). */
      raw?: unknown;
    }
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

/** A write of one library file, under its fixed name. */
export function libraryWrite(kind: LibraryKind, data: object): Write {
  return {
    ref: { kind },
    fileName: LIBRARY_FILES[kind],
    data: withSchema(kind, data as Record<string, unknown>),
  };
}

/** A write of a character, keeping its current file name. */
export function characterWrite<T extends { id: string; name: string }>(
  ctx: HandlerContext,
  character: T,
): Write {
  const ref: FileRef = { kind: "character", id: character.id };
  return {
    ref,
    fileName: ctx.model.fileName(ref) ?? documentFileName(character.name, character.id),
    data: withSchema("character", character),
  };
}

/** `data` with its `$schema` pointing at the world schema, listed first. */
export function withSchema(kind: FileKind, data: Record<string, unknown>): Record<string, unknown> {
  const { $schema: _old, ...rest } = data;
  return { $schema: schemaRefFor(kind), ...rest };
}
