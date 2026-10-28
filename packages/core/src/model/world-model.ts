import { basename } from "node:path";
import {
  refKey,
  type DocumentKind,
  type FileData,
  type FileRef,
  type LibraryKind,
  type Problem,
  type RelationshipFile,
  type WorldFile,
} from "@dramatis-personae/schema";
import { pathForRef } from "../storage/json-files/paths.ts";
import type { LoadedWorld } from "../storage/types.ts";
import { characterColor } from "./colour.ts";
import { dateEntries, type DateEntry } from "./dates.ts";
import { buildIndexes, type Indexes } from "./indexes.ts";
import { shownFieldKeys } from "./shown-fields.ts";
import { crossFileProblems } from "./validate.ts";

interface Entry {
  ref: FileRef;
  /** World-relative path. */
  path: string;
  data: unknown;
  fingerprint: string;
}

export type FileUpdate =
  | { ref: FileRef; fileName: string; data: unknown; fingerprint: string }
  | { ref: FileRef; removed: true };

const EMPTY_LIBRARIES: { [K in LibraryKind]: FileData<K> } = {
  fields: { fields: [] },
  roles: { roles: [] },
  relationshipTypes: { types: [] },
  templates: { templates: [] },
};

/**
 * A whole world in memory, with derived indexes. Immutable: every `with…`
 * method returns a new model that shares unchanged files.
 */
export class WorldModel {
  private readonly indexes: Indexes;
  private crossProblems: Problem[] | undefined;

  private constructor(
    readonly worldId: string,
    private readonly entries: ReadonlyMap<string, Entry>,
    private readonly assets: ReadonlySet<string>,
    private readonly loadProblems: readonly Problem[],
    /** Files that are currently invalid on disk, by path. */
    private readonly invalid: ReadonlyMap<string, Problem>,
  ) {
    this.indexes = buildIndexes(this);
  }

  static fromLoaded(world: LoadedWorld): WorldModel {
    const entries = new Map<string, Entry>();
    for (const file of world.files) {
      entries.set(refKey(file.ref), {
        ref: file.ref,
        path: file.path,
        data: file.data,
        fingerprint: file.fingerprint,
      });
    }
    return new WorldModel(world.worldId, entries, new Set(world.assets), world.problems, new Map());
  }

  get world(): WorldFile {
    return this.entries.get("world")?.data as WorldFile;
  }

  library<K extends LibraryKind>(kind: K): FileData<K> {
    return (this.entries.get(kind)?.data as FileData<K> | undefined) ?? EMPTY_LIBRARIES[kind];
  }

  get<K extends DocumentKind>(kind: K, id: string): FileData<K> | undefined {
    return this.entries.get(refKey({ kind, id }))?.data as FileData<K> | undefined;
  }

  all<K extends DocumentKind>(kind: K): FileData<K>[] {
    const result: FileData<K>[] = [];
    for (const entry of this.entries.values()) {
      if (entry.ref.kind === kind) result.push(entry.data as FileData<K>);
    }
    return result;
  }

  /** Any file's data by ref, or undefined if it isn't in the model. */
  data(ref: FileRef): unknown {
    return this.entries.get(refKey(ref))?.data;
  }

  /** World-relative path of a file, or undefined if it isn't in the model. */
  path(ref: FileRef): string | undefined {
    return this.entries.get(refKey(ref))?.path;
  }

  fileName(ref: FileRef): string | undefined {
    const path = this.path(ref);
    return path === undefined ? undefined : basename(path);
  }

  fingerprint(ref: FileRef): string | undefined {
    return this.entries.get(refKey(ref))?.fingerprint;
  }

  hasAsset(fileName: string): boolean {
    return this.assets.has(fileName);
  }

  relationshipsOf(characterId: string): RelationshipFile[] {
    return this.indexes.relationshipsByCharacter.get(characterId) ?? [];
  }

  membersOf(roleId: string): string[] {
    return this.indexes.membersByRole.get(roleId) ?? [];
  }

  shownFieldKeys(characterId: string): string[] {
    return shownFieldKeys(this, characterId);
  }

  characterColor(characterId: string): string {
    return characterColor(this, characterId);
  }

  dateEntries(): DateEntry[] {
    return dateEntries(this);
  }

  problems(): Problem[] {
    this.crossProblems ??= crossFileProblems(this);
    return [...this.loadProblems, ...this.invalid.values(), ...this.crossProblems];
  }

  /** True while the file on disk is invalid; the model keeps its last good version. */
  isBlocked(ref: FileRef): boolean {
    const path = this.path(ref);
    return path !== undefined && this.invalid.has(path);
  }

  withFiles(updates: FileUpdate[]): WorldModel {
    const entries = new Map(this.entries);
    for (const update of updates) {
      const key = refKey(update.ref);
      if ("removed" in update) {
        entries.delete(key);
      } else {
        entries.set(key, {
          ref: update.ref,
          path: pathForRef(update.ref, update.fileName),
          data: update.data,
          fingerprint: update.fingerprint,
        });
      }
    }
    return new WorldModel(this.worldId, entries, this.assets, this.loadProblems, this.invalid);
  }

  withInvalid(path: string, problem: Problem): WorldModel {
    const invalid = new Map(this.invalid).set(path, problem);
    return new WorldModel(this.worldId, this.entries, this.assets, this.loadProblems, invalid);
  }

  withValid(path: string): WorldModel {
    const invalid = new Map(this.invalid);
    invalid.delete(path);
    const loadProblems = this.loadProblems.filter((p) => p.path !== path);
    return new WorldModel(this.worldId, this.entries, this.assets, loadProblems, invalid);
  }

  /** Every file with its path and fingerprint, sorted by path. */
  files(): Array<{ ref: FileRef; path: string; data: unknown; fingerprint: string }> {
    return [...this.entries.values()]
      .map(({ ref, path, data, fingerprint }) => ({ ref, path, data, fingerprint }))
      .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  }

  /** Every file's data by ref key, for the API and for comparing worlds in tests. */
  snapshot(): Record<string, unknown> {
    return Object.fromEntries([...this.entries].map(([key, entry]) => [key, entry.data]));
  }
}
