import type { BrowserWindowConstructorOptions } from "electron";

/** The app window: no menu bar until Alt is pressed, and a page with no Node access. */
export function mainWindowOptions(): BrowserWindowConstructorOptions {
  return {
    width: 1280,
    height: 800,
    show: false,
    title: "Dramatis Personae",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  };
}

/** The parts of a BrowserWindow that revealWindow uses. */
export interface RevealableWindow {
  isDestroyed(): boolean;
  isMinimized(): boolean;
  restore(): void;
  show(): void;
  focus(): void;
}

/** Brings the window to the front; false when there is no live window to bring. */
export function revealWindow(window: RevealableWindow | undefined): boolean {
  if (!window || window.isDestroyed()) return false;
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
  return true;
}
