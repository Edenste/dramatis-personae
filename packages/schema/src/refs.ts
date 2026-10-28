import { z } from "zod";
import { ID_PATTERN } from "./ids.ts";
import {
  DOCUMENT_KINDS,
  LIBRARY_KINDS,
  isDocumentKind,
  isLibraryKind,
  type DocumentKind,
  type LibraryKind,
} from "./kinds.ts";

export type FileRef =
  { kind: "world" } | { kind: LibraryKind } | { kind: DocumentKind; id: string };

export const FileRefSchema: z.ZodType<FileRef> = z.union([
  z.object({ kind: z.literal("world") }),
  z.object({ kind: z.enum(LIBRARY_KINDS) }),
  z.object({ kind: z.enum(DOCUMENT_KINDS), id: z.string().regex(ID_PATTERN) }),
]);

/** A string key for a ref: "world", "roles" or "character:<id>". */
export function refKey(ref: FileRef): string {
  return "id" in ref ? `${ref.kind}:${ref.id}` : ref.kind;
}

export function parseRefKey(key: string): FileRef {
  const [kind = "", id] = key.split(":");
  if (kind === "world" && id === undefined) return { kind };
  if (isLibraryKind(kind) && id === undefined) return { kind };
  if (isDocumentKind(kind) && id !== undefined && ID_PATTERN.test(id)) return { kind, id };
  throw new Error(`Not a ref key: ${key}`);
}
