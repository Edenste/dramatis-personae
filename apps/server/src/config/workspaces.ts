import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { nodeFileSystem, serialize, writeAtomic } from "@dramatis-personae/core";
import { WorkspaceFileSchema, type WorkspaceFile } from "@dramatis-personae/schema";

const fileFor = (dir: string, worldId: string) => join(dir, `${worldId}.json`);

/** One user's interface state for a world (spec §7); the defaults if there is none yet. */
export async function readWorkspace(dir: string, worldId: string): Promise<WorkspaceFile> {
  try {
    const parsed = WorkspaceFileSchema.safeParse(
      JSON.parse(await readFile(fileFor(dir, worldId), "utf8")),
    );
    if (parsed.success) return parsed.data;
  } catch {
    // Missing or broken: interface state is never worth an error.
  }
  return WorkspaceFileSchema.parse({});
}

export async function writeWorkspace(
  dir: string,
  worldId: string,
  workspace: WorkspaceFile,
): Promise<void> {
  await mkdir(dir, { recursive: true });
  await writeAtomic(nodeFileSystem, fileFor(dir, worldId), serialize(workspace));
}
