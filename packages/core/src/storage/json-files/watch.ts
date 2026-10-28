import { basename } from "node:path";
import { watch } from "chokidar";
import { isTempFile } from "./paths.ts";

/** Quiet period per path, so an editor's delete-then-recreate counts as one change. */
export const WATCH_DEBOUNCE_MS = 150;

/**
 * Watches a world folder and calls `onSettled` with an absolute path once that
 * path has been quiet for WATCH_DEBOUNCE_MS, and `onReady` once the first scan
 * is done (changes before that can be missed). Returns a function that stops it.
 */
export function watchFolder(
  root: string,
  onSettled: (path: string) => void,
  onReady?: () => void,
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
  if (onReady) watcher.once("ready", onReady);

  return () => {
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();
    void watcher.close();
  };
}
