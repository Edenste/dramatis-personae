import { OptionsFileSchema } from "@dramatis-personae/schema";
import { tempDataRoot, type TempDataRoot } from "@dramatis-personae/core/testing";
import { buildServer, type ServerOptions } from "../app.ts";
import { resolveDataPaths, type DataPaths } from "../config/data-root.ts";

export const TOKEN = "t".repeat(43);
export const HOST = "127.0.0.1:30300";
/** Headers a trusted client sends. */
export const AUTH = { host: HOST, authorization: `Bearer ${TOKEN}` };

export interface TestServer {
  app: Awaited<ReturnType<typeof buildServer>>;
  paths: DataPaths;
  temp: TempDataRoot;
  close: () => Promise<void>;
}

/** Paths for a data root inside `temp`, with options.json under its own default root. */
export function testPaths(temp: TempDataRoot, dataRoot = temp.dataRoot): DataPaths {
  return resolveDataPaths({
    argv: ["--data-path", dataRoot],
    vars: {},
    defaultRoot: temp.dataRoot,
    options: OptionsFileSchema.parse({}),
  });
}

/** A server on a temporary data root (or the given one), not listening. */
export async function testServer(
  overrides: Partial<ServerOptions> & { temp?: TempDataRoot } = {},
): Promise<TestServer> {
  const { temp: given, ...rest } = overrides;
  const temp = given ?? (await tempDataRoot());
  const paths = rest.paths ?? testPaths(temp);
  const app = await buildServer({
    paths,
    options: OptionsFileSchema.parse({}),
    token: TOKEN,
    version: "0.0.0-test",
    allowedHosts: [HOST, "localhost:30300"],
    ...rest,
  });
  return {
    app,
    paths,
    temp,
    close: async () => {
      await app.close();
      await temp.cleanup();
    },
  };
}
