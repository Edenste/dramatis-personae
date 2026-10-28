import type { RelationshipFile } from "@dramatis-personae/schema";
import type { WorldModel } from "./world-model.ts";

export interface Indexes {
  relationshipsByCharacter: Map<string, RelationshipFile[]>;
  membersByRole: Map<string, string[]>;
}

function push<T>(map: Map<string, T[]>, key: string, value: T): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

/** Rebuilt in full whenever the model changes: cheap at the scale of a world. */
export function buildIndexes(model: WorldModel): Indexes {
  const relationshipsByCharacter = new Map<string, RelationshipFile[]>();
  for (const relationship of model.all("relationship")) {
    push(relationshipsByCharacter, relationship.a, relationship);
    if (relationship.b !== relationship.a)
      push(relationshipsByCharacter, relationship.b, relationship);
  }
  const membersByRole = new Map<string, string[]>();
  for (const character of model.all("character")) {
    for (const role of character.roles) push(membersByRole, role, character.id);
  }
  return { relationshipsByCharacter, membersByRole };
}
