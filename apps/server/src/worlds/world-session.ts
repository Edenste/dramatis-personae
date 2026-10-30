import { basename } from "node:path";
import {
  SearchIndex,
  WorldModel,
  applyBatch,
  can,
  openWorld,
  referenceFix,
  type CommandError,
  type DocumentChange,
  type ExternalChange,
  type OpenWorldOptions,
  type User,
  type WorldStorage,
} from "@dramatis-personae/core";
import {
  parseRefKey,
  refKey,
  slugify,
  type CommandBatch,
  type CommandResult,
  type Crop,
  type FileRef,
  type FixRequest,
  type ServerMessage,
  type WorldSnapshot,
  type WorldSummary,
} from "@dramatis-personae/schema";
import { ApiError, UNSUPPORTED_IMAGE } from "../http/errors.ts";
import { cropFits, inspectImage, makeThumbnail } from "../portraits/images.ts";
import { SerialQueue } from "./serial-queue.ts";

/** A pushed message before the session gives it a sequence number. */
type UnnumberedMessage = ServerMessage extends infer M
  ? M extends unknown
    ? Omit<M, "seq">
    : never
  : never;

export interface SessionOptions extends OpenWorldOptions {
  /** Hears about problems that don't stop the world working, for the log. */
  onWarning?: (message: string) => void;
  /** How long opening waits for the file watcher. Default 10 seconds. */
  readyTimeoutMs?: number;
}

const UNSAVED_MESSAGE =
  "Couldn't save your change. It's kept in the app; retry when the file is free.";

const THUMBNAIL_SUFFIX = ".thumb.webp";
const PORTRAITS = "assets/portraits";

const COMMAND_STATUS: Record<CommandError["code"], number> = {
  forbidden: 403,
  "read-only": 403,
  invalid: 400,
  "not-found": 404,
  conflict: 409,
  blocked: 409,
};

/** Library kinds whose changes alter how characters are searched. */
const SEARCH_LIBRARIES = new Set(["roles", "fields", "templates"]);

/** The files a batch is writing right now, and outside changes to them seen meanwhile. */
interface Writing {
  /** Ref key by world-relative path, before and after the batch. */
  keys: Map<string, string>;
  raced: Set<string>;
}

interface Pending {
  changes: DocumentChange[];
  result: CommandResult;
}

const refsOf = (changes: DocumentChange[]): FileRef[] =>
  changes.flatMap((change) => (change.op === "put" || change.op === "delete" ? [change.ref] : []));

/**
 * One open world: its model, search index and file watcher. Commands, retries,
 * fixes and outside changes all go through one queue, so they apply in order.
 *
 * When an outside edit and an app write hit the same file at once, the app's
 * write wins, on disk and in memory alike. That includes an outside edit made
 * within the watcher's debounce window just before the app writes.
 */
export class WorldSession {
  private current: WorldModel;
  private index: SearchIndex;
  private pending: Pending | null = null;
  private writing: Writing | null = null;
  private readonly queue = new SerialQueue();
  private readonly listeners = new Set<(message: ServerMessage) => void>();
  /** Counts pushed messages; a snapshot reports the latest, so clients can drop older pushes. */
  private seq = 0;
  private stopWatching: () => void = () => undefined;
  private warn: (message: string) => void = () => undefined;

  private constructor(
    private readonly storage: WorldStorage,
    readonly worldId: string,
    model: WorldModel,
    readonly readOnly: boolean,
  ) {
    this.current = model;
    this.index = SearchIndex.build(model);
  }

