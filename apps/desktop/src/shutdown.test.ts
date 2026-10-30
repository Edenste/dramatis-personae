import { describe, expect, it } from "vitest";
import { shutDown, type ClosableWindow } from "./shutdown.ts";

function fakeWindow(log: string[], name: string, closes = true): ClosableWindow {
  let onClosed: (() => void) | undefined;
  return {
    isDestroyed: () => false,
    once: (_event, callback) => void (onClosed = callback),
    close: () => {
      log.push(`close ${name}`);
      if (closes) setTimeout(() => onClosed?.(), 1);
    },
  };
}

describe("shutDown", () => {
  it("closes the windows, so pages can save, before the server stops", async () => {
    const log: string[] = [];
    await shutDown({
      windows: [fakeWindow(log, "a"), fakeWindow(log, "b")],
      closeServer: () => {
        log.push("close server");
        return Promise.resolve();
      },
      graceMs: 5,
    });
    expect(log).toEqual(["close a", "close b", "close server"]);
  });

  it("still stops the server when a window won't close", async () => {
    const log: string[] = [];
    await shutDown({
      windows: [fakeWindow(log, "stuck", false)],
      closeServer: () => {
        log.push("close server");
        return Promise.resolve();
      },
      windowTimeoutMs: 20,
      graceMs: 5,
    });
    expect(log).toEqual(["close stuck", "close server"]);
  });

  it("waits a moment after the windows close, for their last save to arrive", async () => {
    const started = Date.now();
    let serverClosedAt = 0;
    await shutDown({
      windows: [],
      closeServer: () => {
        serverClosedAt = Date.now();
        return Promise.resolve();
      },
      graceMs: 60,
    });
    expect(serverClosedAt - started).toBeGreaterThanOrEqual(55);
  });

  it("skips windows that are already gone", async () => {
    const log: string[] = [];
    const gone: ClosableWindow = { ...fakeWindow(log, "gone"), isDestroyed: () => true };
    await shutDown({ windows: [gone], closeServer: () => Promise.resolve(), graceMs: 1 });
    expect(log).toEqual([]);
  });
});
