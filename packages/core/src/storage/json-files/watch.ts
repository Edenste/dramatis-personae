import { basename } from "node:path";
import { watch } from "chokidar";
import type { WatchEvents } from "../types.ts";
import { isTempFile } from "./paths.ts";

/** Quiet period per path, so an editor's delete-then-recreate counts as one change. */
export const WATCH_DEBOUNCE_MS = 150;

/**
 * Watches a world folder and calls `onSettled` with an absolute path once that
 * path has been quiet for WATCH_DEBOUNCE_MS. `events.onReady` fires once the
 * first scan is done; `events.onError` hears of failures, which never throw.
 * Returns a function that stops it.
 */
export function watchFolder(
  root: string,
  onSettled: (path: string) => void,
  events: WatchEvents = {},
): () => void {
  const timers = new Map<string, NodeJS.Timeout>();
  const watcher = watch(root, {
    ignoreInitial: true,
    ignored: (path, stats) => {
      const name = basename(path);
      if (isTempFile(name)) return true;
      return stats?.isFile() === true && !name.endsWith(".json");
    },
  });

  const schedule = (path: string) => {
    clearTimeout(timers.get(path));
    timers.set(
      path,
      setTimeout(() => {
        timers.delete(path);
        onSettled(path);
      }, WATCH_DEBOUNCE_MS),
    );
  };
  watcher.on("add", schedule).on("change", schedule).on("unlink", schedule);
  if (events.onReady) watcher.once("ready", events.onReady);
  // Without a listener, an "error" event would throw and stop the whole process.
  watcher.on("error", (error: unknown) => {
    events.onError?.(error instanceof Error ? error : new Error(String(error)));
  });

  return () => {
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();
    void watcher.close();
  };
}
