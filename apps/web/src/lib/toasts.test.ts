import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Toasts } from "./toasts.svelte.ts";

describe("toasts", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("shows one message at a time and clears it after 4 seconds", () => {
    const toasts = new Toasts();
    toasts.show("Can't undo: it was changed outside the app since.");
    expect(toasts.current?.message).toContain("Can't undo");
    vi.advanceTimersByTime(2000);
    toasts.show("Renamed");
    expect(toasts.current?.message).toBe("Renamed");
    vi.advanceTimersByTime(3999);
    expect(toasts.current?.message).toBe("Renamed");
    vi.advanceTimersByTime(1);
    expect(toasts.current).toBeNull();
  });
});
