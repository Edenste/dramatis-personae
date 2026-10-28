import { refKey, type FileRef } from "@dramatis-personae/schema";
import { crossFileProblems } from "./model/validate.ts";
import type { WorldModel } from "./model/world-model.ts";

export interface ReferenceFix {
  ref: FileRef;
  fileName: string | null;
  data: Record<string, unknown>;
}

const keep = (list: unknown, exists: ReadonlySet<string>): string[] =>
  (list as string[]).filter((id) => exists.has(id));

/**
 * The file's data with every reference that the validator offers to remove
 * ("removeReference") taken out, or null if it has none. Unknown keys stay.
 * Applied as a restore command, so the fix can be undone.
 */
export function referenceFix(model: WorldModel, ref: FileRef): ReferenceFix | null {
  const key = refKey(ref);
  const fixable = crossFileProblems(model).some(
    (p) => p.fix === "removeReference" && p.ref !== undefined && refKey(p.ref) === key,
  );
  const current = model.data(ref);
  if (!fixable || current === undefined) return null;

  const data = structuredClone(current) as Record<string, unknown>;
  const characters = new Set(model.all("character").map((c) => c.id));
  switch (ref.kind) {
    case "character": {
      data.roles = keep(data.roles, new Set(model.library("roles").roles.map((r) => r.id)));
      data.templates = keep(
        data.templates,
        new Set(model.library("templates").templates.map((t) => t.id)),
      );
      data.extraFields = keep(
        data.extraFields,
        new Set(model.library("fields").fields.map((f) => f.key)),
      );
      break;
    }
    case "relationship": {
      const types = new Set(model.library("relationshipTypes").types.map((t) => t.id));
      for (const list of ["twoWay", "aToB", "bToA"]) data[list] = keep(data[list], types);
      break;
    }
    case "event":
      data.characters = keep(data.characters, characters);
      break;
    case "roles":
      for (const role of data.roles as Array<{ leaders: string[] }>) {
        role.leaders = keep(role.leaders, characters);
      }
      break;
    default:
      return null;
  }
  return { ref, fileName: model.fileName(ref) ?? null, data };
}
