// Bundles the main process, the server and everything they use into one
// CommonJS file, so the packaged app needs no node_modules.
import { cp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { build } from "esbuild";

const web = new URL("../web/dist/", import.meta.url);
if (!existsSync(new URL("index.html", web))) {
  throw new Error("Build the web app first: pnpm --filter @dramatis-personae/web build");
}

await build({
  entryPoints: ["src/main.ts"],
  outfile: "dist/main.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  external: ["electron"],
  sourcemap: true,
  logLevel: "info",
});

// The server serves the web app from dist/web, next to the bundle.
await rm("dist/web", { recursive: true, force: true });
await cp(web, new URL("dist/web/", import.meta.url), { recursive: true });
