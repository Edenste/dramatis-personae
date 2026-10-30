import type { Command, Template } from "@dramatis-personae/schema";
import {
  characterWrite,
  invalid,
  libraryWrite,
  notFound,
  type HandlerContext,
  type HandlerResult,
  type Write,
} from "./types.ts";

type Create = Extract<Command, { type: "template.create" }>;
type Update = Extract<Command, { type: "template.update" }>;

/** Checks a template's role and field keys exist; `prefix` locates errors in the command. */
function checkReferences(
  ctx: HandlerContext,
  template: { role?: string | null | undefined; fields?: string[] | undefined },
  prefix: string,
): HandlerResult | null {
  if (template.role && !ctx.model.library("roles").roles.some((r) => r.id === template.role)) {
    return invalid(`Role ${template.role} doesn't exist`, `${prefix}role`);
  }
  const keys = new Set(ctx.model.library("fields").fields.map((f) => f.key));
  for (const [i, key] of (template.fields ?? []).entries()) {
    if (!keys.has(key))
      return invalid(`Field ${key} isn't in the field library`, `${prefix}fields.${i}`);
  }
  return null;
}

const templatesWrite = (ctx: HandlerContext, templates: Template[]): Write =>
  libraryWrite("templates", { ...ctx.model.library("templates"), templates });

export function createTemplate(ctx: HandlerContext, command: Create): HandlerResult {
  const input = command.template;
  const id = input.id ?? ctx.generateId();
  const templates = ctx.model.library("templates").templates;
  if (templates.some((t) => t.id === id))
    return invalid(`A template with id ${id} exists`, "template.id");
  const error = checkReferences(ctx, input, "template.");
  if (error) return error;
  const template: Template = {
    id,
    name: input.name,
    role: input.role ?? null,
    fields: input.fields ?? [],
  };
  return { ok: true, writes: [templatesWrite(ctx, [...templates, template])] };
}

export function updateTemplate(ctx: HandlerContext, command: Update): HandlerResult {
  const templates = ctx.model.library("templates").templates;
  if (!templates.some((t) => t.id === command.id)) {
    return notFound(`No template with id ${command.id}`, "id");
  }
  const error = checkReferences(ctx, command.set, "set.");
  if (error) return error;
  return {
    ok: true,
    writes: [
      templatesWrite(
        ctx,
        templates.map((t) => (t.id === command.id ? { ...t, ...command.set } : t)),
      ),
    ],
  };
}

export function moveTemplate(ctx: HandlerContext, id: string, index: number): HandlerResult {
  const templates = [...ctx.model.library("templates").templates];
  const from = templates.findIndex((t) => t.id === id);
  if (from < 0) return notFound(`No template with id ${id}`, "id");
  const [moved] = templates.splice(from, 1);
  templates.splice(Math.min(index, templates.length), 0, moved!);
  return { ok: true, writes: [templatesWrite(ctx, templates)] };
}

/** Deletes a template and takes it off every character, whose values stay in their files. */
export function deleteTemplate(ctx: HandlerContext, id: string): HandlerResult {
  const templates = ctx.model.library("templates").templates;
  if (!templates.some((t) => t.id === id)) return notFound(`No template with id ${id}`, "id");
  const writes: Write[] = ctx.model
    .all("character")
    .filter((c) => c.templates.includes(id))
    .map((c) => characterWrite(ctx, { ...c, templates: c.templates.filter((t) => t !== id) }));
  writes.push(
    templatesWrite(
      ctx,
      templates.filter((t) => t.id !== id),
    ),
  );
  return { ok: true, writes };
}
