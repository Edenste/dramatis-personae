import { beforeAll, describe, expect, it } from "vitest";
import { CAMELOT_IDS } from "@dramatis-personae/samples";
import type { CommandBatch } from "@dramatis-personae/schema";
import { loadCamelotModel } from "../test-utils/camelot-model.ts";
import type { WorldModel } from "../model/world-model.ts";
import type { DocumentChange } from "../storage/types.ts";
import { applyBatch, type User } from "./index.ts";

const C = CAMELOT_IDS.characters;
const owner: User = { id: "local", role: "owner" };

let camelot: WorldModel;
beforeAll(async () => {
  camelot = await loadCamelotModel();
});

/** The kind of file each change writes, in order. */
const kindsOf = (changes: DocumentChange[]) =>
  changes.flatMap((change) => ("ref" in change ? [change.ref.kind] : []));

function apply(model: WorldModel, batch: CommandBatch) {
  const result = applyBatch(model, batch, owner);
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
  return result;
}

const shoeSize = {
  key: "shoeSize",
  label: "Shoe size",
  type: "measurement" as const,
  default: false,
  unit: "EU",
};

describe("field commands: applying a batch and then its inverse restores the world", () => {
  const batches: Array<[string, CommandBatch]> = [
    ["create", { commands: [{ type: "field.create", field: shoeSize }] }],
    ["rename", { commands: [{ type: "field.update", key: "weapon", set: { label: "Arms" } }] }],
    [
      "remove an option in use",
      {
        commands: [{ type: "field.update", key: "bloodType", set: { options: ["A", "B", "AB"] } }],
      },
    ],
    ["move", { commands: [{ type: "field.move", key: "steed", index: 0 }] }],
    ["delete a field in use", { commands: [{ type: "field.delete", key: "weapon" }] }],
    ["move the subtitle", { commands: [{ type: "fields.setSubtitle", key: "birthday" }] }],
    ["clear the subtitle", { commands: [{ type: "fields.setSubtitle", key: null }] }],
  ];

  it.each(batches)("%s", (_label, batch) => {
    const done = apply(camelot, batch);
    expect(done.model.snapshot()).not.toEqual(camelot.snapshot());
    const undone = apply(done.model, done.inverse);
    expect(undone.model.snapshot()).toEqual(camelot.snapshot());
    const redone = apply(undone.model, undone.inverse);
    expect(redone.model.snapshot()).toEqual(done.model.snapshot());
  });
});

describe("adding a field from a profile", () => {
  const batch: CommandBatch = {
    commands: [
      { type: "field.create", field: shoeSize },
      {
        type: "character.update",
        id: C.Lancelot!,
        set: { extraFields: ["shoeSize"] },
        setFields: { shoeSize: { value: 42, unit: "EU" } },
      },
    ],
  };

  it("creates the field and shows it on the character in one undo step", () => {
    const done = apply(camelot, batch);
    expect(done.model.shownFieldKeys(C.Lancelot!)).toContain("shoeSize");
    expect(done.inverse.commands).toHaveLength(1);
    expect(apply(done.model, done.inverse).model.snapshot()).toEqual(camelot.snapshot());
  });
});

describe("deleting a field", () => {
  it("removes it everywhere, writing characters, then templates, then the library", () => {
    const { model, changes } = apply(camelot, {
      commands: [{ type: "field.delete", key: "weapon" }],
    });
    for (const character of model.all("character")) {
      expect(character.fields, character.name).not.toHaveProperty("weapon");
    }
    expect(model.library("templates").templates[0]?.fields).toEqual(["liege", "steed"]);
    expect(model.library("fields").fields.map((f) => f.key)).not.toContain("weapon");

    const kinds = kindsOf(changes);
    expect(kinds.slice(-2)).toEqual(["templates", "fields"]);
    expect(kinds.slice(0, -2).every((kind) => kind === "character")).toBe(true);
    expect(kinds.filter((kind) => kind === "character")).toHaveLength(2); // Lancelot and Gawain
  });

  it("clears the subtitle when it named the field", () => {
    const { model } = apply(camelot, { commands: [{ type: "field.delete", key: "title" }] });
    expect(model.library("fields").subtitle).toBeNull();
  });

  it("removes a one-off field from the characters that show it", () => {
    const { model } = apply(camelot, { commands: [{ type: "field.delete", key: "bloodType" }] });
    const merlin = model.get("character", C.Merlin!)!;
    expect(merlin.extraFields).toEqual([]);
    expect(merlin.fields).not.toHaveProperty("bloodType");
  });
});

