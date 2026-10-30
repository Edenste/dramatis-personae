import {
  FieldDefinitionSchema,
  type Command,
  type FieldDefinition,
} from "@dramatis-personae/schema";
import {
  characterWrite,
  invalid,
  libraryWrite,
  notFound,
  type HandlerContext,
  type HandlerResult,
  type Write,
} from "./types.ts";

type Create = Extract<Command, { type: "field.create" }>;
type Update = Extract<Command, { type: "field.update" }>;

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

/** The characters that hold a value for a field, with that value. */
function valuesOf(ctx: HandlerContext, key: string) {
  return ctx.model.all("character").filter((c) => c.fields[key] !== undefined);
}

function fieldsFile(ctx: HandlerContext) {
  return ctx.model.library("fields");
}

export function createField(ctx: HandlerContext, command: Create): HandlerResult {
  const file = fieldsFile(ctx);
  if (file.fields.some((f) => f.key === command.field.key)) {
    return invalid(`A field with key ${command.field.key} exists`, "field.key");
  }
  return {
    ok: true,
    writes: [libraryWrite("fields", { ...file, fields: [...file.fields, command.field] })],
  };
}

export function updateField(ctx: HandlerContext, command: Update): HandlerResult {
  const file = fieldsFile(ctx);
  const current = file.fields.find((f) => f.key === command.key);
  if (!current) return notFound(`No field with key ${command.key}`, "key");

  const { unit, ...rest } = command.set;
  const next: Record<string, unknown> = { ...current, ...rest };
  if (unit === null) delete next.unit;
  else if (unit !== undefined) next.unit = unit;

  if (rest.type !== undefined && rest.type !== current.type) {
    const holders = valuesOf(ctx, command.key);
    if (holders.length > 0) {
      return invalid(
        `${holders.length} ${plural(holders.length, "character has a value", "characters have a value")} in ${current.label}, so its type can't change.`,
        "set.type",
      );
    }
    // Settings that only make sense for the old type go with it.
    if (rest.type !== "select" && rest.type !== "multiselect") delete next.options;
    // A choice field starts with no options; they are added afterwards.
    else if (next.options === undefined) next.options = [];
    if (rest.type !== "measurement") delete next.unit;
    if (rest.type !== "date") delete next.calendar;
  }

  const parsed = FieldDefinitionSchema.safeParse(next);
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message ?? "Invalid field", "set");
  const updated: FieldDefinition = parsed.data;

  const writes: Write[] = [];
  const removed = (current.options ?? []).filter((o) => !(updated.options ?? []).includes(o));
  if (removed.length > 0) {
    for (const character of valuesOf(ctx, command.key)) {
      const value = character.fields[command.key];
      let kept: unknown = value;
      if (typeof value === "string" && removed.includes(value)) kept = undefined;
      else if (Array.isArray(value)) {
        const left = value.filter((v) => !removed.includes(v as string));
        kept = left.length > 0 ? left : undefined;
      }
      if (kept === value) continue;
      const fields = { ...character.fields };
      if (kept === undefined) delete fields[command.key];
      else fields[command.key] = kept;
      writes.push(characterWrite(ctx, { ...character, fields }));
    }
  }
  writes.push(
    libraryWrite("fields", {
      ...file,
      fields: file.fields.map((f) => (f.key === command.key ? updated : f)),
    }),
  );
  return { ok: true, writes };
}

export function moveField(ctx: HandlerContext, key: string, index: number): HandlerResult {
  const file = fieldsFile(ctx);
  const from = file.fields.findIndex((f) => f.key === key);
  if (from < 0) return notFound(`No field with key ${key}`, "key");
  const fields = [...file.fields];
  const [moved] = fields.splice(from, 1);
  fields.splice(Math.min(index, fields.length), 0, moved!);
  return { ok: true, writes: [libraryWrite("fields", { ...file, fields })] };
}

/**
 * Deletes a field with every trace of it: template lists, one-off lists and
 * values on characters (written first), then the templates, then the library,
 * so a crash part-way leaves at most references that Problems can fix.
 */
export function deleteField(ctx: HandlerContext, key: string): HandlerResult {
  const file = fieldsFile(ctx);
  if (!file.fields.some((f) => f.key === key)) return notFound(`No field with key ${key}`, "key");
  const writes: Write[] = [];
  for (const character of ctx.model.all("character")) {
    if (character.fields[key] === undefined && !character.extraFields.includes(key)) continue;
    const fields = { ...character.fields };
    delete fields[key];
    writes.push(
      characterWrite(ctx, {
        ...character,
        fields,
        extraFields: character.extraFields.filter((k) => k !== key),
      }),
    );
  }
  const templates = ctx.model.library("templates");
  if (templates.templates.some((t) => t.fields.includes(key))) {
    writes.push(
      libraryWrite("templates", {
        ...templates,
        templates: templates.templates.map((t) => ({
          ...t,
          fields: t.fields.filter((k) => k !== key),
        })),
      }),
    );
  }
  writes.push(
    libraryWrite("fields", {
      ...file,
      subtitle: file.subtitle === key ? null : file.subtitle,
      fields: file.fields.filter((f) => f.key !== key),
    }),
  );
  return { ok: true, writes };
}

export function setSubtitle(ctx: HandlerContext, key: string | null): HandlerResult {
  const file = fieldsFile(ctx);
  if (key !== null && !file.fields.some((f) => f.key === key)) {
    return invalid(`${key} isn't in the field library`, "key");
  }
  return { ok: true, writes: [libraryWrite("fields", { ...file, subtitle: key })] };
}
