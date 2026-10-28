export const DOCUMENT_KINDS = ["character", "relationship", "event", "view", "search"] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const LIBRARY_KINDS = ["fields", "roles", "relationshipTypes", "templates"] as const;
export type LibraryKind = (typeof LIBRARY_KINDS)[number];

export type FileKind = "world" | LibraryKind | DocumentKind;
export const FILE_KINDS: readonly FileKind[] = ["world", ...LIBRARY_KINDS, ...DOCUMENT_KINDS];

/** Folder for each document kind, inside a world folder. */
export const DOCUMENT_FOLDERS: Record<DocumentKind, string> = {
  character: "characters",
  relationship: "relationships",
  event: "events",
  view: "views",
  search: "searches",
};

/** File name for each library, at the root of a world folder. */
export const LIBRARY_FILES: Record<LibraryKind, string> = {
  fields: "fields.json",
  roles: "roles.json",
  relationshipTypes: "relationship-types.json",
  templates: "templates.json",
};

export const WORLD_FILE = "world.json";
export const PORTRAITS_FOLDER = "assets/portraits";
export const CURRENT_SCHEMA_VERSION = 1;

export function isDocumentKind(kind: string): kind is DocumentKind {
  return (DOCUMENT_KINDS as readonly string[]).includes(kind);
}

export function isLibraryKind(kind: string): kind is LibraryKind {
  return (LIBRARY_KINDS as readonly string[]).includes(kind);
}
