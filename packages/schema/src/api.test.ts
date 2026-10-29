import { describe, expect, it } from "vitest";
import {
  FixRequestSchema,
  ServerMessageSchema,
  SettingsUpdateSchema,
  StatusSchema,
  WorldSnapshotSchema,
} from "./api.ts";

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
  const messages = [
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
  ];

  it.each(messages)("parses a $type message with its sequence number", (message) => {
    const numbered = { ...message, seq: 3 };
    expect(ServerMessageSchema.parse(numbered)).toEqual(numbered);
  });

  it.each(messages)("rejects a $type message without a sequence number", (message) => {
    expect(ServerMessageSchema.safeParse(message).success).toBe(false);
  });

  it("rejects an unknown type", () => {
    expect(ServerMessageSchema.safeParse({ type: "nope", world, seq: 1 }).success).toBe(false);
  });
});

describe("WorldSnapshotSchema", () => {
  const snapshot = {
    world: { id: world, name: "Camelot", folder: "camelot-0v2zt9rkngnagdl3", schemaVersion: 1 },
    readOnly: false,
    unsaved: null,
    files: [],
    problems: [],
  };

  it("needs a sequence number", () => {
    expect(WorldSnapshotSchema.safeParse(snapshot).success).toBe(false);
    expect(WorldSnapshotSchema.safeParse({ ...snapshot, seq: 0 }).success).toBe(true);
  });
});

describe("StatusSchema", () => {
  const status = { version: "1.0.0", dataRoot: "/data", writable: true };

  it("reports the desktop app's window controls, or null without one", () => {
    expect(StatusSchema.safeParse({ ...status, desktop: null }).success).toBe(true);
    expect(StatusSchema.safeParse({ ...status, desktop: { windowControls: "left" } }).success).toBe(
      true,
    );
    expect(StatusSchema.safeParse({ ...status, desktop: { windowControls: "top" } }).success).toBe(
      false,
    );
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
