import { describe, expect, it } from "vitest";
import { FixRequestSchema, ServerMessageSchema, SettingsUpdateSchema } from "./api.ts";

const world = "0v2zt9rkngnagdl3";
const kay = { kind: "character", id: "2mxafd1whkfr51wp" } as const;

describe("SettingsUpdateSchema", () => {
  it("accepts absolute data paths on either platform, or null", () => {
    expect(SettingsUpdateSchema.safeParse({ dataPath: "C:\\Worlds" }).success).toBe(true);
    expect(SettingsUpdateSchema.safeParse({ dataPath: "/home/x/worlds" }).success).toBe(true);
    expect(SettingsUpdateSchema.safeParse({ dataPath: null }).success).toBe(true);
    expect(SettingsUpdateSchema.safeParse({ theme: "dark" }).success).toBe(true);
  });

  it("rejects a relative data path", () => {
    expect(SettingsUpdateSchema.safeParse({ dataPath: "relative/dir" }).success).toBe(false);
  });
});

describe("ServerMessageSchema", () => {
  it.each([
    {
      type: "changed",
      world,
      files: [
        {
          ref: kay,
          path: "characters/kay-2mxafd1whkfr51wp.json",
          data: {},
          fingerprint: "a".repeat(64),
        },
      ],
      removed: ["character:2mxafd1whkfr51wp"],
    },
    { type: "problems", world, problems: [] },
    { type: "conflict", world, refs: ["character:2mxafd1whkfr51wp"], message: "Changed" },
    { type: "save-state", world, unsaved: true, message: "Couldn't save" },
    { type: "reload", world },
  ])("parses a $type message", (message) => {
    expect(ServerMessageSchema.parse(message)).toEqual(message);
  });

  it("rejects an unknown type", () => {
    expect(ServerMessageSchema.safeParse({ type: "nope", world }).success).toBe(false);
  });
});

describe("FixRequestSchema", () => {
  it("needs a ref to remove a reference and a path to assign an id", () => {
    expect(FixRequestSchema.safeParse({ fix: "removeReference", ref: kay }).success).toBe(true);
    expect(FixRequestSchema.safeParse({ fix: "removeReference", path: "x" }).success).toBe(false);
    expect(
      FixRequestSchema.safeParse({ fix: "assignNewId", path: "characters/x.json" }).success,
    ).toBe(true);
  });
});
