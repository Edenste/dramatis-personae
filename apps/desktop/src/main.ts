/**
 * The Electron main process: starts the local server on a free port of
 * 127.0.0.1 with a per-launch token, then opens a locked-down window on it
 * (spec §12). Bundled into dist/main.cjs by build.mjs.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { BrowserWindow, app, dialog, nativeTheme, session, shell } from "electron";
import squirrelStartup from "electron-squirrel-startup";
import { startServer, type RunningServer } from "@dramatis-personae/server";
import { createDesktopHooks, themeWindow } from "./hooks.ts";
import { shutDown } from "./shutdown.ts";
import { mainWindowOptions, revealWindow } from "./window-options.ts";
import { externalUrlToOpen, isAppUrl } from "./window-security.ts";

let server: RunningServer | undefined;
let window: BrowserWindow | undefined;

function createWindow(running: RunningServer): BrowserWindow {
  const win = new BrowserWindow(
    mainWindowOptions({ platform: process.platform, dark: nativeTheme.shouldUseDarkColors }),
  );
  win.once("ready-to-show", () => win.show());
  win.on("closed", () => {
    if (window === win) window = undefined;
  });

  const guard = (event: { preventDefault(): void }, url: string) => {
    if (!isAppUrl(url, running.url)) event.preventDefault();
  };
  win.webContents.on("will-navigate", guard);
  win.webContents.on("will-redirect", guard);
  win.webContents.setWindowOpenHandler(({ url }) => {
    const external = externalUrlToOpen(url, running.url);
    if (external) void shell.openExternal(external);
    return { action: "deny" };
  });

  void win.loadURL(running.launchUrl);
  return win;
}

async function launch(): Promise<void> {
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) =>
    callback(false),
  );
  const webRoot = join(__dirname, "web");
  server = await startServer({
    argv: app.isPackaged ? [] : ["--dev"],
    port: 0,
    host: "127.0.0.1",
    ...(existsSync(webRoot) ? { webRoot } : {}),
    openPath: async (path) => {
      const error = await shell.openPath(path);
      if (error) throw new Error(error);
    },
    version: app.getVersion(),
    desktop: createDesktopHooks(() => window),
  });
  nativeTheme.themeSource = server.options.theme;
  window = createWindow(server);
  themeWindow(window);
}

// Squirrel runs the app with install, update and uninstall flags; handle them and leave.
if (squirrelStartup || !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  // A second launch, or a click on the macOS Dock icon, shows the window,
  // opening a new one if it was closed (macOS keeps the app running then).
  const reveal = () => {
    if (!revealWindow(window) && server) window = createWindow(server);
  };
  app.on("second-instance", reveal);
  app.on("activate", reveal);

  app
    .whenReady()
    .then(launch)
    .catch((error: unknown) => {
      dialog.showErrorBox(
        "Dramatis Personae couldn't start",
        error instanceof Error ? error.message : String(error),
      );
      app.quit();
    });

  // Quitting closes the windows before the server, so their last save still arrives.
  let closing = false;
  app.on("window-all-closed", () => {
    if (!closing && process.platform !== "darwin") app.quit();
  });

  app.on("before-quit", (event) => {
    if (closing || !server) return;
    closing = true;
    event.preventDefault();
    const running = server;
    void shutDown({
      windows: BrowserWindow.getAllWindows(),
      closeServer: () => running.close(),
    }).finally(() => app.quit());
  });
}
