import { beforeAll, describe, expect, it } from "vitest";
import { CAMELOT_IDS } from "@dramatis-personae/samples";
import type { FileRef } from "@dramatis-personae/schema";
import { editFile, loadCamelotModel } from "../test-utils/camelot-model.ts";
import type { WorldModel } from "./world-model.ts";

const C = CAMELOT_IDS.characters;
const R = CAMELOT_IDS.roles;
const char = (name: string): FileRef => ({ kind: "character", id: C[name]! });

let camelot: WorldModel;
beforeAll(async () => {
  camelot = await loadCamelotModel();
});

describe("WorldModel indexes", () => {
  it("finds a character's relationships whichever side they are on", () => {
    const pairs = camelot.relationshipsOf(C.Arthur!).map((r) => [r.a, r.b]);
    expect(pairs).toContainEqual([C.Arthur, C.Mordred]);
    expect(pairs).toContainEqual([C.Merlin, C.Arthur]);
  });

  it("lists a role's members", () => {
    expect(camelot.membersOf(R["Knights of the Round Table"]!)).toEqual(
      expect.arrayContaining([C.Lancelot, C.Gawain]),
    );
  });
});

describe("characterColor", () => {
  const withRoles = (roles: string[], color: string | null = null) =>
    editFile(camelot, char("Kay"), (d) => {
      d.roles = roles;
      d.color = color;
    });

  it("uses the character's own colour first", () => {
    expect(withRoles([R["Knights of the Round Table"]!], "#123456").characterColor(C.Kay!)).toBe(
      "#123456",
    );
  });

  it("prefers a coloured major role over a coloured minor role listed first", () => {
    const model = withRoles([R["Grail Quest"]!, R.Avalon!, R["Court of Camelot"]!]);
    const court = model.library("roles").roles.find((r) => r.id === R["Court of Camelot"]);
    expect(model.characterColor(C.Kay!)).toBe(court?.color);
  });

  it("falls back to grey", () => {
    expect(withRoles([]).characterColor(C.Kay!)).toBe("#99aab5");
  });
});

describe("shownFieldKeys", () => {
  it("shows the default fields plus the character's templates", () => {
    expect(camelot.shownFieldKeys(C.Lancelot!)).toEqual([
      "birthday",
      "title",
      "liege",
      "weapon",
      "steed",
    ]);
  });

  it("hides a removed template's fields but keeps their values", () => {
    const model = editFile(camelot, char("Gawain"), (d) => void (d.templates = []));
    expect(model.shownFieldKeys(C.Gawain!)).not.toContain("steed");
    expect(model.get("character", C.Gawain!)?.fields.steed).toBe("Gringolet");
  });
});

describe("dateEntries", () => {
  it("includes birthdays shown on the calendar and events", () => {
    const entries = camelot.dateEntries();
    expect(entries).toContainEqual(
      expect.objectContaining({
        source: { kind: "field", characterId: C.Lancelot, key: "birthday" },
        title: "Lancelot's birthday",
        repeat: "yearly",
        color: "#e0a030",
      }),
    );
    expect(entries).toContainEqual(
      expect.objectContaining({
        source: { kind: "event", eventId: CAMELOT_IDS.events["Battle of Badon"] },
        title: "Battle of Badon",
      }),
    );
  });
});

describe("immutability and blocking", () => {
  it("returns a new model from withFiles and leaves the old one alone", () => {
    const renamed = editFile(camelot, char("Kay"), (d) => void (d.name = "Sir Kay"));
    expect(renamed).not.toBe(camelot);
    expect(renamed.get("character", C.Kay!)?.name).toBe("Sir Kay");
    expect(camelot.get("character", C.Kay!)?.name).toBe("Kay");
  });

  it("removes a file", () => {
    const model = camelot.withFiles([{ ref: char("Kay"), removed: true }]);
    expect(model.get("character", C.Kay!)).toBeUndefined();
    expect(model.fileName(char("Kay"))).toBeUndefined();
  });

  it("blocks a document while its file is invalid on disk, keeping the last good version", () => {
    const path = `characters/${camelot.fileName(char("Kay"))}`;
    const problem = { code: "invalid-json", path, message: "Unexpected end" } as const;
    const blocked = camelot.withInvalid(path, problem);
    expect(blocked.isBlocked(char("Kay"))).toBe(true);
    expect(blocked.get("character", C.Kay!)?.name).toBe("Kay");
    expect(blocked.problems()).toContainEqual(problem);
    const fixed = blocked.withValid(path);
    expect(fixed.isBlocked(char("Kay"))).toBe(false);
    expect(fixed.problems()).toEqual([]);
  });

  it("snapshots every file by ref key", () => {
    const snapshot = camelot.snapshot();
    expect(snapshot[`character:${C.Kay}`]).toMatchObject({ name: "Kay" });
    expect(snapshot.world).toMatchObject({ name: "Camelot" });
  });
});
