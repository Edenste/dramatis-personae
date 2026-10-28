import { copyFile, mkdir, readFile, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { nodeFileSystem, serialize, writeAtomic } from "@dramatis-personae/core";
import { OptionsFileSchema, type OptionsFile } from "@dramatis-personae/schema";
import type { DataPaths } from "./data-root.ts";

/**
 * Reads Config/options.json. A missing or unreadable file gives the defaults,
 * so a bad edit can never stop the app from starting. A bad value drops only
 * its own field, so one typo can't lose the data path. `onProblem` hears why.
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
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    onProblem?.(`${file} isn't valid JSON: ${(error as Error).message}`);
    return OptionsFileSchema.parse({});
  }
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    onProblem?.(`${file} should hold a JSON object`);
    return OptionsFileSchema.parse({});
  }
  const parsed = OptionsFileSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  const cleaned = { ...(raw as Record<string, unknown>) };
  for (const issue of parsed.error.issues) {
    const key = String(issue.path[0] ?? "");
    onProblem?.(`${file}: ${key || "(file)"} is invalid (${issue.message}); using the default`);
    delete cleaned[key];
  }
  return OptionsFileSchema.safeParse(cleaned).data ?? OptionsFileSchema.parse({});
}

/** Writes options.json. A file there that isn't valid JSON is copied aside first, never lost. */
export async function writeOptions(file: string, options: OptionsFile): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  const existing = await readFile(file, "utf8").catch(() => null);
  if (existing !== null) {
    try {
      JSON.parse(existing);
    } catch {
      await copyFile(file, `${file}.broken-${Date.now()}`);
    }
  }
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
