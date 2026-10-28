import {
  CharacterFileSchema,
  LIBRARY_FILES,
  documentFileName,
  type Command,
  type FileRef,
} from "@dramatis-personae/schema";
import { fieldValueProblem } from "../model/validate.ts";
import {
  invalid,
  notFound,
  withSchema,
  type HandlerContext,
  type HandlerResult,
  type Write,
} from "./types.ts";

type Create = Extract<Command, { type: "character.create" }>;
type Update = Extract<Command, { type: "character.update" }>;

interface References {
  roles?: string[] | undefined;
  templates?: string[] | undefined;
  extraFields?: string[] | undefined;
}

/** Checks that roles, templates and one-off fields exist; `prefix` locates errors in the command. */
function checkReferences(
  ctx: HandlerContext,
  refs: References,
  prefix: string,
): HandlerResult | null {
  const roles = new Set(ctx.model.library("roles").roles.map((r) => r.id));
  const templates = new Set(ctx.model.library("templates").templates.map((t) => t.id));
  const fields = new Set(ctx.model.library("fields").fields.map((f) => f.key));
  const lists: Array<[keyof References, Set<string>, string]> = [
    ["roles", roles, "Role"],
    ["templates", templates, "Template"],
    ["extraFields", fields, "Field"],
  ];
  for (const [key, known, label] of lists) {
    for (const [i, value] of (refs[key] ?? []).entries()) {
      if (!known.has(value))
        return invalid(`${label} ${value} doesn't exist`, `${prefix}${key}.${i}`);
    }
  }
  return null;
}

/** Checks that every value has a field in the library and fits it. */
function checkFieldValues(
  ctx: HandlerContext,
  values: Record<string, unknown>,
  prefix: string,
): HandlerResult | null {
  const fields = new Map(ctx.model.library("fields").fields.map((f) => [f.key, f]));
  const characters = new Set(ctx.model.all("character").map((c) => c.id));
  for (const [key, value] of Object.entries(values)) {
    const field = fields.get(key);
    if (!field) return invalid(`${key} isn't in the field library`, `${prefix}${key}`);
    const problem = fieldValueProblem(field, value, characters);
    if (problem) return invalid(problem, `${prefix}${key}`);
  }
  return null;
}

export function createCharacter(ctx: HandlerContext, command: Create): HandlerResult {
  const input = command.character;
  const id = input.id ?? ctx.generateId();
  if (ctx.model.get("character", id))
    return invalid(`A character with id ${id} exists`, "character.id");
  const error =
    checkReferences(ctx, input, "character.") ??
    checkFieldValues(ctx, input.fields ?? {}, "character.fields.");
  if (error) return error;
  const { portrait, ...rest } = input;
  const parsed = CharacterFileSchema.safeParse({ ...rest, ...(portrait ? { portrait } : {}), id });
  if (!parsed.success)
    return invalid(parsed.error.issues[0]?.message ?? "Invalid character", "character");
  const data = withSchema("character", parsed.data);
  const ref: FileRef = { kind: "character", id };
  return { ok: true, writes: [{ ref, fileName: documentFileName(input.name, id), data }] };
}

export function updateCharacter(ctx: HandlerContext, command: Update): HandlerResult {
  const ref: FileRef = { kind: "character", id: command.id };
  const current = ctx.model.get("character", command.id);
  if (!current) return notFound(`No character with id ${command.id}`, "id");
  const error =
    checkReferences(ctx, command.set ?? {}, "set.") ??
    checkFieldValues(ctx, command.setFields ?? {}, "setFields.");
  if (error) return error;

  const next: Record<string, unknown> = { ...current };
  for (const [key, value] of Object.entries(command.set ?? {})) {
    if (key === "portrait" && value === null) delete next.portrait;
    else next[key] = value;
  }
  const fields: Record<string, unknown> = { ...current.fields, ...command.setFields };
  for (const key of command.unsetFields ?? []) delete fields[key];
  next.fields = fields;

  const parsed = CharacterFileSchema.safeParse(next);
  if (!parsed.success)
    return invalid(parsed.error.issues[0]?.message ?? "Invalid character", "set");
  // Keep a hand-chosen file name unless the character is actually renamed.
  const renamed = command.set?.name !== undefined && command.set.name !== current.name;
  const fileName = renamed
    ? documentFileName(command.set!.name!, command.id)
    : (ctx.model.fileName(ref) ?? documentFileName(current.name, command.id));
  return { ok: true, writes: [{ ref, fileName, data: withSchema("character", parsed.data) }] };
}

/**
 * Deletes a character with everything that points at it, dependents first and
 * the character's own file last, so a crash part-way leaves only dangling
 * references (spec §13).
 */
export function deleteCharacter(ctx: HandlerContext, id: string): HandlerResult {
  const ref: FileRef = { kind: "character", id };
  if (!ctx.model.get("character", id)) return notFound(`No character with id ${id}`, "id");
  const writes: Write[] = [];

  for (const relationship of ctx.model.relationshipsOf(id)) {
    writes.push({ ref: { kind: "relationship", id: relationship.id }, remove: true });
  }
  for (const event of ctx.model.all("event")) {
    if (!event.characters.includes(id)) continue;
    const eventRef: FileRef = { kind: "event", id: event.id };
    const data = { ...event, characters: event.characters.filter((c) => c !== id) };
    const fileName = ctx.model.fileName(eventRef) ?? documentFileName(event.title, event.id);
    writes.push({ ref: eventRef, fileName, data: withSchema("event", data) });
  }
  const roles = ctx.model.library("roles");
  if (roles.roles.some((r) => r.leaders.includes(id))) {
    const data = {
      ...roles,
      roles: roles.roles.map((r) => ({ ...r, leaders: r.leaders.filter((l) => l !== id) })),
    };
    writes.push({
      ref: { kind: "roles" },
      fileName: LIBRARY_FILES.roles,
      data: withSchema("roles", data),
    });
  }
  writes.push({ ref, remove: true });
  return { ok: true, writes };
}
