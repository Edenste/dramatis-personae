import { basename, dirname, join } from "node:path";
import { generateId } from "@dramatis-personae/schema";
import { StorageError } from "../errors.ts";
import { errorCode, type FileSystem } from "../fs.ts";

/** Waits between retries of a locked file: about 1.5 s in all. */
export const LOCK_RETRY_DELAYS = [50, 100, 200, 400, 800] as const;
const LOCK_CODES = new Set(["EPERM", "EBUSY", "EACCES"]);

export type Sleep = (ms: number) => Promise<void>;

/**
 * Runs `operation`, retrying while the file is locked (Windows antivirus or an
 * open editor), then fails with a `locked` StorageError.
 */
export async function withLockRetry<T>(
  path: string,
  sleep: Sleep,
  operation: () => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const delay = LOCK_RETRY_DELAYS[attempt];
      if (!LOCK_CODES.has(errorCode(error) ?? "")) throw error;
      if (delay === undefined) {
        throw new StorageError("locked", path, `${path} is locked by another program`, {
          cause: error,
        });
      }
      await sleep(delay);
    }
  }
}

function asStorageError(path: string, error: unknown): StorageError {
  if (error instanceof StorageError) return error;
  const reason = error instanceof Error ? error.message : String(error);
  return new StorageError("io", path, `Couldn't write ${path}: ${reason}`, { cause: error });
}

/**
 * Writes `data` to `.<name>.<random>.tmp` beside `path`, then renames it over
 * `path`, so a crash never leaves a half-written file.
 */
export async function writeAtomic(
  fs: FileSystem,
  path: string,
  data: string | Uint8Array,
  sleep: Sleep = () => Promise.resolve(),
): Promise<void> {
  const temp = join(dirname(path), `.${basename(path)}.${generateId().slice(0, 8)}.tmp`);
  try {
    await fs.writeFile(temp, data);
    await withLockRetry(path, sleep, () => fs.rename(temp, path));
  } catch (error) {
    await fs.unlink(temp).catch(() => undefined);
    throw asStorageError(path, error);
  }
}

export async function removeFile(fs: FileSystem, path: string, sleep: Sleep): Promise<void> {
  try {
    await withLockRetry(path, sleep, () => fs.unlink(path));
  } catch (error) {
    if (errorCode(error) === "ENOENT") return;
    throw asStorageError(path, error);
  }
}

/** Runs operations on the same path one after another, in the order they were queued. */
export class PathQueue {
  private readonly tails = new Map<string, Promise<unknown>>();

  run<T>(path: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(path) ?? Promise.resolve();
    const next = previous.then(operation, operation);
    const tail = next.catch(() => undefined);
    this.tails.set(path, tail);
    void tail.then(() => {
      if (this.tails.get(path) === tail) this.tails.delete(path);
    });
    return next;
  }
}
