import MiniSearch from "minisearch";
import {
  DateValueSchema,
  type CharacterFile,
  type FieldDefinition,
} from "@dramatis-personae/schema";
import type { WorldModel } from "../model/world-model.ts";

interface SearchDocument {
  id: string;
  name: string;
  roles: string;
  fields: string;
  body: string;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** A field value as searchable text: dates read like "15 August 516". */
function valueText(field: FieldDefinition, value: unknown): string {
  if (field.type === "date") {
    const date = DateValueSchema.safeParse(value);
    if (!date.success) return "";
    const { day, month, year } = date.data;
    return [day, month ? MONTHS[month - 1] : undefined, year]
      .filter((p) => p !== undefined)
      .join(" ");
  }
  if (field.type === "measurement" && typeof value === "object" && value !== null) {
    const { value: amount, unit } = value as { value: unknown; unit: unknown };
    return `${String(amount)} ${String(unit)}`;
  }
  if (Array.isArray(value)) return value.map(String).join(" ");
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function toDocument(model: WorldModel, character: CharacterFile): SearchDocument {
  const fields = new Map(model.library("fields").fields.map((f) => [f.key, f]));
  const roleNames = new Map(model.library("roles").roles.map((r) => [r.id, r.name]));
  return {
    id: character.id,
    name: character.name,
    roles: character.roles.map((id) => roleNames.get(id) ?? "").join(" "),
    // Only shown fields: values kept after a template was removed aren't searched.
    fields: model
      .shownFieldKeys(character.id)
      .map((key) => valueText(fields.get(key)!, character.fields[key]))
      .join(" "),
    body: character.body,
  };
}

/** Full-text search over characters' names, roles, shown field values and body text. */
export class SearchIndex {
  private constructor(private readonly mini: MiniSearch<SearchDocument>) {}

  static build(model: WorldModel): SearchIndex {
    const mini = new MiniSearch<SearchDocument>({
      fields: ["name", "roles", "fields", "body"],
      searchOptions: { boost: { name: 3, roles: 2 }, prefix: true, fuzzy: 0.2 },
    });
    mini.addAll(model.all("character").map((c) => toDocument(model, c)));
    return new SearchIndex(mini);
  }

  /** Re-indexes the given characters, dropping any that no longer exist. */
  update(model: WorldModel, characterIds: string[]): void {
    for (const id of characterIds) {
      if (this.mini.has(id)) this.mini.discard(id);
      const character = model.get("character", id);
      if (character) this.mini.add(toDocument(model, character));
    }
  }

  search(query: string): Array<{ id: string; score: number }> {
    return this.mini.search(query).map((hit) => ({ id: hit.id as string, score: hit.score }));
  }
}
