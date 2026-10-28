import {
  DOCUMENT_FOLDERS,
  LIBRARY_FILES,
  PORTRAITS_FOLDER,
  WORLD_FILE,
  type DocumentKind,
  type FileKind,
  type FileRef,
} from "@dramatis-personae/schema";

export const WORLDS_DIR = ["Data", "worlds"] as const;
export const BACKUPS_DIR = "Backups";

const LIBRARY_BY_FILE = new Map(Object.entries(LIBRARY_FILES).map(([kind, file]) => [file, kind]));
const DOCUMENT_BY_FOLDER = new Map(
  Object.entries(DOCUMENT_FOLDERS).map(([kind, folder]) => [folder, kind as DocumentKind]),
);

/** Temporary files the app writes before renaming: `.<name>.<random>.tmp`. */
export function isTempFile(name: string): boolean {
  return name.startsWith(".") && name.endsWith(".tmp");
}

/** Which kind of file lives at this world-relative path, or null if none does. */
export function kindForPath(relative: string): FileKind | null {
  const parts = relative.split("/");
  const name = parts.at(-1) ?? "";
  if (!name.endsWith(".json") || isTempFile(name)) return null;
  if (parts.length === 1) {
    if (name === WORLD_FILE) return "world";
    return (LIBRARY_BY_FILE.get(name) as FileKind | undefined) ?? null;
  }
  if (parts.length === 2) return DOCUMENT_BY_FOLDER.get(parts[0]!) ?? null;
  return null;
}

/** World-relative path for a ref; documents need their file name. */
export function pathForRef(ref: FileRef, fileName: string): string {
  if (ref.kind === "world") return WORLD_FILE;
  if ("id" in ref) return `${DOCUMENT_FOLDERS[ref.kind]}/${fileName}`;
  return LIBRARY_FILES[ref.kind];
}

export function assetPath(fileName: string): string {
  return `${PORTRAITS_FOLDER}/${fileName}`;
}

/** Folders scanned for documents and temporary files. */
export const SCANNED_FOLDERS = ["", ...Object.values(DOCUMENT_FOLDERS)];
