import type { BrowserWindowConstructorOptions } from "electron";

/** The title bar's frame colour and its window-button colour in each theme (design spec §5). */
export function chromeColors(dark: boolean): { frame: string; symbol: string } {
  return dark ? { frame: "#2C2C2E", symbol: "#98989D" } : { frame: "#E9E9EB", symbol: "#636366" };
}

/** Height of the app's title bar, which the Windows buttons are drawn to match. */
export const TITLE_BAR_HEIGHT = 38;

/**
 * The app window: the tabs sit in its title bar, so the system's title bar is
 * hidden. Windows and Linux draw their buttons over the app's bar in its colours;
 * macOS keeps its traffic lights, centred in the bar. No menu bar until Alt is
 * pressed, and a page with no Node access.
 */
export function mainWindowOptions(input: {
  platform: NodeJS.Platform;
  dark: boolean;
}): BrowserWindowConstructorOptions {
  const { frame, symbol } = chromeColors(input.dark);
  return {
    width: 1280,
    height: 800,
    show: false,
    title: "Dramatis Personae",
    autoHideMenuBar: true,
    backgroundColor: frame,
    titleBarStyle: "hidden",
    ...(input.platform === "darwin"
      ? { trafficLightPosition: { x: 14, y: 12 } }
      : { titleBarOverlay: { color: frame, symbolColor: symbol, height: TITLE_BAR_HEIGHT } }),
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
