import { describe, expect, it } from "vitest";
import {
  chromeColors,
  mainWindowOptions,
  revealWindow,
  type RevealableWindow,
} from "./window-options.ts";

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

const light = { platform: "win32", dark: false } as const;

describe("chromeColors", () => {
  it("matches the app's frame and secondary text in each theme", () => {
    expect(chromeColors(false)).toEqual({ frame: "#E9E9EB", symbol: "#636366" });
    expect(chromeColors(true)).toEqual({ frame: "#2C2C2E", symbol: "#98989D" });
  });
});

describe("mainWindowOptions", () => {
  it("hides the menu bar until Alt is pressed", () => {
    expect(mainWindowOptions(light).autoHideMenuBar).toBe(true);
  });

  it("locks down the page", () => {
    expect(mainWindowOptions(light).webPreferences).toEqual({
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
    });
  });

  it("opens at 1280×800, shown only once ready", () => {
    expect(mainWindowOptions(light)).toMatchObject({ width: 1280, height: 800, show: false });
  });

  it("puts the tabs in the title bar and draws the Windows buttons in the app's colours", () => {
    const options = mainWindowOptions(light);
    expect(options.titleBarStyle).toBe("hidden");
    expect(options.backgroundColor).toBe("#E9E9EB");
    expect(options.titleBarOverlay).toEqual({
      color: "#E9E9EB",
      symbolColor: "#636366",
      height: 38,
    });
  });

  it("keeps the macOS buttons centred in the bar, with no overlay", () => {
    const options = mainWindowOptions({ platform: "darwin", dark: true });
    expect(options.trafficLightPosition).toEqual({ x: 14, y: 12 });
    expect(options.titleBarOverlay).toBeUndefined();
    expect(options.backgroundColor).toBe("#2C2C2E");
  });
});
