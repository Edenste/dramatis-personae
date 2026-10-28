/**
 * Writes the server's OpenAPI spec to packages/api-client/openapi.json, which
 * the typed client is generated from. CI checks the committed copy is current.
 */
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { OptionsFileSchema } from "@dramatis-personae/schema";
import { buildServer } from "../src/app.ts";
import { resolveDataPaths } from "../src/config/data-root.ts";

const OUTPUT = fileURLToPath(new URL("../../../packages/api-client/openapi.json", import.meta.url));

/** Object keys in sorted order at every level, so the file only changes when the API does. */
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortKeys((value as Record<string, unknown>)[key])]),
  );
}

const root = await mkdtemp(join(tmpdir(), "dp-openapi-"));
try {
  const options = OptionsFileSchema.parse({});
  const app = await buildServer({
    paths: resolveDataPaths({ argv: [], vars: {}, defaultRoot: root, options }),
    options,
    token: "openapi",
    version: "0.0.0",
  });
  await app.ready();
  await writeFile(OUTPUT, JSON.stringify(sortKeys(app.swagger()), null, 2) + "\n");
  await app.close();
  console.log(`Wrote ${OUTPUT}`);
} finally {
  await rm(root, { recursive: true, force: true });
}
