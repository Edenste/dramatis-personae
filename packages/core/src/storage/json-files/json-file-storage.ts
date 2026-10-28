import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { zipSync } from "fflate";
import {
  DOCUMENT_FOLDERS,
  LIBRARY_FILES,
  LIBRARY_KINDS,
  PORTRAITS_FOLDER,
  SCHEMAS_FOLDER,
  WORLD_FILE,
  documentFileName,
  generateId as defaultGenerateId,
  isDocumentKind,
  parseRefKey,
  refKey,
  worldFolderName,
  type DocumentKind,
  type FileRef,
  type Problem,
  type WorldFile,
} from "@dramatis-personae/schema";
import { newWorldFiles, schemaFiles } from "../../defaults.ts";
import { fingerprint, serialize } from "../../serialize.ts";
import { StorageError } from "../errors.ts";
import { errorCode, nodeFileSystem, type FileSystem } from "../fs.ts";
import type {
  DocumentChange,
  ExternalChange,
  LoadedWorld,
  RawFile,
  StoredFile,
  WorldStorage,
  WorldSummary,
  WriteResult,
} from "../types.ts";
import {
  BACKUPS_DIR,
  SCANNED_FOLDERS,
  WORLDS_DIR,
  assetPath,
  isTempFile,
  kindForPath,
  pathForRef,
} from "./paths.ts";
import { decodeText, parseFile } from "./read.ts";
import { watchFolder } from "./watch.ts";
import { PathQueue, removeFile, withLockRetry, writeAtomic } from "./write.ts";

export interface JsonFileStorageOptions {
  /** The data root holding Data/, Backups/ and so on. */
  dataRoot: string;
  fs?: FileSystem;
  generateId?: () => string;
  sleep?: (ms: number) => Promise<void>;
}

type ReadResult = { ok: true; file: StoredFile } | { ok: false; problem: Problem };

/** What the adapter remembers about a loaded world. */
interface WorldState {
  /** Absolute path of the world folder. */
  root: string;
  /** World-relative path per refKey. */
  paths: Map<string, string>;
}

export class JsonFileStorage implements WorldStorage {
  protected readonly fs: FileSystem;
  protected readonly dataRoot: string;
  protected readonly generateId: () => string;
  protected readonly sleep: (ms: number) => Promise<void>;
  protected readonly loaded = new Map<string, WorldState>();
  protected readonly queue = new PathQueue();
  /** Fingerprint of the last text the app wrote, per absolute path. */
  protected readonly ownWrites = new Map<string, string>();
  /** Absolute paths the app has just deleted. */
  protected readonly ownDeletes = new Set<string>();

