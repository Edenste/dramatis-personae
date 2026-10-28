import { extname } from "node:path";
import {
  DateValueSchema,
  fieldValueSchema,
  type CharacterFile,
  type DateValue,
  type FieldDefinition,
  type FileRef,
  type Problem,
  type ProblemCode,
} from "@dramatis-personae/schema";
import type { WorldModel } from "./world-model.ts";

export const PORTRAIT_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"]);

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** False only for a Gregorian date whose day can't exist in its month. */
export function isPossibleDate(date: DateValue): boolean {
  if (date.calendar !== "gregorian" || date.month === undefined || date.day === undefined) {
    return true;
  }
  return date.day <= (DAYS_IN_MONTH[date.month - 1] ?? 31);
}

/** Problems that only show up when files are read together (spec §13). */
export function crossFileProblems(model: WorldModel): Problem[] {
  const problems: Problem[] = [];
  const report = (ref: FileRef, code: ProblemCode, message: string, fix?: Problem["fix"]) => {
    const path = model.path(ref) ?? "";
    problems.push({ code, path, message, ref, ...(fix ? { fix } : {}) });
  };

  const characters = new Set(model.all("character").map((c) => c.id));
  const roles = model.library("roles").roles;
  const roleIds = new Set(roles.map((r) => r.id));
  const templates = model.library("templates").templates;
  const templateIds = new Set(templates.map((t) => t.id));
  const fields = new Map(model.library("fields").fields.map((f) => [f.key, f]));
  const types = new Map(model.library("relationshipTypes").types.map((t) => [t.id, t]));

  const world = model.world;
  if (world.mainView !== null && !model.get("view", world.mainView)) {
    report({ kind: "world" }, "dangling-reference", `Main view ${world.mainView} doesn't exist`);
  }

  for (const character of model.all("character")) {
    const ref: FileRef = { kind: "character", id: character.id };
    for (const role of character.roles) {
      if (!roleIds.has(role)) {
        report(ref, "dangling-reference", `Role ${role} doesn't exist`, "removeReference");
      }
    }
    for (const template of character.templates) {
      if (!templateIds.has(template)) {
        report(ref, "dangling-reference", `Template ${template} doesn't exist`, "removeReference");
      }
    }
    for (const key of character.extraFields) {
      if (!fields.has(key)) {
        report(
          ref,
          "dangling-reference",
          `Field ${key} isn't in the field library`,
          "removeReference",
        );
      }
    }
    checkFieldValues(character, fields, characters, (message) =>
      report(ref, "invalid-field-value", message),
    );
    if (character.portrait) {
      const file = character.portrait.file;
      if (!PORTRAIT_EXTENSIONS.has(extname(file).toLowerCase())) {
        report(ref, "unsupported-portrait", `${file} isn't a supported image type`);
      } else if (!model.hasAsset(file)) {
        report(ref, "missing-portrait", `${file} isn't in assets/portraits`);
      }
    }
  }

  const pairs = new Map<string, string>();
  const relationships = model
    .all("relationship")
    .map((r) => ({ relationship: r, path: model.path({ kind: "relationship", id: r.id }) ?? "" }))
    .sort((x, y) => x.path.localeCompare(y.path));
  for (const { relationship } of relationships) {
    const ref: FileRef = { kind: "relationship", id: relationship.id };
    for (const side of [relationship.a, relationship.b]) {
      if (!characters.has(side))
        report(ref, "dangling-reference", `Character ${side} doesn't exist`);
    }
    if (relationship.a === relationship.b) {
      report(ref, "self-relationship", "A relationship needs two different characters");
    } else {
      const pair = [relationship.a, relationship.b].sort().join("|");
      const first = pairs.get(pair);
      if (first) report(ref, "duplicate-pair", `The same pair as ${first}`);
      else pairs.set(pair, model.path(ref) ?? "");
    }
    // Each side of a one-way relationship may use any type ("Friends" from one side,
    // "Crush" from the other), but a one-way type can't be shared by both sides.
    for (const typeId of [...relationship.twoWay, ...relationship.aToB, ...relationship.bToA]) {
      if (!types.has(typeId)) {
        report(
          ref,
          "dangling-reference",
          `Relationship type ${typeId} doesn't exist`,
          "removeReference",
        );
      }
    }
    for (const typeId of relationship.twoWay) {
      const type = types.get(typeId);
      if (type?.direction === "one-way") {
        report(ref, "type-direction-mismatch", `${type.name} is one-way, so it can't be shared`);
      }
    }
  }

  for (const event of model.all("event")) {
    const ref: FileRef = { kind: "event", id: event.id };
    for (const id of event.characters) {
      if (!characters.has(id)) {
        report(ref, "dangling-reference", `Character ${id} doesn't exist`, "removeReference");
      }
    }
    if (!isPossibleDate(event.date)) report(ref, "invalid-field-value", "The date doesn't exist");
  }

  for (const role of roles) {
    for (const leader of role.leaders) {
      if (!characters.has(leader)) {
        report(
          { kind: "roles" },
          "dangling-reference",
          `Leader ${leader} doesn't exist`,
          "removeReference",
        );
      } else if (!model.get("character", leader)?.roles.includes(role.id)) {
        report(
          { kind: "roles" },
          "leader-without-role",
          `A leader of ${role.name} doesn't have the role`,
        );
      }
    }
  }

  for (const template of templates) {
    if (template.role !== null && !roleIds.has(template.role)) {
      report({ kind: "templates" }, "dangling-reference", `Role ${template.role} doesn't exist`);
    }
    for (const key of template.fields) {
      if (!fields.has(key)) {
        report(
          { kind: "templates" },
          "dangling-reference",
          `Field ${key} isn't in the field library`,
        );
      }
    }
  }

  for (const view of model.all("view")) {
    if (view.focus !== null && !characters.has(view.focus)) {
      report(
        { kind: "view", id: view.id },
        "dangling-reference",
        `Character ${view.focus} doesn't exist`,
      );
    }
  }

  return problems;
}

function checkFieldValues(
  character: CharacterFile,
  fields: Map<string, FieldDefinition>,
  characters: Set<string>,
  report: (message: string) => void,
): void {
  for (const [key, value] of Object.entries(character.fields)) {
    const field = fields.get(key);
    if (!field) {
      report(`${key} isn't in the field library`);
      continue;
    }
    if (!fieldValueSchema(field.type).safeParse(value).success) {
      report(`${field.label} has the wrong kind of value`);
      continue;
    }
    if (field.type === "select" && !field.options?.includes(value as string)) {
      report(`${String(value)} isn't an option for ${field.label}`);
    } else if (field.type === "multiselect") {
      const missing = (value as string[]).filter((v) => !field.options?.includes(v));
      if (missing.length > 0) report(`${missing.join(", ")} aren't options for ${field.label}`);
    } else if (field.type === "date" && !isPossibleDate(DateValueSchema.parse(value))) {
      report(`${field.label} is a date that doesn't exist`);
    } else if (field.type === "character" && !characters.has(value as string)) {
      report(`${field.label} points to a character that doesn't exist`);
    }
  }
}