  static async open(
    storage: WorldStorage,
    worldId: string,
    options: SessionOptions = {},
  ): Promise<WorldSession> {
    const { model, readOnly } = await openWorld(storage, worldId, options);
    const session = new WorldSession(storage, worldId, model, readOnly);
    const warn = options.onWarning ?? (() => undefined);
    session.warn = warn;
    // The world counts as open once outside edits are being seen. If watching
    // fails or stalls, it opens anyway: the app works, outside edits may be missed.
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        warn(`World ${worldId}: still not watching for outside edits; opening anyway`);
        resolve();
      }, options.readyTimeoutMs ?? 10_000);
      session.stopWatching = storage.watch(
        worldId,
        (change) => {
          if (session.racesWrite(change)) return;
          void session.queue.run(() => Promise.resolve(session.onExternal(change)));
        },
        {
          onReady: () => {
            clearTimeout(timer);
            resolve();
          },
          onError: (error) => {
            clearTimeout(timer);
            warn(`World ${worldId}: can't watch for outside edits: ${error.message}`);
            resolve();
          },
        },
      );
    });
    return session;
  }

  get model(): WorldModel {
    return this.current;
  }

  get unsaved(): { message: string } | null {
    return this.pending ? { message: UNSAVED_MESSAGE } : null;
  }

  snapshot(summary: WorldSummary): WorldSnapshot {
    return {
      world: summary,
      readOnly: this.readOnly,
      unsaved: this.unsaved,
      files: this.current.files(),
      problems: this.current.problems(),
      seq: this.seq,
    };
  }

  apply(batch: unknown, user: User): Promise<CommandResult> {
    return this.queue.run(() => this.applyNow(batch as CommandBatch, user));
  }

  retry(): Promise<CommandResult> {
    return this.queue.run(async () => {
      const pending = this.pending;
      if (!pending) throw new ApiError(409, "conflict", "Nothing to retry");
      try {
        await this.writeChanges(pending.changes, this.current);
      } catch {
        throw new ApiError(503, "save-failed", UNSAVED_MESSAGE);
      }
      this.pending = null;
      this.emit({ type: "save-state", world: this.worldId, unsaved: false });
      return pending.result;
    });
  }

  discardUnsaved(): Promise<void> {
    return this.queue.run(async () => {
      this.current = WorldModel.fromLoaded(await this.storage.loadWorld(this.worldId));
      this.index = SearchIndex.build(this.current);
      this.pending = null;
      this.emit({ type: "save-state", world: this.worldId, unsaved: false });
      this.emit({ type: "reload", world: this.worldId });
    });
  }

  fix(request: FixRequest, user: User): Promise<CommandResult> {
    return this.queue.run(async () => {
      if (!can(user, "edit")) {
        throw new ApiError(403, "forbidden", "You don't have edit access to this world");
      }
      const problems = this.current.problems();
      if (request.fix === "removeReference") {
        const key = refKey(request.ref);
        const fix = problems.some(
          (p) => p.fix === "removeReference" && p.ref !== undefined && refKey(p.ref) === key,
        )
          ? referenceFix(this.current, request.ref)
          : null;
        if (!fix) throw new ApiError(404, "not-found", "That problem isn't there any more");
        return this.applyNow({ commands: [{ type: "restore", files: [fix] }] }, user);
      }

      if (this.readOnly) throw new ApiError(403, "read-only", "This world is open read-only");
      this.refuseWhilePending();
      if (!problems.some((p) => p.code === "duplicate-id" && p.path === request.path)) {
        throw new ApiError(404, "not-found", "That problem isn't there any more");
      }
      const file = await this.storage.assignNewId(this.worldId, request.path);
      const before = this.current;
      this.current = this.current
        .withFiles([
          {
            ref: file.ref,
            fileName: basename(file.path),
            data: file.data,
            fingerprint: file.fingerprint,
          },
        ])
        .withValid(request.path);
      this.changed(before, [file.ref]);
      // Not a command, so there is nothing to undo.
      return { inverse: { commands: [] }, fingerprints: { [refKey(file.ref)]: file.fingerprint } };
    });
  }

  search(query: string): Array<{ id: string; score: number }> {
    return this.index.search(query);
  }

  readAsset(fileName: string): Promise<Uint8Array | null> {
    return this.storage.readAsset(this.worldId, fileName);
  }

  /**
   * Gives a character a portrait from an uploaded image. The file is
   * `<name>-<id>.<ext>`, overwriting any earlier one, so this can't be undone.
   */
  setPortrait(user: User, id: string, bytes: Uint8Array, crop: Crop): Promise<CommandResult> {
    return this.queue.run(async () => {
      const character = this.portraitCharacter(user, id);
      const image = await inspectImage(bytes);
      if (!image) throw new ApiError(415, "unsupported-image", UNSUPPORTED_IMAGE);
      if (!cropFits(crop, image.width, image.height)) {
        throw new ApiError(400, "invalid", "The crop must fit inside the image.");
      }
      const file = `${slugify(character.name)}-${id}${image.ext}`;
      const old = character.portrait?.file;
      const before: DocumentChange[] = [
        { op: "putAsset", fileName: file, bytes },
        { op: "deleteAsset", fileName: file + THUMBNAIL_SUFFIX },
      ];
      if (old !== undefined && old !== file) {
        before.push(
          { op: "deleteAsset", fileName: old },
          { op: "deleteAsset", fileName: old + THUMBNAIL_SUFFIX },
        );
      }
      const batch: CommandBatch = {
        commands: [{ type: "character.update", id, set: { portrait: { file, crop } } }],
      };
      return this.applyNow(batch, user, { before, undoable: false });
    });
  }

  /** Removes a character's portrait, its image and thumbnail. Can't be undone. */
  removePortrait(user: User, id: string): Promise<CommandResult> {
    return this.queue.run(async () => {
      const file = this.portraitCharacter(user, id).portrait?.file;
      if (file === undefined)
        throw new ApiError(404, "not-found", "This character has no portrait");
      const before: DocumentChange[] = [
        { op: "deleteAsset", fileName: file },
        { op: "deleteAsset", fileName: file + THUMBNAIL_SUFFIX },
      ];
      const batch: CommandBatch = {
        commands: [{ type: "character.update", id, set: { portrait: null } }],
      };
      return this.applyNow(batch, user, { before, undoable: false });
    });
  }

  /**
   * A portrait's 256 × 256 thumbnail, made from the original and the crop when
   * it is missing or older than the character's file. Null when there is
   * nothing to make it from.
   */
  thumbnail(fileName: string): Promise<Uint8Array | null> {
    if (!fileName.endsWith(THUMBNAIL_SUFFIX)) return Promise.resolve(null);
    const original = fileName.slice(0, -THUMBNAIL_SUFFIX.length);
    return this.queue.run(async () => {
      const character = this.current.all("character").find((c) => c.portrait?.file === original);
      if (!character?.portrait) return null;
      const characterPath = this.current.path({ kind: "character", id: character.id });
      const [thumbTime, characterTime] = await Promise.all([
        this.storage.modifiedAt(this.worldId, `${PORTRAITS}/${fileName}`),
        characterPath === undefined
          ? Promise.resolve(null)
          : this.storage.modifiedAt(this.worldId, characterPath),
      ]);
      if (thumbTime !== null && (characterTime === null || thumbTime >= characterTime)) {
        const kept = await this.storage.readAsset(this.worldId, fileName);
        if (kept) return kept;
      }
      const source = await this.storage.readAsset(this.worldId, original);
      if (!source) return null;
      try {
        const made = await makeThumbnail(source, character.portrait.crop);
        await this.storage.write(this.worldId, [{ op: "putAsset", fileName, bytes: made }]);
        return made;
      } catch (error) {
        this.warn(
          `World ${this.worldId}: couldn't make a thumbnail for ${original}: ${String(error)}`,
        );
        return null;
      }
    });
  }

  /** The character a portrait change is for, once the user and world allow editing. */
  private portraitCharacter(user: User, id: string) {
    if (!can(user, "edit")) {
      throw new ApiError(403, "forbidden", "You don't have edit access to this world");
    }
    if (this.readOnly) throw new ApiError(403, "read-only", "This world is open read-only");
    this.refuseWhilePending();
    const character = this.current.get("character", id);
    if (!character) throw new ApiError(404, "not-found", "No such character");
    return character;
  }

  subscribe(listener: (message: ServerMessage) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  close(): void {
    this.stopWatching();
    this.listeners.clear();
  }

  private refuseWhilePending(): void {
    if (this.pending) {
      throw new ApiError(409, "unsaved", "An earlier change isn't saved yet. Retry or discard it.");
    }
  }

  /**
   * Applies a batch and writes it. `before` changes (asset writes) go first;
   * `undoable: false` answers with no inverse, for changes that can't be undone.
   */
  private async applyNow(
    batch: CommandBatch,
    user: User,
    extra: { before?: DocumentChange[]; undoable?: boolean } = {},
  ): Promise<CommandResult> {
    this.refuseWhilePending();
    const result = applyBatch(this.current, batch, user, { readOnly: this.readOnly });
    if (!result.ok) {
      if (result.error.code === "conflict") {
        const refs = Object.entries(batch.expect ?? {})
          .filter(([key, print]) => (this.current.fingerprint(parseRefKey(key)) ?? null) !== print)
          .map(([key]) => key);
        this.emit({ type: "conflict", world: this.worldId, refs, message: result.error.message });
      }
      const { code, message, path } = result.error;
      throw new ApiError(COMMAND_STATUS[code], code, message, path ? { path } : undefined);
    }

    const refs = refsOf(result.changes);
    const fingerprints = Object.fromEntries(
      refs.map((ref) => [refKey(ref), result.model.fingerprint(ref) ?? null]),
    );
    const outcome: CommandResult = {
      inverse: extra.undoable === false ? { commands: [] } : result.inverse,
      fingerprints,
    };
    const changes = [...(extra.before ?? []), ...result.changes];
    const before = this.current;
    // The model's list of portrait files must follow the app's own writes, or a portrait it just saved is reported missing.
    this.current = result.model.withAssets({
      add: changes.flatMap((c) => (c.op === "putAsset" ? [c.fileName] : [])),
      remove: changes.flatMap((c) => (c.op === "deleteAsset" ? [c.fileName] : [])),
    });
    try {
      await this.writeChanges(changes, before);
    } catch {
      // The change stays in memory, unsaved, until it is retried or discarded (spec §13).
      this.pending = { changes, result: outcome };
      this.changed(before, refs);
      this.emit({
        type: "save-state",
        world: this.worldId,
        unsaved: true,
        message: UNSAVED_MESSAGE,
      });
      throw new ApiError(503, "save-failed", UNSAVED_MESSAGE);
    }
    this.changed(before, refs);
    return outcome;
  }

  /**
   * Writes a batch. An outside change to one of its files seen meanwhile may
   * have landed on disk before or after the app's write; either way the app's
   * write wins, so those files are written again once the batch is done.
   */
  private async writeChanges(changes: DocumentChange[], before: WorldModel): Promise<void> {
    const keys = new Map<string, string>();
    for (const ref of refsOf(changes)) {
      for (const path of [before.path(ref), this.current.path(ref)]) {
        if (path !== undefined) keys.set(path, refKey(ref));
      }
    }
    const writing: Writing = { keys, raced: new Set() };
    this.writing = writing;
    try {
      await this.storage.write(this.worldId, changes);
      if (writing.raced.size > 0) {
        await this.storage.write(
          this.worldId,
          changes.filter(
            (change) =>
              (change.op === "put" || change.op === "delete") &&
              writing.raced.has(refKey(change.ref)),
          ),
        );
      }
    } finally {
      this.writing = null;
    }
  }

  /** True for an outside change to a file the current batch is writing; it is set aside. */
  private racesWrite(change: ExternalChange): boolean {
    if (!this.writing) return false;
    const path = change.type === "upsert" ? change.file.path : change.path;
    const ref =
      change.type === "upsert" ? change.file.ref : change.type === "remove" ? change.ref : null;
    const written = new Set(this.writing.keys.values());
    const key =
      this.writing.keys.get(path) ?? (ref && written.has(refKey(ref)) ? refKey(ref) : null);
    if (key === null) return false;
    this.writing.raced.add(key);
    return true;
  }

  private onExternal(change: ExternalChange): void {
    if (this.pending && this.touchesPending(change)) return; // the unsaved change wins
    const before = this.current;
    if (change.type === "upsert") {
      const { ref, path, data, fingerprint } = change.file;
      this.current = this.current
        .withFiles([{ ref, fileName: basename(path), data, fingerprint }])
        .withValid(path);
      this.changed(before, [ref]);
    } else if (change.type === "remove") {
      this.current = this.current
        .withFiles([{ ref: change.ref, removed: true }])
        .withValid(change.path);
      this.changed(before, [change.ref]);
    } else {
      this.current = this.current.withInvalid(change.path, change.problem);
      this.changed(before, []);
    }
  }

  private touchesPending(change: ExternalChange): boolean {
    const refs = refsOf(this.pending?.changes ?? []);
    const keys = new Set(refs.map(refKey));
    const paths = new Set(refs.map((ref) => this.current.path(ref)));
    if (change.type === "upsert") {
      return paths.has(change.file.path) || keys.has(refKey(change.file.ref));
    }
    if (change.type === "remove") return paths.has(change.path) || keys.has(refKey(change.ref));
    return paths.has(change.path);
  }

  /** Re-indexes search and pushes `changed`, then `problems` if the list changed. */
  private changed(before: WorldModel, refs: FileRef[]): void {
    if (refs.some((ref) => SEARCH_LIBRARIES.has(ref.kind))) {
      this.index = SearchIndex.build(this.current);
    } else {
      const ids = refs.flatMap((ref) => (ref.kind === "character" ? [ref.id] : []));
      if (ids.length > 0) this.index.update(this.current, ids);
    }

    if (refs.length > 0) {
      const files = this.current.files();
      const keys = new Set(refs.map(refKey));
      this.emit({
        type: "changed",
        world: this.worldId,
        files: files.filter((file) => keys.has(refKey(file.ref))),
        removed: [...keys].filter((key) => this.current.data(parseRefKey(key)) === undefined),
      });
    }

    const problems = this.current.problems();
    if (JSON.stringify(problems) !== JSON.stringify(before.problems())) {
      this.emit({ type: "problems", world: this.worldId, problems });
    }
  }

  private emit(message: UnnumberedMessage): void {
    this.seq += 1;
    const numbered: ServerMessage = { ...message, seq: this.seq };
    for (const listener of this.listeners) listener(numbered);
  }
}
