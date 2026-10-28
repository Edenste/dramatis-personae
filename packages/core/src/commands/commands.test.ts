import { beforeAll, describe, expect, it } from "vitest";
import { CAMELOT_IDS } from "@dramatis-personae/samples";
import { documentFileName, type CommandBatch, type FileRef } from "@dramatis-personae/schema";
import { editFile, loadCamelotModel } from "../test-utils/camelot-model.ts";
import type { WorldModel } from "../model/world-model.ts";
import { applyBatch, can, type User } from "./index.ts";

const C = CAMELOT_IDS.characters;
const R = CAMELOT_IDS.roles;
const owner: User = { id: "local", role: "owner" };
const kay: FileRef = { kind: "character", id: C.Kay! };

let camelot: WorldModel;
beforeAll(async () => {
  camelot = await loadCamelotModel();
});

function apply(model: WorldModel, batch: CommandBatch, user = owner) {
  const result = applyBatch(model, batch, user);
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
  return result;
}

describe("round trips: applying a batch and then its inverse restores the world", () => {
  const batches: Array<[string, CommandBatch]> = [
    ["create", { commands: [{ type: "character.create", character: { name: "Ector" } }] }],
    ["rename", { commands: [{ type: "character.update", id: C.Kay!, set: { name: "Sir Kay" } }] }],
    [
      "set and unset fields",
      {
        commands: [
          {
            type: "character.update",
            id: C.Merlin!,
            setFields: { title: "Archmage" },
            unsetFields: ["bloodType"],
          },
        ],
      },
    ],
    [
      "roles",
      { commands: [{ type: "character.update", id: C.Kay!, set: { roles: [R.Avalon!] } }] },
    ],
    ["delete with cascade", { commands: [{ type: "character.delete", id: C.Mordred! }] }],
    ["world rename", { commands: [{ type: "world.rename", name: "Logres" }] }],
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

describe("character commands", () => {
  it("renames the file when the name changes", () => {
    const { changes } = apply(camelot, {
      commands: [{ type: "character.update", id: C.Kay!, set: { name: "Sir Kay" } }],
    });
    expect(changes).toEqual([
      expect.objectContaining({
        op: "put",
        ref: kay,
        fileName: documentFileName("Sir Kay", C.Kay!),
      }),
    ]);
  });

  it("generates an id and file name for a new character", () => {
    const { changes } = apply(camelot, {
      commands: [{ type: "character.create", character: { name: "Ector" } }],
    });
    const put = changes[0];
    expect(put?.op).toBe("put");
    if (put?.op !== "put" || !("id" in put.ref)) throw new Error("expected a document put");
    expect(put.ref.id).toMatch(/^[a-z0-9]{16}$/);
    expect(put.fileName).toBe(documentFileName("Ector", put.ref.id));
    expect(JSON.parse(put.text)).toMatchObject({
      $schema: "../world.schema.json#/$defs/character",
    });
  });

  it("refuses to create a character with an id that's taken", () => {
    const result = applyBatch(
      camelot,
      { commands: [{ type: "character.create", character: { id: C.Kay!, name: "Kay 2" } }] },
      owner,
    );
    expect(result).toMatchObject({ ok: false, error: { code: "invalid" } });
  });

  it("deletes a character's relationships, then edits events and roles, then the character", () => {
    const { changes } = apply(camelot, {
      commands: [{ type: "character.delete", id: C.Mordred! }],
    });
    const mordred: FileRef = { kind: "character", id: C.Mordred! };
    expect(changes.at(-1)).toEqual({ op: "delete", ref: mordred });
    const relationshipDeletes = changes.flatMap((c, i) =>
      c.op === "delete" && c.ref.kind === "relationship" ? [i] : [],
    );
    expect(relationshipDeletes.length).toBe(camelot.relationshipsOf(C.Mordred!).length);
    expect(Math.max(...relationshipDeletes)).toBeLessThan(changes.length - 1);
    expect(changes).toContainEqual(
      expect.objectContaining({
        op: "put",
        ref: { kind: "event", id: CAMELOT_IDS.events["Battle of Camlann"] },
      }),
    );
  });

  it("keeps keys it doesn't know about", () => {
    const model = editFile(camelot, kay, (d) => void (d.nickname = "Seneschal"));
    const { changes, model: after } = apply(model, {
      commands: [{ type: "character.update", id: C.Kay!, set: { body: "New text" } }],
    });
    expect(after.get("character", C.Kay!)).toMatchObject({ nickname: "Seneschal" });
    expect(changes[0]?.op === "put" && changes[0].text).toContain('"nickname": "Seneschal"');
  });
});

describe("restore input", () => {
  const kayData = () => camelot.get("character", C.Kay!)!;

  it.each(["../../escaped.json", "a/b.json", "..\\x.json"])(
    "refuses a file name that leaves its folder: %s",
    (fileName) => {
      const result = applyBatch(
        camelot,
        { commands: [{ type: "restore", files: [{ ref: kay, fileName, data: kayData() }] }] },
        owner,
      );
      expect(result).toMatchObject({ ok: false, error: { code: "invalid" } });
    },
  );

  it("refuses data whose id doesn't match its ref", () => {
    const result = applyBatch(
      camelot,
      {
        commands: [
          {
            type: "restore",
            files: [{ ref: kay, fileName: "kay.json", data: { ...kayData(), id: C.Arthur } }],
          },
        ],
      },
      owner,
    );
    expect(result).toMatchObject({ ok: false, error: { code: "invalid" } });
  });

  it("refuses to change the world's id", () => {
    const result = applyBatch(
      camelot,
      {
        commands: [
          {
            type: "restore",
            files: [
              {
                ref: { kind: "world" },
                fileName: null,
                data: { ...camelot.world, id: "zzzzzzzzzzzzzzzz" },
              },
            ],
          },
        ],
      },
      owner,
    );
    expect(result).toMatchObject({ ok: false, error: { code: "invalid" } });
  });

  it("fills in defaults for minimal data instead of crashing", () => {
    const result = apply(camelot, {
      commands: [
        {
          type: "restore",
          files: [{ ref: kay, fileName: "kay.json", data: { id: C.Kay, name: "Kay" } }],
        },
      ],
    });
    expect(result.model.get("character", C.Kay!)?.roles).toEqual([]);
  });

  it("refuses a malformed expect key", () => {
    const result = applyBatch(
      camelot,
      { commands: [{ type: "world.rename", name: "Logres" }], expect: { "not a key": null } },
      owner,
    );
    expect(result).toMatchObject({ ok: false, error: { code: "invalid" } });
  });

  it("refuses a portrait file name that leaves the portraits folder", () => {
    const result = applyBatch(
      camelot,
      {
        commands: [
          {
            type: "character.update",
            id: C.Kay!,
            set: { portrait: { file: "../../x.png", crop: { x: 0, y: 0, size: 1 } } },
          },
        ],
      },
      owner,
    );
    expect(result).toMatchObject({ ok: false, error: { code: "invalid" } });
  });
});

describe("nested extra keys", () => {
  it("survive an unrelated edit", () => {
    const model = editFile(camelot, { kind: "character", id: C.Arthur! }, (d) => {
      (d.portrait as { crop: Record<string, unknown> }).crop.rotation = 90;
    });
    const { model: after } = apply(model, {
      commands: [{ type: "character.update", id: C.Arthur!, set: { body: "New text" } }],
    });
    expect(after.get("character", C.Arthur!)?.portrait?.crop).toMatchObject({ rotation: 90 });
  });
});

describe("validation and refusals", () => {
  it("applies nothing when any command in the batch is invalid", () => {
    const before = camelot.snapshot();
    const result = applyBatch(
      camelot,
      {
        commands: [
          { type: "character.update", id: C.Kay!, set: { body: "fine" } },
          { type: "character.update", id: C.Kay!, set: { roles: ["zzzzzzzzzzzzzzzz"] } },
        ],
      },
      owner,
    );
    expect(result).toMatchObject({
      ok: false,
      error: { code: "invalid", path: "commands.1.set.roles.0" },
    });
    expect(camelot.snapshot()).toEqual(before);
  });

  it.each([
    ["a select value that isn't an option", { bloodType: "Q" }],
    ["a field that isn't in the library", { nope: 1 }],
  ])("rejects %s", (_label, setFields) => {
    const result = applyBatch(
      camelot,
      { commands: [{ type: "character.update", id: C.Merlin!, setFields }] },
      owner,
    );
    expect(result).toMatchObject({ ok: false, error: { code: "invalid" } });
  });

  it("refuses edits from a viewer", () => {
    const result = applyBatch(
      camelot,
      { commands: [{ type: "world.rename", name: "Logres" }] },
      { id: "guest", role: "viewer" },
    );
    expect(result).toMatchObject({ ok: false, error: { code: "forbidden" } });
  });

  it("refuses edits to a read-only world", () => {
    const result = applyBatch(
      camelot,
      { commands: [{ type: "world.rename", name: "Logres" }] },
      owner,
      { readOnly: true },
    );
    expect(result).toMatchObject({ ok: false, error: { code: "read-only" } });
  });

  it("refuses a batch whose expected fingerprint is stale", () => {
    const result = applyBatch(
      camelot,
      {
        commands: [{ type: "character.update", id: C.Kay!, set: { body: "x" } }],
        expect: { [`character:${C.Kay}`]: "stale" },
      },
      owner,
    );
    expect(result).toMatchObject({ ok: false, error: { code: "conflict" } });
  });

  it("refuses to touch a document whose file is broken on disk", () => {
    const path = `characters/${camelot.fileName(kay)}`;
    const blocked = camelot.withInvalid(path, { code: "invalid-json", path, message: "broken" });
    const result = applyBatch(
      blocked,
      { commands: [{ type: "character.update", id: C.Kay!, set: { body: "x" } }] },
      owner,
    );
    expect(result).toMatchObject({ ok: false, error: { code: "blocked" } });
  });

  it("reports a missing character as not found", () => {
    const result = applyBatch(
      camelot,
      { commands: [{ type: "character.delete", id: "zzzzzzzzzzzzzzzz" }] },
      owner,
    );
    expect(result).toMatchObject({ ok: false, error: { code: "not-found" } });
  });
});

describe("can", () => {
  it("lets owners and editors edit, and viewers only read", () => {
    expect(can({ id: "a", role: "owner" }, "edit")).toBe(true);
    expect(can({ id: "a", role: "editor" }, "edit")).toBe(true);
    expect(can({ id: "a", role: "viewer" }, "edit")).toBe(false);
    expect(can({ id: "a", role: "viewer" }, "read")).toBe(true);
  });
});
