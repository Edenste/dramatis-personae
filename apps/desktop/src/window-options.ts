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
