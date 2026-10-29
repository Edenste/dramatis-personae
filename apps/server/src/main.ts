/** The headless server: `pnpm --filter @dramatis-personae/server start -- [options]`. */
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArgs } from "./cli.ts";
import { defaultOpenPath, startServer } from "./start.ts";

/** The web app built in this repository, served when no --web-root is given. */
const builtWeb = fileURLToPath(new URL("../../web/dist", import.meta.url));

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const webRoot = parseArgs(argv).webRoot ?? (existsSync(builtWeb) ? builtWeb : undefined);
  const server = await startServer({
    argv,
    version: process.env.npm_package_version ?? "0.0.0",
    openPath: defaultOpenPath,
    ...(webRoot ? { webRoot } : {}),
  });
  console.log(`Dramatis Personae is running. Open: ${server.launchUrl}`);
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      void server.close().then(() => process.exit(0));
    });
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
