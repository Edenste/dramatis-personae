import type { FileRef } from "@dramatis-personae/schema";
import { WorldModel } from "../model/world-model.ts";
import { JsonFileStorage } from "../storage/json-files/json-file-storage.ts";
import { copyCamelot } from "./temp-world.ts";

/** The Camelot sample world as a WorldModel, loaded from a temporary copy. */
export async function loadCamelotModel(): Promise<WorldModel> {
  const camelot = await copyCamelot();
  try {
    const storage = new JsonFileStorage({ dataRoot: camelot.dataRoot });
    return WorldModel.fromLoaded(await storage.loadWorld(camelot.worldId));
  } finally {
    await camelot.cleanup();
  }
}

/** Returns a model with one file's data changed by `edit` (applied to a deep copy). */
export function editFile(
  model: WorldModel,
  ref: FileRef,
  edit: (data: Record<string, unknown>) => void,
): WorldModel {
  const current = "id" in ref ? model.get(ref.kind, ref.id) : model.library(ref.kind as never);
  const data = structuredClone(current ?? (ref.kind === "world" ? model.world : {})) as Record<
    string,
    unknown
  >;
  edit(data);
  const fileName = model.fileName(ref) ?? `${"id" in ref ? ref.id : ref.kind}.json`;
  return model.withFiles([{ ref, fileName, data, fingerprint: "edited" }]);
}
