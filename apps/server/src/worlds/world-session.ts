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
  type CommandBatch,
  type CommandResult,
  type FileRef,
  type FixRequest,
  type ServerMessage,
  type WorldSnapshot,
  type WorldSummary,
} from "@dramatis-personae/schema";
import { ApiError } from "../http/errors.ts";
import { SerialQueue } from "./serial-queue.ts";

const UNSAVED_MESSAGE =
  "Couldn't save your change. It's kept in the app; retry when the file is free.";

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
 * Known limitation: an app write landing inside the watcher's debounce window
 * can overwrite an outside edit made a moment earlier. That is treated like a
 * simultaneous edit, and the app's write wins.
 */
export class WorldSession {
  private current: WorldModel;
  private index: SearchIndex;
  private pending: Pending | null = null;
  private readonly queue = new SerialQueue();
  private readonly listeners = new Set<(message: ServerMessage) => void>();
  private stopWatching: () => void = () => undefined;

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
    options?: OpenWorldOptions,
  ): Promise<WorldSession> {
    const { model, readOnly } = await openWorld(storage, worldId, options);
    const session = new WorldSession(storage, worldId, model, readOnly);
    // The world counts as open once outside edits are being seen.
    await new Promise<void>((ready) => {
      session.stopWatching = storage.watch(
        worldId,
        (change) => {
          void session.queue.run(() => Promise.resolve(session.onExternal(change)));
        },
        ready,
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
        await this.storage.write(this.worldId, pending.changes);
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

  private async applyNow(batch: CommandBatch, user: User): Promise<CommandResult> {
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
    const outcome: CommandResult = { inverse: result.inverse, fingerprints };
    const before = this.current;
    this.current = result.model;
    try {
      await this.storage.write(this.worldId, result.changes);
    } catch {
      // The change stays in memory, unsaved, until it is retried or discarded (spec §13).
      this.pending = { changes: result.changes, result: outcome };
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

  private emit(message: ServerMessage): void {
    for (const listener of this.listeners) listener(message);
  }
}