  constructor(options: JsonFileStorageOptions) {
    this.dataRoot = options.dataRoot;
    this.fs = options.fs ?? nodeFileSystem;
    this.generateId = options.generateId ?? defaultGenerateId;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  protected get worldsDir(): string {
    return join(this.dataRoot, ...WORLDS_DIR);
  }

  /**
   * Every folder with a world.json. A broken world.json, or two folders with the
   * same id (a copied folder), is listed with a `problem` rather than hidden.
   */
  async listWorlds(): Promise<WorldSummary[]> {
    const worlds: WorldSummary[] = [];
    for (const folder of (await this.list(this.worldsDir)).sort()) {
      const bytes = await this.read(join(this.worldsDir, folder, WORLD_FILE));
      if (!bytes) continue;
      const parsed = parseFile(WORLD_FILE, "world", bytes);
      if (parsed.ok) {
        const world = parsed.data as WorldFile;
        worlds.push({ id: world.id, name: world.name, folder, schemaVersion: world.schemaVersion });
      } else {
        worlds.push({
          id: /-([a-z0-9]{16})$/.exec(folder)?.[1] ?? folder,
          name: folder,
          folder,
          schemaVersion: null,
          problem: `world.json is invalid: ${parsed.problem.message}`,
        });
      }
    }
    for (const world of worlds) {
      const others = worlds.filter((w) => w.id === world.id && w !== world).map((w) => w.folder);
      if (others.length > 0 && world.schemaVersion !== null) {
        world.problem = `Another world folder has the same id: ${others.join(", ")}`;
      }
    }
    return worlds;
  }

  async createWorld(init: { name: string }): Promise<string> {
    const files = newWorldFiles(init.name, this.generateId);
    const root = join(this.worldsDir, worldFolderName(init.name, files.world.id));
    for (const folder of [...Object.values(DOCUMENT_FOLDERS), PORTRAITS_FOLDER, SCHEMAS_FOLDER]) {
      await this.fs.mkdir(join(root, folder), { recursive: true });
    }
    const put = (relative: string, data: unknown) =>
      writeAtomic(this.fs, join(root, relative), serialize(data));
    await put(WORLD_FILE, files.world);
    await put(LIBRARY_FILES.fields, files.fields);
    await put(LIBRARY_FILES.roles, files.roles);
    await put(LIBRARY_FILES.relationshipTypes, files.relationshipTypes);
    await put(LIBRARY_FILES.templates, files.templates);
    await put(
      `${DOCUMENT_FOLDERS.view}/${documentFileName(files.mainView.name, files.mainView.id)}`,
      files.mainView,
    );
    for (const file of schemaFiles(files.fields.fields)) await put(file.path, file.data);
    return files.world.id;
  }

  async loadWorld(worldId: string): Promise<LoadedWorld> {
    const folder = await this.folderFor(worldId);
    const root = join(this.worldsDir, folder);
    await this.removeTempFiles(root);

    const files: StoredFile[] = [];
    const problems: Problem[] = [];
    const paths = new Map<string, string>();
    const add = (file: StoredFile) => {
      files.push(file);
      paths.set(refKey(file.ref), file.path);
    };

    const world = await this.readFile(root, WORLD_FILE, { kind: "world" });
    if (!world.ok) {
      throw new StorageError("io", WORLD_FILE, `world.json is invalid: ${world.problem.message}`);
    }
    add(world.file);

    for (const kind of LIBRARY_KINDS) {
      const path = LIBRARY_FILES[kind];
      if (!(await this.read(join(root, path)))) continue;
      const result = await this.readFile(root, path, { kind });
      if (result.ok) add(result.file);
      else problems.push(result.problem);
    }

    for (const [kind, sub] of Object.entries(DOCUMENT_FOLDERS) as [DocumentKind, string][]) {
      const names = (await this.list(join(root, sub)))
        .filter((name) => name.endsWith(".json") && !isTempFile(name))
        .sort();
      for (const name of names) {
        const path = `${sub}/${name}`;
        const result = await this.readDocument(root, path, kind);
        if (!result.ok) {
          problems.push(result.problem);
        } else if (paths.has(refKey(result.file.ref))) {
          problems.push({
            code: "duplicate-id",
            path,
            message: `Same id as ${paths.get(refKey(result.file.ref))}`,
            ref: result.file.ref,
            fix: "assignNewId",
          });
        } else {
          add(result.file);
        }
      }
    }

    const assets = (await this.list(join(root, PORTRAITS_FOLDER))).filter((n) => !isTempFile(n));
    const schemaVersion = (world.file.data as { schemaVersion: number }).schemaVersion;
    this.loaded.set(worldId, { root, paths });
    return { worldId, folder, schemaVersion, files, assets, problems };
  }

  write(worldId: string, changes: DocumentChange[]): Promise<WriteResult> {
    const state = this.loaded.get(worldId);
    if (!state) {
      return Promise.reject(
        new StorageError("not-loaded", worldId, `World ${worldId} isn't loaded`),
      );
    }
    // One batch at a time per world, so the path bookkeeping can't race.
    return this.queue.run(`world:${worldId}`, () => this.applyChanges(state, changes));
  }

  protected async applyChanges(state: WorldState, changes: DocumentChange[]): Promise<WriteResult> {
    const fingerprints: Record<string, string | null> = {};
    for (const change of changes) {
      if (change.op === "put") {
        const key = refKey(change.ref);
        const path = pathForRef(change.ref, bareFileName(change.fileName));
        const previous = state.paths.get(key);
        if (previous !== undefined && previous !== path && sameFileName(previous, path)) {
          // Only the spelling changed ("Kay" to "kay", NFD to NFC). On Windows and macOS
          // both spellings are one file, so writing then removing the old would delete it.
          await this.renameFile(state.root, previous, path);
          await this.putText(state.root, path, change.text);
        } else {
          await this.putText(state.root, path, change.text);
          if (previous !== undefined && previous !== path) await this.remove(state.root, previous);
        }
        state.paths.set(key, path);
        fingerprints[key] = fingerprint(change.text);
      } else if (change.op === "delete") {
        const key = refKey(change.ref);
        const path = state.paths.get(key);
        if (path !== undefined) await this.remove(state.root, path);
        state.paths.delete(key);
        fingerprints[key] = null;
      } else if (change.op === "putAsset") {
        const absolute = inside(state.root, assetPath(bareFileName(change.fileName)));
        await this.queue.run(absolute, () =>
          writeAtomic(this.fs, absolute, change.bytes, this.sleep),
        );
      } else {
        await this.remove(state.root, assetPath(bareFileName(change.fileName)));
      }
    }
    return { fingerprints };
  }

  protected renameFile(root: string, from: string, to: string): Promise<void> {
    const source = inside(root, from);
    const target = inside(root, to);
    return this.queue.run(target, async () => {
      this.ownDeletes.add(source);
      await withLockRetry(target, this.sleep, () => this.fs.rename(source, target));
    });
  }

  /** Atomically writes a world file and remembers it as the app's own write. */
  protected putText(root: string, path: string, text: string): Promise<void> {
    const absolute = inside(root, path);
    return this.queue.run(absolute, async () => {
      this.ownWrites.set(absolute, fingerprint(text));
      await writeAtomic(this.fs, absolute, text, this.sleep);
    });
  }

  protected remove(root: string, path: string): Promise<void> {
    const absolute = inside(root, path);
    return this.queue.run(absolute, async () => {
      this.ownDeletes.add(absolute);
      this.ownWrites.delete(absolute);
      await removeFile(this.fs, absolute, this.sleep);
    });
  }

  watch(worldId: string, onChange: (change: ExternalChange) => void): () => void {
    const state = this.loaded.get(worldId);
    if (!state) throw new StorageError("not-loaded", worldId, `World ${worldId} isn't loaded`);
    let stopped = false;
    const stop = watchFolder(state.root, (absolute) => {
      void this.queue
        .run(absolute, () => this.externalChange(state, absolute))
        .then((change) => {
          if (change && !stopped) onChange(change);
        })
        .catch(() => undefined);
    });
    return () => {
      stopped = true;
      stop();
    };
  }

  /** Works out what an outside change to one file means, or null if it was the app's own. */
  protected async externalChange(
    state: WorldState,
    absolute: string,
  ): Promise<ExternalChange | null> {
    const path = relative(state.root, absolute).split(sep).join("/");
    const kind = kindForPath(path);
    if (!kind) return null;

    const bytes = await this.read(absolute);
    if (!bytes) {
      if (this.ownDeletes.delete(absolute)) return null;
      const key = [...state.paths].find(([, p]) => p === path)?.[0];
      this.ownWrites.delete(absolute);
      if (key === undefined) return null;
      state.paths.delete(key);
      return { type: "remove", path, ref: parseRefKey(key) };
    }
    this.ownDeletes.delete(absolute);
    if (this.ownWrites.get(absolute) === fingerprint(bytes)) return null;

    const result = isDocumentKind(kind)
      ? await this.readDocument(state.root, path, kind, bytes)
      : await this.readFile(state.root, path, { kind });
    if (!result.ok) {
      this.ownWrites.delete(absolute);
      return { type: "invalid", path, problem: result.problem };
    }

    const key = refKey(result.file.ref);
    const known = state.paths.get(key);
    if (known !== undefined && known !== path && (await this.read(join(state.root, known)))) {
      return {
        type: "invalid",
        path,
        problem: {
          code: "duplicate-id",
          path,
          message: `Same id as ${known}`,
          ref: result.file.ref,
          fix: "assignNewId",
        },
      };
    }
    state.paths.set(key, path);
    // The model now holds this content, so a later revert to the app's own last
    // write is a real change and must be reported.
    this.ownWrites.set(absolute, result.file.fingerprint);
    return { type: "upsert", file: result.file };
  }

  /** Every world, library and document file as text, without validating it. */
  async loadRaw(worldId: string): Promise<RawFile[]> {
    const root = join(this.worldsDir, await this.folderFor(worldId));
    const files: RawFile[] = [];
    for (const sub of SCANNED_FOLDERS) {
      for (const name of (await this.list(join(root, sub))).sort()) {
        const path = sub ? `${sub}/${name}` : name;
        if (!kindForPath(path)) continue;
        const bytes = await this.read(join(root, path));
        if (!bytes) continue;
        const decoded = decodeText(bytes);
        if (!decoded.ok) throw new StorageError("io", path, `${path}: ${decoded.message}`);
        files.push({ path, text: decoded.text });
      }
    }
    return files;
  }

  async writeRaw(worldId: string, files: RawFile[]): Promise<void> {
    const root = join(this.worldsDir, await this.folderFor(worldId));
    for (const file of files) await this.putText(root, file.path, file.text);
  }

  async readAsset(worldId: string, fileName: string): Promise<Uint8Array | null> {
    const root =
      this.loaded.get(worldId)?.root ?? join(this.worldsDir, await this.folderFor(worldId));
    return (await this.read(inside(root, assetPath(bareFileName(fileName))))) ?? null;
  }

  assignNewId(worldId: string, path: string): Promise<StoredFile> {
    const state = this.loaded.get(worldId);
    if (!state) {
      return Promise.reject(
        new StorageError("not-loaded", worldId, `World ${worldId} isn't loaded`),
      );
    }
    return this.queue.run(`world:${worldId}`, () => this.reassignId(state, path));
  }

  protected async reassignId(state: WorldState, path: string): Promise<StoredFile> {
    const kind = kindForPath(path);
    if (!kind || !isDocumentKind(kind)) {
      throw new StorageError("io", path, `${path} isn't a document file`);
    }
    const bytes = await this.read(inside(state.root, path));
    if (!bytes) throw new StorageError("not-found", path, `${path} doesn't exist`);
    const parsed = parseFile(path, kind, bytes);
    if (!parsed.ok) throw new StorageError("io", path, parsed.problem.message);

    const { $schema, id: oldId, ...rest } = parsed.data;
    const id = this.generateId();
    const data = { $schema, id, ...rest };
    const text = serialize(data);
    const base = path.slice(path.indexOf("/") + 1, -".json".length);
    const suffix = typeof oldId === "string" ? `-${oldId}` : null;
    const stem = suffix && base.endsWith(suffix) ? base.slice(0, -suffix.length) : base;
    const newPath = `${DOCUMENT_FOLDERS[kind]}/${stem}-${id}.json`;

    await this.putText(state.root, newPath, text);
    await this.remove(state.root, path);
    const ref: FileRef = { kind, id };
    state.paths.set(refKey(ref), newPath);
    return { path: newPath, ref, data, fingerprint: fingerprint(text) };
  }

  async backup(worldId: string): Promise<string> {
    const folder = await this.folderFor(worldId);
    const root = join(this.worldsDir, folder);
    const entries: Record<string, Uint8Array> = {};
    for (const path of await this.listTree(root)) {
      const bytes = await this.read(join(root, path));
      if (bytes) entries[path] = bytes;
    }
    const dir = join(this.dataRoot, BACKUPS_DIR);
    await this.fs.mkdir(dir, { recursive: true });
    const path = join(dir, `${folder}-${timestamp(new Date())}.zip`);
    await writeAtomic(this.fs, path, zipSync(entries), this.sleep);
    return path;
  }

  /** Every file under `dir`, as relative paths with forward slashes. */
  protected async listTree(dir: string, prefix = ""): Promise<string[]> {
    const paths: string[] = [];
    for (const name of await this.list(dir)) {
      if (isTempFile(name)) continue;
      const relativePath = prefix ? `${prefix}/${name}` : name;
      if ((await this.fs.stat(join(dir, name))).isDirectory()) {
        paths.push(...(await this.listTree(join(dir, name), relativePath)));
      } else {
        paths.push(relativePath);
      }
    }
    return paths;
  }

  protected async folderFor(worldId: string): Promise<string> {
    const matches = (await this.listWorlds()).filter((w) => w.id === worldId);
    const world = matches[0];
    if (!world) throw new StorageError("not-found", worldId, `No world with id ${worldId}`);
    if (matches.length > 1) {
      const folders = matches.map((w) => w.folder).join(", ");
      throw new StorageError(
        "ambiguous",
        worldId,
        `Several world folders have id ${worldId}: ${folders}`,
      );
    }
    if (world.schemaVersion === null) throw new StorageError("io", WORLD_FILE, world.problem ?? "");
    return world.folder;
  }

  /** Reads and validates the world or a library file. */
  protected async readFile(root: string, path: string, ref: FileRef): Promise<ReadResult> {
    const bytes = (await this.read(join(root, path))) ?? new Uint8Array();
    const parsed = parseFile(path, ref.kind, bytes);
    if (!parsed.ok) return parsed;
    return { ok: true, file: { path, ref, data: parsed.data, fingerprint: parsed.fingerprint } };
  }

  /** Reads and validates a document, assigning and writing back an id if it has none. */
  protected async readDocument(
    root: string,
    path: string,
    kind: DocumentKind,
    /** Bytes already read, when called from inside this path's write queue. */
    known?: Uint8Array,
  ): Promise<ReadResult> {
    const bytes = known ?? (await this.read(join(root, path))) ?? new Uint8Array();
    const parsed = parseFile(path, kind, bytes);
    if (!parsed.ok) return parsed;
    if (!parsed.missingId) {
      const id = parsed.data.id as string;
      const file = { path, ref: { kind, id }, data: parsed.data, fingerprint: parsed.fingerprint };
      return { ok: true, file };
    }
    const { $schema, ...rest } = parsed.data;
    const data = { $schema, id: this.generateId(), ...rest };
    const text = serialize(data);
    if (known) {
      // Already inside this path's queue: queuing again would wait on ourselves.
      const absolute = join(root, path);
      this.ownWrites.set(absolute, fingerprint(text));
      await writeAtomic(this.fs, absolute, text, this.sleep);
    } else {
      await this.putText(root, path, text);
    }
    return {
      ok: true,
      file: { path, ref: { kind, id: data.id }, data, fingerprint: fingerprint(text) },
    };
  }

  protected async removeTempFiles(root: string): Promise<void> {
    for (const sub of SCANNED_FOLDERS) {
      for (const name of await this.list(join(root, sub))) {
        if (isTempFile(name)) await this.fs.unlink(join(root, sub, name)).catch(() => undefined);
      }
    }
  }

  /** Directory entries, or [] if the directory doesn't exist. */
  protected async list(dir: string): Promise<string[]> {
    try {
      return await this.fs.readdir(dir);
    } catch (error) {
      if (errorCode(error) === "ENOENT") return [];
      throw error;
    }
  }

  /** File bytes, or undefined if the file doesn't exist. */
  protected async read(path: string): Promise<Uint8Array | undefined> {
    try {
      return await this.fs.readFile(path);
    } catch (error) {
      const code = errorCode(error);
      if (code === "ENOENT" || code === "EISDIR") return undefined;
      throw error;
    }
  }
}

/** Local time as YYYYMMDD-HHmmss, for backup file names. */
function timestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-` +
    `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

/** Rejects a file name that contains folders, so it can't leave its own folder. */
function bareFileName(name: string): string {
  if (name === "" || name === "." || name === ".." || /[/\\]/.test(name)) {
    throw new StorageError("io", name, `${name} isn't a plain file name`);
  }
  return name;
}

/** The absolute path of a world-relative path, refusing anything outside the world. */
function inside(root: string, path: string): string {
  const absolute = resolve(root, path);
  const rel = relative(root, absolute);
  if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) {
    throw new StorageError("io", path, `${path} is outside the world folder`);
  }
  return absolute;
}

/** True when two paths differ only in case or Unicode composition. */
function sameFileName(a: string, b: string): boolean {
  return a.normalize("NFC").toLowerCase() === b.normalize("NFC").toLowerCase();
}
