import {
  FILE_SCHEMAS,
  LIBRARY_FILES,
  WORLD_FILE,
  isLibraryKind,
  type FileRef,
} from "@dramatis-personae/schema";
import { invalid, type HandlerResult, type Write } from "./types.ts";

interface RestoreFile {
  ref: FileRef;
  fileName: string | null;
  data: unknown;
}

function defaultFileName(ref: FileRef): string | null {
  if (ref.kind === "world") return WORLD_FILE;
  if (isLibraryKind(ref.kind)) return LIBRARY_FILES[ref.kind];
  return null;
}

/** Puts files back exactly as given, without touching their `$schema`. */
export function restoreFiles(files: RestoreFile[]): HandlerResult {
  const writes: Write[] = [];
  for (const [i, file] of files.entries()) {
    if (file.data === null) {
      writes.push({ ref: file.ref, remove: true });
      continue;
    }
    const parsed = FILE_SCHEMAS[file.ref.kind].safeParse(file.data);
    if (!parsed.success)
      return invalid(parsed.error.issues[0]?.message ?? "Invalid file", `files.${i}.data`);
    const fileName = file.fileName ?? defaultFileName(file.ref);
    if (fileName === null) return invalid("A document needs a file name", `files.${i}.fileName`);
    writes.push({ ref: file.ref, fileName, data: file.data as Record<string, unknown> });
  }
  return { ok: true, writes };
}
