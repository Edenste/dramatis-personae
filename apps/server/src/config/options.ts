import { mkdir, readFile, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { nodeFileSystem, serialize, writeAtomic } from "@dramatis-personae/core";
import { OptionsFileSchema, type OptionsFile } from "@dramatis-personae/schema";
import type { DataPaths } from "./data-root.ts";

/**
 * Reads Config/options.json. A missing or broken file gives the defaults, so a
 * bad edit can never stop the app from starting; `onProblem` hears about it.
 */
export async function readOptions(
  file: string,
  onProblem?: (message: string) => void,
): Promise<OptionsFile> {
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch {
    return OptionsFileSchema.parse({});
  }
  try {
    const parsed = OptionsFileSchema.safeParse(JSON.parse(text));
    if (parsed.success) return parsed.data;
    onProblem?.(`${file} is invalid: ${parsed.error.issues[0]?.message ?? "unknown error"}`);
  } catch (error) {
    onProblem?.(`${file} isn't valid JSON: ${(error as Error).message}`);
  }
  return OptionsFileSchema.parse({});
}

export async function writeOptions(file: string, options: OptionsFile): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  await writeAtomic(nodeFileSystem, file, serialize(options));
}

/** Creates the data root's folders and proves a file can be written there. */
export async function checkWritable(
  paths: DataPaths,
): Promise<{ writable: true } | { writable: false; problem: string }> {
  try {
    for (const dir of [paths.worldsDir, join(paths.dataRoot, "Backups"), paths.logsDir]) {
      await mkdir(dir, { recursive: true });
    }
    await mkdir(paths.workspacesDir, { recursive: true });
    const probe = join(paths.dataRoot, "Config", ".write-test");
    await writeAtomic(nodeFileSystem, probe, "ok");
    await unlink(probe);
    return { writable: true };
  } catch (error) {
    const reason = (error as NodeJS.ErrnoException).code ?? (error as Error).message;
    return {
      writable: false,
      problem: `The data folder ${paths.dataRoot} can't be written to (${reason}).`,
    };
  }
}
