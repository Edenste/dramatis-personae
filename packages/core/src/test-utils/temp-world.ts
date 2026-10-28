import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { CAMELOT_IDS, CAMELOT_PATH } from "@dramatis-personae/samples";

export interface TempDataRoot {
  dataRoot: string;
  cleanup: () => Promise<void>;
}

export async function tempDataRoot(): Promise<TempDataRoot> {
  const dataRoot = await mkdtemp(join(tmpdir(), "dp-test-"));
  return { dataRoot, cleanup: () => rm(dataRoot, { recursive: true, force: true }) };
}

export interface TempCamelot extends TempDataRoot {
  worldId: string;
  /** Absolute path to the copied world folder. */
  worldPath: string;
}

/** A fresh copy of the Camelot sample world inside a temporary data root. */
export async function copyCamelot(): Promise<TempCamelot> {
  const root = await tempDataRoot();
  const worldPath = join(root.dataRoot, "Data", "worlds", basename(CAMELOT_PATH));
  await cp(CAMELOT_PATH, worldPath, { recursive: true });
  return { ...root, worldId: CAMELOT_IDS.world, worldPath };
}
