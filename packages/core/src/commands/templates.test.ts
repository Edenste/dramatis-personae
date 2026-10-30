import { beforeAll, describe, expect, it } from "vitest";
import { CAMELOT_IDS } from "@dramatis-personae/samples";
import type { CommandBatch } from "@dramatis-personae/schema";
import { loadCamelotModel } from "../test-utils/camelot-model.ts";
import type { WorldModel } from "../model/world-model.ts";
import { applyBatch, type User } from "./index.ts";

const C = CAMELOT_IDS.characters;
const Knight = CAMELOT_IDS.templates.Knight!;
const owner: User = { id: "local", role: "owner" };

let camelot: WorldModel;
beforeAll(async () => {
  camelot = await loadCamelotModel();
});

function apply(model: WorldModel, batch: CommandBatch) {
  const result = applyBatch(model, batch, owner);
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
  return result;
}

describe("template commands: applying a batch and then its inverse restores the world", () => {
  const batches: Array<[string, CommandBatch]> = [
    ["create", { commands: [{ type: "template.create", template: { name: "Squire" } }] }],
    [
      "rename",
      { commands: [{ type: "template.update", id: Knight, set: { name: "Knight errant" } }] },
    ],
    [
      "change fields",
      { commands: [{ type: "template.update", id: Knight, set: { fields: ["weapon"] } }] },
    ],
    ["delete", { commands: [{ type: "template.delete", id: Knight }] }],
  ];

  it.each(batches)("%s", (_label, batch) => {
    const done = apply(camelot, batch);
    expect(done.model.snapshot()).not.toEqual(camelot.snapshot());
    const undone = apply(done.model, done.inverse);
    expect(undone.model.snapshot()).toEqual(camelot.snapshot());
    const redone = apply(undone.model, undone.inverse);
    expect(redone.model.snapshot()).toEqual(done.model.snapshot());
  });

  it("move", () => {
    const two = apply(camelot, {
      commands: [{ type: "template.create", template: { name: "Squire" } }],
    }).model;
    const done = apply(two, { commands: [{ type: "template.move", id: Knight, index: 1 }] });
    expect(done.model.library("templates").templates.map((t) => t.name)).toEqual([
      "Squire",
      "Knight",
    ]);
    expect(apply(done.model, done.inverse).model.snapshot()).toEqual(two.snapshot());
  });
});

describe("creating a template", () => {
  it("generates an id and fills in the defaults", () => {
    const { model } = apply(camelot, {
      commands: [{ type: "template.create", template: { name: "Squire" } }],
    });
    const squire = model.library("templates").templates.find((t) => t.name === "Squire")!;
    expect(squire.id).toMatch(/^[a-z0-9]{16}$/);
    expect(squire.role).toBeNull();
    expect(squire.fields).toEqual([]);
  });

  it("refuses a field that isn't in the library", () => {
    const result = applyBatch(
      camelot,
      {
        commands: [
          { type: "template.create", template: { name: "Squire", fields: ["weapon", "nope"] } },
        ],
      },
      owner,
    );
    expect(result.ok ? null : result.error).toMatchObject({
      code: "invalid",
      path: "commands.0.template.fields.1",
    });
  });

  it("refuses a role that doesn't exist", () => {
    const result = applyBatch(
      camelot,
      {
        commands: [
          { type: "template.create", template: { name: "Squire", role: "zzzzzzzzzzzzzzzz" } },
        ],
      },
      owner,
    );
    expect(result.ok ? null : result.error.path).toBe("commands.0.template.role");
  });
});

describe("updating a template", () => {
  it("refuses an unknown field or role, and an unknown template", () => {
    const bad = (command: CommandBatch["commands"][number]) => {
      const result = applyBatch(camelot, { commands: [command] }, owner);
      return result.ok ? null : result.error;
    };
    expect(bad({ type: "template.update", id: Knight, set: { fields: ["nope"] } })?.path).toBe(
      "commands.0.set.fields.0",
    );
    expect(
      bad({ type: "template.update", id: Knight, set: { role: "zzzzzzzzzzzzzzzz" } })?.path,
    ).toBe("commands.0.set.role");
    expect(bad({ type: "template.update", id: "zzzzzzzzzzzzzzzz", set: { name: "x" } })?.code).toBe(
      "not-found",
    );
  });
});

describe("moving a template", () => {
  it("clamps an index past the end", () => {
    const two = apply(camelot, {
      commands: [{ type: "template.create", template: { name: "Squire" } }],
    }).model;
    const { model } = apply(two, { commands: [{ type: "template.move", id: Knight, index: 99 }] });
    expect(model.library("templates").templates.at(-1)?.name).toBe("Knight");
  });
});

describe("deleting a template", () => {
  it("takes it off every character and keeps their values", () => {
    const { model, changes } = apply(camelot, {
      commands: [{ type: "template.delete", id: Knight }],
    });
    for (const name of ["Lancelot", "Gawain"]) {
      expect(model.get("character", C[name]!)!.templates, name).toEqual([]);
    }
    expect(model.get("character", C.Lancelot!)!.fields.weapon).toBe("Arondight");
    expect(model.library("templates").templates).toEqual([]);
    const last = changes.at(-1);
    expect(last && "ref" in last ? last.ref.kind : null).toBe("templates");
    expect(model.shownFieldKeys(C.Lancelot!)).not.toContain("weapon");
  });
});
