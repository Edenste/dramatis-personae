import { describe, expect, it } from "vitest";
import { mainWindowOptions } from "./window-options.ts";

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
