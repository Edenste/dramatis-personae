import { beforeAll, describe, expect, it } from "vitest";
import { CAMELOT_IDS } from "@dramatis-personae/samples";
import { refKey, type FileRef } from "@dramatis-personae/schema";
import { applyBatch } from "./commands/index.ts";
import { referenceFix } from "./fixes.ts";
import type { WorldModel } from "./model/world-model.ts";
import { editFile, loadCamelotModel } from "./test-utils/camelot-model.ts";

const owner = { id: "local", role: "owner" } as const;
const MISSING = "zzzzzzzzzzzzzzzz";
const kay: FileRef = { kind: "character", id: CAMELOT_IDS.characters.Kay! };

let camelot: WorldModel;
beforeAll(async () => {
  camelot = await loadCamelotModel();
});

function dangling(model: WorldModel, ref: FileRef) {
  return model
    .problems()
    .filter((p) => p.code === "dangling-reference" && p.ref && refKey(p.ref) === refKey(ref));
}

/** Applies the fix as a restore command and returns the resulting model. */
function applyFix(model: WorldModel, ref: FileRef): WorldModel {
  const fix = referenceFix(model, ref);
  expect(fix).not.toBeNull();
  const result = applyBatch(model, { commands: [{ type: "restore", files: [fix!] }] }, owner);
  if (!result.ok) throw new Error(result.error.message);
  return result.model;
}

describe("referenceFix", () => {
  it("returns null for a file with no dangling references", () => {
    expect(referenceFix(camelot, kay)).toBeNull();
  });

  it("removes an unknown role from a character and keeps everything else", () => {
    const model = editFile(camelot, kay, (d) => {
      d.roles = [...(d.roles as string[]), MISSING];
      d.handWritten = { note: "kept" };
    });
    expect(dangling(model, kay)).toHaveLength(1);
    const fix = referenceFix(model, kay)!;
    expect(fix.data.roles).toEqual(camelot.get("character", CAMELOT_IDS.characters.Kay!)!.roles);
    expect(fix.data.handWritten).toEqual({ note: "kept" });
    expect(fix.fileName).toBe(camelot.fileName(kay));
    expect(dangling(applyFix(model, kay), kay)).toEqual([]);
  });

  it("removes an unknown type from a relationship", () => {
    const relationship = camelot.all("relationship")[0]!;
    const ref: FileRef = { kind: "relationship", id: relationship.id };
    const model = editFile(camelot, ref, (d) => {
      d.aToB = [...(d.aToB as string[]), MISSING];
    });
    expect(dangling(model, ref)).toHaveLength(1);
    expect(referenceFix(model, ref)!.data.aToB).toEqual(relationship.aToB);
    expect(dangling(applyFix(model, ref), ref)).toEqual([]);
  });

  it("removes an unknown character from an event", () => {
    const event = camelot.all("event")[0]!;
    const ref: FileRef = { kind: "event", id: event.id };
    const model = editFile(camelot, ref, (d) => {
      d.characters = [...(d.characters as string[]), MISSING];
    });
    expect(referenceFix(model, ref)!.data.characters).toEqual(event.characters);
    expect(dangling(applyFix(model, ref), ref)).toEqual([]);
  });

  it("removes a leader who doesn't exist from roles.json", () => {
    const ref: FileRef = { kind: "roles" };
    const model = editFile(camelot, ref, (d) => {
      const roles = d.roles as Array<{ leaders: string[] }>;
      roles[0]!.leaders = [...roles[0]!.leaders, MISSING];
    });
    expect(dangling(model, ref)).toHaveLength(1);
    const fixed = referenceFix(model, ref)!.data.roles as Array<{ leaders: string[] }>;
    expect(fixed[0]!.leaders).toEqual(camelot.library("roles").roles[0]!.leaders);
    expect(dangling(applyFix(model, ref), ref)).toEqual([]);
  });
});
