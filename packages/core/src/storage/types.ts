import type { FileRef, Problem } from "@dramatis-personae/schema";

export interface WorldSummary {
  id: string;
  name: string;
  /** Folder name inside Data/worlds/. */
  folder: string;
  /** Null when world.json can't be read. */
  schemaVersion: number | null;
  /** Why the world can't be opened as it is: a broken world.json or a duplicate id. */
  problem?: string;
}

export interface StoredFile {
  /** Relative to the world folder, with forward slashes. */
  path: string;
  ref: FileRef;
  /** Already validated against FILE_SCHEMAS[ref.kind]. */
  data: unknown;
  fingerprint: string;
}

export interface LoadedWorld {
  worldId: string;
  folder: string;
  schemaVersion: number;
  files: StoredFile[];
  /** Portrait file names in assets/portraits/. */
  assets: string[];
  problems: Problem[];
}

export type DocumentChange =
  /** `fileName` is the bare file name for documents; ignored for the world and libraries. */
  | { op: "put"; ref: FileRef; fileName: string; text: string }
  | { op: "delete"; ref: FileRef }
  | { op: "putAsset"; fileName: string; bytes: Uint8Array }
  | { op: "deleteAsset"; fileName: string };

export interface WriteResult {
  /** New fingerprint per refKey; null for deleted files. */
  fingerprints: Record<string, string | null>;
}

export type ExternalChange =
  | { type: "upsert"; file: StoredFile }
  | { type: "invalid"; path: string; problem: Problem }
  | { type: "remove"; path: string; ref: FileRef };

export interface WatchEvents {
  /** Outside changes are being seen from now on; earlier ones can be missed. */
  onReady?: () => void;
  /** The watcher failed (for example, the system's watch limit); changes may be missed. */
  onError?: (error: Error) => void;
}

export interface RawFile {
  path: string;
  text: string;
}

export interface WorldStorage {
  listWorlds(): Promise<WorldSummary[]>;
  createWorld(init: { name: string }): Promise<string>;
  loadWorld(worldId: string): Promise<LoadedWorld>;
  write(worldId: string, changes: DocumentChange[]): Promise<WriteResult>;
  watch(
    worldId: string,
    onChange: (change: ExternalChange) => void,
    events?: WatchEvents,
  ): () => void;
  loadRaw(worldId: string): Promise<RawFile[]>;
  writeRaw(worldId: string, files: RawFile[]): Promise<void>;
  /** A portrait's bytes from assets/portraits/, or null if there is no such file. */
  readAsset(worldId: string, fileName: string): Promise<Uint8Array | null>;
  /**
   * When a file last changed, in ms. `path` is relative to the world folder,
   * with `/`. Null if there is no such file.
   */
  modifiedAt(worldId: string, path: string): Promise<number | null>;
  /**
   * Gives the document at `path` (a copy whose id is taken) a fresh id, under a
   * file name with the new id. Not a command: the copy isn't in the model.
   */
  assignNewId(worldId: string, path: string): Promise<StoredFile>;
  /** Zips the whole world into Backups/ and returns the zip's path. */
  backup(worldId: string): Promise<string>;
}
