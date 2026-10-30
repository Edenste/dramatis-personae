// Bundles the main process, the server and everything they use into one
// CommonJS file, so the packaged app needs no node_modules.
import { cp, readFile, realpath, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

/** Native modules stay out of the bundle and ship beside it in dist/node_modules. */
const NATIVE = ["sharp"];

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
  external: ["electron", ...NATIVE],
  sourcemap: true,
  logLevel: "info",
});

/**
 * Copies a package and what it needs at run time into dist/node_modules. Under
 * pnpm a package's dependencies are siblings of its real folder; optional ones
 * (sharp's per-platform binaries) are copied only if installed for this machine.
 */
async function copyPackage(name, modulesDir, copied = new Set()) {
  const source = join(modulesDir, name);
  if (copied.has(name) || !existsSync(source)) return;
  copied.add(name);
  const real = await realpath(source);
  await cp(real, join("dist", "node_modules", name), { recursive: true, dereference: true });
  const meta = JSON.parse(await readFile(join(real, "package.json"), "utf8"));
  const siblings = join(real, ...name.split("/").map(() => ".."));
  for (const dependency of Object.keys({ ...meta.dependencies, ...meta.optionalDependencies })) {
    await copyPackage(dependency, siblings, copied);
  }
}

await rm("dist/node_modules", { recursive: true, force: true });
const here = dirname(fileURLToPath(import.meta.url));
for (const name of NATIVE) await copyPackage(name, join(here, "node_modules"));

// The server serves the web app from dist/web, next to the bundle.
await rm("dist/web", { recursive: true, force: true });
await cp(web, new URL("dist/web/", import.meta.url), { recursive: true });
