import { describe, expect, it } from "vitest";
import { mainWindowOptions, revealWindow, type RevealableWindow } from "./window-options.ts";

function fakeWindow(state: { destroyed?: boolean; minimized?: boolean }) {
  const calls: string[] = [];
  const window: RevealableWindow = {
    isDestroyed: () => state.destroyed ?? false,
    isMinimized: () => state.minimized ?? false,
    restore: () => void calls.push("restore"),
    show: () => void calls.push("show"),
    focus: () => void calls.push("focus"),
  };
  return { window, calls };
}

describe("revealWindow", () => {
  it("restores, shows and focuses a minimised window", () => {
    const { window, calls } = fakeWindow({ minimized: true });
    expect(revealWindow(window)).toBe(true);
    expect(calls).toEqual(["restore", "show", "focus"]);
  });

  it("shows a hidden window before focusing it", () => {
    const { window, calls } = fakeWindow({});
    expect(revealWindow(window)).toBe(true);
    expect(calls).toEqual(["show", "focus"]);
  });

  it("says there is no window to reveal when it is gone or destroyed", () => {
    expect(revealWindow(undefined)).toBe(false);
    const { window, calls } = fakeWindow({ destroyed: true });
    expect(revealWindow(window)).toBe(false);
    expect(calls).toEqual([]);
  });
});

describe("mainWindowOptions", () => {
  it("hides the menu bar until Alt is pressed", () => {
    expect(mainWindowOptions().autoHideMenuBar).toBe(true);
  });

  it("locks down the page", () => {
    expect(mainWindowOptions().webPreferences).toEqual({
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
    });
  });

  it("opens at 1280×800, shown only once ready", () => {
    expect(mainWindowOptions()).toMatchObject({ width: 1280, height: 800, show: false });
  });
});