describe("removing an option", () => {
  it("clears a select value that used it", () => {
    const { model } = apply(camelot, {
      commands: [{ type: "field.update", key: "bloodType", set: { options: ["A", "B", "AB"] } }],
    });
    expect(model.get("character", C.Merlin!)!.fields).not.toHaveProperty("bloodType");
    expect(model.library("fields").fields.find((f) => f.key === "bloodType")?.options).toEqual([
      "A",
      "B",
      "AB",
    ]);
  });

  it("trims multi-select lists and unsets the ones left empty", () => {
    const withTags = apply(camelot, {
      commands: [
        {
          type: "field.create",
          field: {
            key: "tags",
            label: "Tags",
            type: "multiselect",
            default: false,
            options: ["a", "b"],
          },
        },
        {
          type: "character.update",
          id: C.Kay!,
          set: { extraFields: ["tags"] },
          setFields: { tags: ["a", "b"] },
        },
        {
          type: "character.update",
          id: C.Percival!,
          set: { extraFields: ["tags"] },
          setFields: { tags: ["a"] },
        },
      ],
    }).model;
    const { model } = apply(withTags, {
      commands: [{ type: "field.update", key: "tags", set: { options: ["b"] } }],
    });
    expect(model.get("character", C.Kay!)!.fields.tags).toEqual(["b"]);
    expect(model.get("character", C.Percival!)!.fields).not.toHaveProperty("tags");
  });

  it("leaves an option nobody uses without touching characters", () => {
    const { changes } = apply(camelot, {
      commands: [
        { type: "field.update", key: "bloodType", set: { options: ["A", "B", "AB", "O", "X"] } },
      ],
    });
    expect(kindsOf(changes)).toEqual(["fields"]);
  });
});

describe("changing a field's type", () => {
  it("is refused while a character has a value", () => {
    const result = applyBatch(
      camelot,
      { commands: [{ type: "field.update", key: "bloodType", set: { type: "text" } }] },
      owner,
    );
    expect(result).toEqual({
      ok: false,
      error: {
        code: "invalid",
        message: "1 character has a value in Blood type, so its type can't change.",
        path: "commands.0.set.type",
      },
    });
  });

  it("says how many when several characters have a value", () => {
    const result = applyBatch(
      camelot,
      { commands: [{ type: "field.update", key: "weapon", set: { type: "number" } }] },
      owner,
    );
    expect(result.ok ? "" : result.error.message).toBe(
      "2 characters have a value in Weapon, so its type can't change.",
    );
  });

  it("can turn an unused text field into a select, which starts with no options", () => {
    const withTmp = apply(camelot, {
      commands: [
        { type: "field.create", field: { key: "tmp", label: "Tmp", type: "text", default: false } },
      ],
    }).model;
    for (const type of ["select", "multiselect"] as const) {
      const { model } = apply(withTmp, {
        commands: [{ type: "field.update", key: "tmp", set: { type } }],
      });
      const field = model.library("fields").fields.find((f) => f.key === "tmp")!;
      expect([field.type, field.options]).toEqual([type, []]);
    }
  });

  it("is allowed on an unused field, which drops options it no longer needs", () => {
    const withTmp = apply(camelot, {
      commands: [
        {
          type: "field.create",
          field: { key: "tmp", label: "Tmp", type: "select", default: false, options: ["x"] },
        },
      ],
    }).model;
    const { model } = apply(withTmp, {
      commands: [{ type: "field.update", key: "tmp", set: { type: "number" } }],
    });
    const field = model.library("fields").fields.find((f) => f.key === "tmp")!;
    expect(field.type).toBe("number");
    expect(field).not.toHaveProperty("options");
  });
});

describe("refusals", () => {
  it("refuses a field key that exists", () => {
    const result = applyBatch(
      camelot,
      { commands: [{ type: "field.create", field: { ...shoeSize, key: "weapon" } }] },
      owner,
    );
    expect(result.ok ? null : result.error).toMatchObject({
      code: "invalid",
      path: "commands.0.field.key",
    });
  });

  it("refuses a subtitle that isn't a field", () => {
    const result = applyBatch(
      camelot,
      { commands: [{ type: "fields.setSubtitle", key: "nope" }] },
      owner,
    );
    expect(result.ok ? null : result.error).toMatchObject({
      code: "invalid",
      path: "commands.0.key",
    });
  });

  it("answers not-found for a field that isn't there", () => {
    for (const command of [
      { type: "field.update", key: "nope", set: { label: "x" } },
      { type: "field.move", key: "nope", index: 0 },
      { type: "field.delete", key: "nope" },
    ] as const) {
      const result = applyBatch(camelot, { commands: [command] }, owner);
      expect(result.ok ? null : result.error.code, command.type).toBe("not-found");
    }
  });

  it("clamps a move past the end to the last place", () => {
    const { model } = apply(camelot, {
      commands: [{ type: "field.move", key: "birthday", index: 99 }],
    });
    expect(model.library("fields").fields.at(-1)?.key).toBe("birthday");
  });
});
