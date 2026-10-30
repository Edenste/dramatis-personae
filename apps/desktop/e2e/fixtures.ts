import { type ChildProcess, spawn } from "node:child_process";
import { cp, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  _electron,
  test as base,
  expect,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import { CAMELOT_IDS, CAMELOT_PATH } from "@dramatis-personae/samples";

export { expect };
export type Target = "browser" | "electron";

const desktopDir = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = join(desktopDir, "..", "..");

/** A running copy of the app on its own temporary data folder. */
export interface AppHandle {
  /** The current window; replaced by relaunch(). */
  readonly page: Page;
  /** The temporary data root, holding Data/worlds/<the Camelot copy>. */
  dataRoot: string;
  /** The Camelot copy. */
  worldDir: string;
  worldId: string;
  /** Calls the app's API from the page, with the page's own credentials. */
  api: (path: string, init?: { method?: string; body?: unknown }) => Promise<unknown>;
  /** Quits the app cleanly, then starts it again on the same data folder. */
  relaunch(): Promise<void>;
}

/** The page's own fetch, so the call carries the token cookie like the app's own. */
async function callApi(page: Page, path: string, init: { method?: string; body?: unknown } = {}) {
  return page.evaluate(
    async ([url, method, body]) => {
      const response = await fetch(url as string, {
        method: method as string,
        headers: { "content-type": "application/json" },
        ...(body === undefined ? {} : { body: body }),
      });
      return response.status === 204 ? null : ((await response.json()) as unknown);
    },
    [path, init.method ?? "GET", init.body === undefined ? undefined : JSON.stringify(init.body)],
  );
}

/** Starts the headless server on a free port; resolves with its process and launch link. */
function startServer(env: NodeJS.ProcessEnv): Promise<{ child: ChildProcess; url: string }> {
  return new Promise((resolve, reject) => {
    // One process, so killing it leaves nothing behind (tsx's own launcher would orphan a child on Windows).
    const child = spawn(
      process.execPath,
      [
        "--import",
        "tsx",
        "apps/server/src/main.ts",
        "--port",
        "0",
        "--web-root",
        join(desktopDir, "dist", "web"),
      ],
      { cwd: repoRoot, env, stdio: ["ignore", "pipe", "pipe"] },
    );
    let output = "";
    const fail = (message: string) => reject(new Error(`${message}\n${output}`));
    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
      const url = /Open: (\S+)/.exec(output)?.[1];
      if (url) resolve({ child, url });
    });
    child.stderr.on("data", (chunk: Buffer) => (output += chunk.toString()));
    child.once("exit", (code) => fail(`The server exited with code ${code} before it was ready`));
  });
}

const stop = (child: ChildProcess) =>
  new Promise<void>((done) => {
    if (child.exitCode !== null) return done();
    child.once("exit", () => done());
    child.kill();
  });

export const test = base.extend<{ target: Target; app: AppHandle }>({
  target: ["browser", { option: true }],

  app: async ({ target, context }, use) => {
    const tmp = await mkdtemp(join(tmpdir(), "dp-e2e-"));
    const home = join(tmp, "home");
    const dataRoot = join(tmp, "root");
    const worldDir = join(dataRoot, "Data", "worlds", basename(CAMELOT_PATH));
    await mkdir(home, { recursive: true });
    await cp(CAMELOT_PATH, worldDir, { recursive: true });
    // options.json lives under the platform default root, so point each platform's at the temp home too.
    // (Not USERPROFILE: Electron crashes at start-up without its real one.)
    const env = {
      ...process.env,
      HOME: home,
      LOCALAPPDATA: home,
      XDG_DATA_HOME: home,
      DRAMATIS_DATA_PATH: dataRoot,
    };

    let page: Page;
    let server: ChildProcess | undefined;
    let electron: ElectronApplication | undefined;

    async function launch(): Promise<void> {
      if (target === "browser") {
        const started = await startServer(env);
        server = started.child;
        page = await context.newPage();
        await page.goto(started.url);
      } else {
        electron = await _electron.launch({
          args: [join(desktopDir, "dist", "main.cjs")],
          cwd: desktopDir,
          env: env,
        });
        page = await electron.firstWindow();
      }
      await page.waitForLoadState("domcontentloaded");
    }

    async function quit(): Promise<void> {
      if (target === "browser") {
        // Closing the page is what makes it save its tabs and cards (pagehide).
        await page.close({ runBeforeUnload: true });
        await new Promise((resolve) => setTimeout(resolve, 200));
        if (server) await stop(server);
      } else {
        await electron?.close();
      }
    }

    await launch();
    await use({
      get page() {
        return page;
      },
      dataRoot,
      worldDir,
      worldId: CAMELOT_IDS.world,
      api: (path, init) => callApi(page, path, init),
      relaunch: async () => {
        await quit();
        await launch();
      },
    });
    await quit().catch(() => undefined);
    await rm(tmp, { recursive: true, force: true });
  },
});
