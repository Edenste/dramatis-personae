/**
 * The Electron main process: starts the local server on a free port of
 * 127.0.0.1 with a per-launch token, then opens a locked-down window on it
 * (spec §12). Bundled into dist/main.cjs by build.mjs.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { BrowserWindow, app, dialog, session, shell } from "electron";
import { startServer, type RunningServer } from "@dramatis-personae/server";
import { mainWindowOptions, revealWindow } from "./window-options.ts";
import { externalUrlToOpen, isAppUrl } from "./window-security.ts";

let server: RunningServer | undefined;
let window: BrowserWindow | undefined;

function createWindow(running: RunningServer): BrowserWindow {
  const win = new BrowserWindow(mainWindowOptions());
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
  });
  window = createWindow(server);
}

if (!app.requestSingleInstanceLock()) {
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

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  let closing = false;
  app.on("before-quit", (event) => {
    if (closing || !server) return;
    closing = true;
    event.preventDefault();
    void server.close().finally(() => app.quit());
  });
}
