import { beforeAll, describe, expect, it } from "vitest";
import { CAMELOT_IDS } from "@dramatis-personae/samples";
import type { FileRef, ProblemCode } from "@dramatis-personae/schema";
import { editFile, loadCamelotModel } from "../test-utils/camelot-model.ts";
import type { WorldModel } from "./world-model.ts";

const C = CAMELOT_IDS.characters;
const R = CAMELOT_IDS.roles;
const T = CAMELOT_IDS.relationshipTypes;
const char = (name: string): FileRef => ({ kind: "character", id: C[name]! });

let camelot: WorldModel;
beforeAll(async () => {
  camelot = await loadCamelotModel();
});

function relationshipBetween(model: WorldModel, a: string, b: string) {
  return model
    .all("relationship")
    .find((r) => (r.a === C[a] && r.b === C[b]) || (r.a === C[b] && r.b === C[a]))!;
}

describe("crossFileProblems", () => {
  it("finds nothing wrong with the sample world", () => {
    expect(camelot.problems()).toEqual([]);
  });

  const cases: Array<
    [string, (m: WorldModel) => WorldModel, ProblemCode, (m: WorldModel) => string]
  > = [
    [
      "a character with an unknown role",
      (m) => editFile(m, char("Kay"), (d) => void (d.roles = ["zzzzzzzzzzzzzzzz"])),
      "dangling-reference",
      (m) => `characters/${m.fileName(char("Kay"))}`,
    ],
    [
      "a relationship with an unknown character",
      (m) => {
        const r = relationshipBetween(m, "Arthur", "Kay");
        return editFile(
          m,
          { kind: "relationship", id: r.id },
          (d) => void (d.b = "zzzzzzzzzzzzzzzz"),
        );
      },
      "dangling-reference",
      (m) =>
        `relationships/${m.fileName({ kind: "relationship", id: relationshipBetween(camelot, "Arthur", "Kay").id })}`,
    ],
    [
      "a subtitle naming a field that isn't in the library",
      (m) => editFile(m, { kind: "fields" }, (d) => void (d.subtitle = "nope")),
      "dangling-reference",
      () => "fields.json",
    ],
    [
      "an event listing an unknown character",
      (m) =>
        editFile(
          m,
          { kind: "event", id: CAMELOT_IDS.events["Battle of Badon"]! },
          (d) => void (d.characters = ["zzzzzzzzzzzzzzzz"]),
        ),
      "dangling-reference",
      (m) => `events/${m.fileName({ kind: "event", id: CAMELOT_IDS.events["Battle of Badon"]! })}`,
    ],
    [
      "a main view that doesn't exist",
      (m) => editFile(m, { kind: "world" }, (d) => void (d.mainView = "zzzzzzzzzzzzzzzz")),
      "dangling-reference",
      () => "world.json",
    ],
    [
      "a template field that isn't in the library",
      (m) =>
        editFile(m, { kind: "templates" }, (d) => {
          (d.templates as Array<{ fields: string[] }>)[0]!.fields.push("horse");
        }),
      "dangling-reference",
      () => "templates.json",
    ],
    [
      "a leader who no longer has the role",
      (m) =>
        editFile(m, char("Arthur"), (d) => {
          d.roles = (d.roles as string[]).filter((r) => r !== R["Knights of the Round Table"]);
        }),
      "leader-without-role",
      () => "roles.json",
    ],
    [
      "a second file for the same pair, the other way round",
      (m) => {
        const original = relationshipBetween(m, "Arthur", "Mordred");
        return m.withFiles([
          {
            ref: { kind: "relationship", id: "dup0000000000000" },
            fileName: "mordred-arthur-dup0000000000000.json",
            data: { ...original, id: "dup0000000000000", a: original.b, b: original.a },
            fingerprint: "x",
          },
        ]);
      },
      "duplicate-pair",
      () => "relationships/mordred-arthur-dup0000000000000.json",
    ],
    [
      "a relationship from a character to themselves",
      (m) => {
        const r = relationshipBetween(m, "Arthur", "Kay");
        return editFile(m, { kind: "relationship", id: r.id }, (d) => void (d.b = d.a));
      },
      "self-relationship",
      (m) =>
        `relationships/${m.fileName({ kind: "relationship", id: relationshipBetween(camelot, "Arthur", "Kay").id })}`,
    ],
    [
      "a one-way type in the two-way list",
      (m) => {
        const r = relationshipBetween(m, "Arthur", "Kay");
        return editFile(m, { kind: "relationship", id: r.id }, (d) => void (d.twoWay = [T.Mentor]));
      },
      "type-direction-mismatch",
      (m) =>
        `relationships/${m.fileName({ kind: "relationship", id: relationshipBetween(camelot, "Arthur", "Kay").id })}`,
    ],
    [
      "a select value that isn't an option",
      (m) =>
        editFile(
          m,
          char("Merlin"),
          (d) => void ((d.fields as Record<string, unknown>).bloodType = "Q"),
        ),
      "invalid-field-value",
      (m) => `characters/${m.fileName(char("Merlin"))}`,
    ],
    [
      "a date that doesn't exist",
      (m) =>
        editFile(m, char("Lancelot"), (d) => {
          (d.fields as Record<string, unknown>).birthday = {
            calendar: "gregorian",
            month: 2,
            day: 30,
          };
        }),
      "invalid-field-value",
      (m) => `characters/${m.fileName(char("Lancelot"))}`,
    ],
    [
      "a value for a field that isn't in the library",
      (m) =>
        editFile(
          m,
          char("Kay"),
          (d) => void ((d.fields as Record<string, unknown>).unknownKey = 1),
        ),
      "invalid-field-value",
      (m) => `characters/${m.fileName(char("Kay"))}`,
    ],
    [
      "a portrait file that's missing",
      (m) =>
        editFile(m, char("Arthur"), (d) => {
          (d.portrait as { file: string }).file = "missing.jpg";
        }),
      "missing-portrait",
      (m) => `characters/${m.fileName(char("Arthur"))}`,
    ],
    [
      "an SVG portrait",
      (m) =>
        editFile(m, char("Arthur"), (d) => {
          (d.portrait as { file: string }).file = "arthur.svg";
        }),
      "unsupported-portrait",
      (m) => `characters/${m.fileName(char("Arthur"))}`,
    ],
  ];

  it.each(cases)("reports %s", (_label, mutate, code, path) => {
    const problems = mutate(camelot).problems();
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({ code, path: path(camelot) });
  });

  it("offers to remove a dangling role reference", () => {
    const model = editFile(camelot, char("Kay"), (d) => void (d.roles = ["zzzzzzzzzzzzzzzz"]));
    expect(model.problems()[0]).toMatchObject({ fix: "removeReference", ref: char("Kay") });
  });

  it("allows 29 February", () => {
    const model = editFile(camelot, char("Lancelot"), (d) => {
      (d.fields as Record<string, unknown>).birthday = { calendar: "gregorian", month: 2, day: 29 };
    });
    expect(model.problems()).toEqual([]);
  });
});
