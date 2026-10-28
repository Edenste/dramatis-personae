import { describe, expect, it } from "vitest";
import { parseRefKey, refKey, type FileRef } from "../refs.ts";
import { FILE_SCHEMAS, CharacterFileSchema, FieldDefinitionSchema } from "./index.ts";

const id = "pm6i0t9upq3sgptb";
const other = "c1a9m3x8k2q7v5w0";

// The examples from spec §5, one per file kind.
const examples = {
  world: {
    $schema: "./world.schema.json",
    id: "x1y2z3w4v5u6t7s8",
    name: "Camelot",
    schemaVersion: 1,
    mainView: "v9x2k7m4q1r8w3t5",
  },
  character: {
    $schema: "../world.schema.json",
    id,
    name: "Lancelot",
    color: null,
    roles: ["k3v8m1x9q2r7w4t6"],
    templates: ["t2m8x4k1q9v7r3w5"],
    extraFields: ["bloodType"],
    fields: {
      title: "Knight of the Round Table",
      birthday: { calendar: "gregorian", month: 8, day: 15 },
      bloodType: "O",
    },
    portrait: {
      file: "lancelot-pm6i0t9upq3sgptb.png",
      crop: { x: 0.18, y: 0.05, size: 0.62 },
    },
    body: "## Backstory\nRaised by the Lady of the Lake…",
  },
  relationship: {
    id: "r8f2k9q1m5x3v7w4",
    a: other,
    b: "d4m7r2k9x1q8v3w6",
    twoWay: ["h3k9m2x7q1v8r4w6", "z5q1w7r3m9x2k8v4"],
    aToB: [],
    bToA: [],
    notes: { a: "", b: "" },
  },
  event: {
    id: "e4k8m2q9x1v7r3w5",
    title: "Battle of Badon",
    date: { calendar: "gregorian", year: 516, month: 5, day: 2 },
    repeat: "yearly",
    color: "#d64545",
    characters: [other],
    body: "",
  },
  view: {
    id: "v9x2k7m4q1r8w3t5",
    name: "Main",
    camera: { x: 0, y: 0, zoom: 1 },
    focus: null,
    depth: null,
    filters: {},
    clustering: "highest",
  },
  search: { id: "s1k2m3x4q5v6r7w8", name: "Knights", query: {} },
  fields: {
    fields: [
      {
        key: "birthday",
        label: "Birthday",
        type: "date",
        section: "personal",
        default: true,
        calendar: { show: true, color: "#e0a030", title: "{name}'s birthday" },
      },
      {
        key: "bloodType",
        label: "Blood type",
        type: "select",
        section: "personal",
        default: false,
        options: ["A", "B", "AB", "O"],
      },
    ],
  },
  roles: {
    roles: [
      {
        id: "k3v8m1x9q2r7w4t6",
        name: "Knights of the Round Table",
        kind: "major",
        color: "#3b6fd4",
        leaders: [other],
      },
      { id: "n5q2w8r1m7x4k9v3", name: "Grail Quest", kind: "minor", color: null, leaders: [] },
    ],
  },
  relationshipTypes: {
    types: [
      {
        id: "f8k2m9q4x1v7r3w5",
        name: "Friends",
        direction: "two-way",
        color: "#3fa34d",
        line: { style: "solid", weight: "normal" },
      },
    ],
  },
  templates: {
    templates: [
      {
        id: "t2m8x4k1q9v7r3w5",
        name: "Knight",
        role: "k3v8m1x9q2r7w4t6",
        fields: ["title", "liege", "weapon", "steed"],
      },
    ],
  },
} as const;

describe("file schemas", () => {
  it.each(Object.keys(examples) as (keyof typeof examples)[])(
    "accepts the spec example for %s",
    (kind) => {
      expect(FILE_SCHEMAS[kind].safeParse(examples[kind]).success).toBe(true);
    },
  );

  it("fills in character defaults", () => {
    expect(CharacterFileSchema.parse({ id, name: "Kay" })).toMatchObject({
      color: null,
      roles: [],
      templates: [],
      extraFields: [],
      fields: {},
      body: "",
    });
  });

  it("leaves self-relationships to the cross-file checks", () => {
    const self = { ...examples.relationship, a: other, b: other };
    expect(FILE_SCHEMAS.relationship.safeParse(self).success).toBe(true);
  });

  it("keeps unknown keys", () => {
    const parsed = CharacterFileSchema.parse({ id, name: "Kay", nickname: "Seneschal" });
    expect((parsed as Record<string, unknown>).nickname).toBe("Seneschal");
  });

  it.each([
    [
      "an uppercase id",
      () => CharacterFileSchema.safeParse({ id: "PM6i0t9upq3sgptb", name: "Kay" }),
    ],
    [
      "month 13",
      () =>
        FILE_SCHEMAS.event.safeParse({
          ...examples.event,
          date: { calendar: "gregorian", month: 13 },
        }),
    ],
    ["a named colour", () => CharacterFileSchema.safeParse({ id, name: "Kay", color: "red" })],
    [
      "a select field without options",
      () =>
        FieldDefinitionSchema.safeParse({
          key: "house",
          label: "House",
          type: "select",
          default: false,
        }),
    ],
    [
      "calendar settings on a text field",
      () =>
        FieldDefinitionSchema.safeParse({
          key: "title",
          label: "Title",
          type: "text",
          default: true,
          calendar: { show: true, color: null, title: "{name}" },
        }),
    ],
    [
      "a wavy line style",
      () =>
        FILE_SCHEMAS.relationshipTypes.safeParse({
          types: [
            {
              ...examples.relationshipTypes.types[0],
              line: { style: "wavy", weight: "normal" },
            },
          ],
        }),
    ],
  ])("rejects %s", (_label, parse) => {
    expect(parse().success).toBe(false);
  });
});

describe("refs", () => {
  it("builds a key for a document", () => {
    expect(refKey({ kind: "character", id })).toBe(`character:${id}`);
  });

  it.each<FileRef>([
    { kind: "world" },
    { kind: "roles" },
    { kind: "fields" },
    { kind: "relationshipTypes" },
    { kind: "templates" },
    { kind: "character", id },
    { kind: "relationship", id },
    { kind: "event", id },
    { kind: "view", id },
    { kind: "search", id },
  ])("round-trips %j", (ref) => {
    expect(parseRefKey(refKey(ref))).toEqual(ref);
  });
});
