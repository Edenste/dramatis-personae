import { join, posix, win32 } from "node:path";
import { describe, expect, it } from "vitest";
import { OptionsFileSchema } from "@dramatis-personae/schema";
import { defaultDataRoot, resolveDataPaths } from "./data-root.ts";

describe("defaultDataRoot", () => {
  const local = "C:\\Users\\a\\AppData\\Local";

  it("uses %LOCALAPPDATA% on Windows, with a separate folder in dev mode", () => {
    const env = { platform: "win32" as const, home: "C:\\Users\\a", vars: { LOCALAPPDATA: local } };
    expect(defaultDataRoot({ ...env, dev: false })).toBe(
      win32.join(local, "DramatisPersonae Data"),
    );
    expect(defaultDataRoot({ ...env, dev: true })).toBe(win32.join(local, "DramatisPersonae-dev"));
  });

  it("falls back to AppData\\Local under the home folder when LOCALAPPDATA is unset", () => {
    expect(defaultDataRoot({ platform: "win32", home: "C:\\Users\\a", vars: {}, dev: false })).toBe(
      win32.join("C:\\Users\\a", "AppData", "Local", "DramatisPersonae Data"),
    );
  });

  it("uses Application Support on macOS", () => {
    const env = { platform: "darwin" as const, home: "/Users/a", vars: {} };
    expect(defaultDataRoot({ ...env, dev: false })).toBe(
      posix.join("/Users/a", "Library", "Application Support", "Dramatis Personae Data"),
    );
    expect(defaultDataRoot({ ...env, dev: true })).toBe(
      posix.join("/Users/a", "Library", "Application Support", "Dramatis Personae Dev"),
    );
  });

  it("uses XDG_DATA_HOME on Linux, or ~/.local/share", () => {
    expect(defaultDataRoot({ platform: "linux", home: "/home/a", vars: {}, dev: false })).toBe(
      "/home/a/.local/share/dramatis-personae",
    );
    expect(
      defaultDataRoot({
        platform: "linux",
        home: "/home/a",
        vars: { XDG_DATA_HOME: "/data" },
        dev: true,
      }),
    ).toBe("/data/dramatis-personae-dev");
  });
});

describe("resolveDataPaths", () => {
  const defaultRoot = join("default", "root");
  const options = OptionsFileSchema.parse({ dataPath: join("from", "options") });

  it("prefers the flag, then the environment, then options, then the default", () => {
    const flag = resolveDataPaths({
      argv: ["--data-path", join("from", "flag")],
      vars: { DRAMATIS_DATA_PATH: join("from", "env") },
      defaultRoot,
      options,
    });
    expect(flag).toMatchObject({ dataRoot: join("from", "flag"), source: "flag" });

    const env = resolveDataPaths({
      argv: [],
      vars: { DRAMATIS_DATA_PATH: join("from", "env") },
      defaultRoot,
      options,
    });
    expect(env).toMatchObject({ dataRoot: join("from", "env"), source: "env" });

    const fromOptions = resolveDataPaths({ argv: [], vars: {}, defaultRoot, options });
    expect(fromOptions).toMatchObject({ dataRoot: join("from", "options"), source: "options" });

    const fallback = resolveDataPaths({
      argv: [],
      vars: {},
      defaultRoot,
      options: OptionsFileSchema.parse({}),
    });
    expect(fallback).toMatchObject({ dataRoot: defaultRoot, source: "default" });
  });

  it("accepts --data-path=<dir>", () => {
    const paths = resolveDataPaths({
      argv: [`--data-path=${join("from", "flag")}`],
      vars: {},
      defaultRoot,
      options,
    });
    expect(paths.dataRoot).toBe(join("from", "flag"));
  });

  it("keeps options.json under the default root and everything else under the data root", () => {
    const dataRoot = join("from", "flag");
    const paths = resolveDataPaths({
      argv: ["--data-path", dataRoot],
      vars: {},
      defaultRoot,
      options,
    });
    expect(paths).toEqual({
      defaultRoot,
      dataRoot,
      optionsFile: join(defaultRoot, "Config", "options.json"),
      workspacesDir: join(dataRoot, "Config", "workspaces"),
      appStateFile: join(dataRoot, "Config", "app-state.json"),
      worldsDir: join(dataRoot, "Data", "worlds"),
      logsDir: join(dataRoot, "Logs"),
      source: "flag",
    });
  });
});
