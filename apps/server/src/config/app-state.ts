import { mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { nodeFileSystem, serialize, writeAtomic } from "@dramatis-personae/core";
import { AppStateFileSchema, type AppStateFile } from "@dramatis-personae/schema";

/** App-wide interface state; the defaults if there is none yet or the file is broken. */
export async function readAppState(file: string): Promise<AppStateFile> {
  try {
    const parsed = AppStateFileSchema.safeParse(JSON.parse(await readFile(file, "utf8")));
    if (parsed.success) return parsed.data;
  } catch {
    // Missing or broken: interface state is never worth an error.
  }
  return AppStateFileSchema.parse({});
}

export async function writeAppState(file: string, state: AppStateFile): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  await writeAtomic(nodeFileSystem, file, serialize(state));
}
