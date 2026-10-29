import { join, posix, win32 } from "node:path";
import type { OptionsFile } from "@dramatis-personae/schema";

export interface DataPaths {
  /** The platform default root, which always holds Config/options.json. */
  defaultRoot: string;
  /** Where Data/, Backups/, Logs/ and Config/workspaces/ live. */
  dataRoot: string;
  optionsFile: string;
  workspacesDir: string;
  /** App-wide interface state, such as the last world opened. */
  appStateFile: string;
  worldsDir: string;
  logsDir: string;
  /** Which setting chose `dataRoot`. */
  source: "flag" | "env" | "options" | "default";
}

export interface PlatformEnv {
  platform: NodeJS.Platform;
  home: string;
  vars: Record<string, string | undefined>;
  dev: boolean;
}

/** The data root when nothing overrides it (spec §2). Dev runs get their own. */
export function defaultDataRoot({ platform, home, vars, dev }: PlatformEnv): string {
  if (platform === "win32") {
    const local = vars.LOCALAPPDATA || win32.join(home, "AppData", "Local");
    return win32.join(local, dev ? "DramatisPersonae-dev" : "DramatisPersonae Data");
  }
  if (platform === "darwin") {
    const name = dev ? "Dramatis Personae Dev" : "Dramatis Personae Data";
    return posix.join(home, "Library", "Application Support", name);
  }
  const share = vars.XDG_DATA_HOME || posix.join(home, ".local", "share");
  return posix.join(share, dev ? "dramatis-personae-dev" : "dramatis-personae");
}

function flagValue(argv: string[], flag: string): string | undefined {
  for (const [i, arg] of argv.entries()) {
    if (arg === flag) return argv[i + 1];
    if (arg.startsWith(`${flag}=`)) return arg.slice(flag.length + 1);
  }
  return undefined;
}

/** Resolves the data root: --data-path, then DRAMATIS_DATA_PATH, then options, then the default. */
export function resolveDataPaths(input: {
  argv: string[];
  vars: Record<string, string | undefined>;
  defaultRoot: string;
  options: OptionsFile;
}): DataPaths {
  const { argv, vars, defaultRoot, options } = input;
  const flag = flagValue(argv, "--data-path");
  const [dataRoot, source]: [string, DataPaths["source"]] = flag
    ? [flag, "flag"]
    : vars.DRAMATIS_DATA_PATH
      ? [vars.DRAMATIS_DATA_PATH, "env"]
      : options.dataPath
        ? [options.dataPath, "options"]
        : [defaultRoot, "default"];
  return {
    defaultRoot,
    dataRoot,
    optionsFile: join(defaultRoot, "Config", "options.json"),
    workspacesDir: join(dataRoot, "Config", "workspaces"),
    appStateFile: join(dataRoot, "Config", "app-state.json"),
    worldsDir: join(dataRoot, "Data", "worlds"),
    logsDir: join(dataRoot, "Logs"),
    source,
  };
}
