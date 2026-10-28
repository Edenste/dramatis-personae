/** The headless server: `pnpm --filter @dramatis-personae/server start -- [options]`. */
import { defaultOpenPath, startServer } from "./start.ts";

async function main(): Promise<void> {
  const server = await startServer({
    argv: process.argv.slice(2),
    version: process.env.npm_package_version ?? "0.0.0",
    openPath: defaultOpenPath,
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
