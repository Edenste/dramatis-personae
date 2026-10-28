import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";

/** A stand-in for chokidar's watcher, so the test can make it fail. */
class FakeWatcher extends EventEmitter {
  close = () => Promise.resolve();
}
const watchers: FakeWatcher[] = [];

vi.mock("chokidar", () => ({
  watch: () => {
    const watcher = new FakeWatcher();
    watchers.push(watcher);
    return watcher;
  },
}));

const { watchFolder } = await import("./watch.ts");

describe("watchFolder errors", () => {
  it("hands a watcher error to onError instead of throwing", () => {
    const errors: Error[] = [];
    const stop = watchFolder("/world", () => undefined, {
      onError: (error) => errors.push(error),
    });
    const failure = Object.assign(new Error("too many watchers"), { code: "ENOSPC" });
    expect(() => watchers.at(-1)!.emit("error", failure)).not.toThrow();
    expect(errors).toEqual([failure]);
    stop();
  });

  it("never throws on a watcher error, even with no onError", () => {
    const stop = watchFolder("/world", () => undefined);
    expect(() => watchers.at(-1)!.emit("error", new Error("EMFILE"))).not.toThrow();
    stop();
  });
});
