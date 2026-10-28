import {
  FILE_SCHEMAS,
  LIBRARY_FILES,
  WORLD_FILE,
  isLibraryKind,
  type FileRef,
} from "@dramatis-personae/schema";
import { invalid, type HandlerContext, type HandlerResult, type Write } from "./types.ts";

interface RestoreFile {
  ref: FileRef;
  fileName: string | null;
  data: unknown;
}

function fileNameFor(ref: FileRef, given: string | null): string | null {
  if (ref.kind === "world") return WORLD_FILE;
  if (isLibraryKind(ref.kind)) return LIBRARY_FILES[ref.kind];
  return given !== null && given.endsWith(".json") ? given : null;
}

/**
 * Puts files back as given. The model gets the validated data (with defaults
 * filled in); the file gets exactly the data given, so undo round-trips byte
 * for byte.
 */
export function restoreFiles(ctx: HandlerContext, files: RestoreFile[]): HandlerResult {
  const writes: Write[] = [];
  for (const [i, file] of files.entries()) {
    if (file.data === null) {
      writes.push({ ref: file.ref, remove: true });
      continue;
    }
    const parsed = FILE_SCHEMAS[file.ref.kind].safeParse(file.data);
    if (!parsed.success) {
      return invalid(parsed.error.issues[0]?.message ?? "Invalid file", `files.${i}.data`);
    }
    const data = parsed.data as Record<string, unknown>;
    if ("id" in file.ref && data.id !== file.ref.id) {
      return invalid("The data's id doesn't match its ref", `files.${i}.data.id`);
    }
    if (file.ref.kind === "world" && data.id !== ctx.model.world.id) {
      return invalid("A world's id can't change", `files.${i}.data.id`);
    }
    const fileName = fileNameFor(file.ref, file.fileName);
    if (fileName === null)
      return invalid("A document needs a .json file name", `files.${i}.fileName`);
    writes.push({ ref: file.ref, fileName, data, raw: file.data });
  }
  return { ok: true, writes };
}
