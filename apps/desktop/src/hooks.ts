import { dirname } from "node:path";
import { BrowserWindow, app, dialog, nativeTheme, type OpenDialogOptions } from "electron";
import type { DesktopHooks } from "@dramatis-personae/server";
import { TITLE_BAR_HEIGHT, chromeColors } from "./window-options.ts";

/** Recolours a window to the current theme: its background and, off macOS, its window buttons. */
export function themeWindow(win: BrowserWindow): void {
  const { frame, symbol } = chromeColors(nativeTheme.shouldUseDarkColors);
  win.setBackgroundColor(frame);
  if (process.platform !== "darwin") {
    win.setTitleBarOverlay({ color: frame, symbolColor: symbol, height: TITLE_BAR_HEIGHT });
  }
}

/**
 * The folder the installer owns: Squirrel's %LOCALAPPDATA%\<app> (the executable sits in
 * its app-x.y.z folder), or the macOS app bundle. Unpackaged runs have none.
 */
function installFolder(): string | undefined {
  if (!app.isPackaged) return undefined;
  if (process.platform === "win32") return dirname(dirname(process.execPath));
  if (process.platform === "darwin") return dirname(dirname(dirname(process.execPath)));
  return undefined;
}

/** What the desktop app gives the in-process server (design spec §9). */
export function createDesktopHooks(getWindow: () => BrowserWindow | undefined): DesktopHooks {
  nativeTheme.on("updated", () => {
    for (const win of BrowserWindow.getAllWindows()) themeWindow(win);
  });
  return {
    installDir: installFolder(),
    windowControls: process.platform === "darwin" ? "left" : "right",
    chooseFolder: async () => {
      const options: OpenDialogOptions = { properties: ["openDirectory", "createDirectory"] };
      const win = getWindow();
      const result = win
        ? await dialog.showOpenDialog(win, options)
        : await dialog.showOpenDialog(options);
      return result.canceled ? null : (result.filePaths[0] ?? null);
    },
    restart: () => {
      app.relaunch();
      app.quit();
    },
    appearanceChanged: (theme) => {
      nativeTheme.themeSource = theme;
    },
  };
}
