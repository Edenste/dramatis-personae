import { describe, expect, it } from "vitest";
import { FILE_SCHEMAS, schemaRefFor } from "@dramatis-personae/schema";
import {
  DEFAULT_CHARACTER_COLOR,
  DEFAULT_FIELDS,
  DEFAULT_RELATIONSHIP_TYPES,
  newWorldFiles,
} from "./defaults.ts";

// Spec §5.4. "solid" alone means weight normal.
const expected = [
  ["Family", "two-way", "#e0a030", "solid", "normal"],
  ["Friends", "two-way", "#3fa34d", "solid", "normal"],
  ["Close friends", "two-way", "#2bb673", "solid", "thick"],
  ["Acquaintances", "two-way", "#9aa0a6", "dotted", "normal"],
  ["Partners", "two-way", "#e05a8a", "solid", "thick"],
  ["Former partners", "two-way", "#c99aae", "dashed", "normal"],
  ["Allies", "two-way", "#3b82f6", "solid", "normal"],
  ["Colleagues", "two-way", "#64748b", "solid", "thin"],
  ["Rivals", "two-way", "#f08c2e", "dashed", "normal"],
  ["Enemies", "two-way", "#d64545", "dashed", "thick"],
  ["Crush", "one-way", "#f29cc0", "dotted", "normal"],
  ["Mentor", "one-way", "#8b5cf6", "solid", "normal"],
  ["Student", "one-way", "#a78bfa", "dashed", "normal"],
  ["Leader", "one-way", "#4f46e5", "solid", "normal"],
  ["Follower", "one-way", "#818cf8", "dashed", "normal"],
  ["Parent", "one-way", "#e0a030", "solid", "normal"],
  ["Child", "one-way", "#e0a030", "dashed", "normal"],
  ["Admirer", "one-way", "#f2b8d0", "dotted", "thin"],
  ["Protector", "one-way", "#0ea5a4", "solid", "normal"],
];

describe("default relationship types", () => {
  it("match the spec table", () => {
    expect(
      DEFAULT_RELATIONSHIP_TYPES.map((t) => [
        t.name,
        t.direction,
        t.color,
        t.line.style,
        t.line.weight,
      ]),
    ).toEqual(expected);
  });

  it("never share both colour and line within a direction", () => {
    const seen = new Set<string>();
    for (const t of DEFAULT_RELATIONSHIP_TYPES) {
      const key = `${t.direction}|${t.color}|${t.line.style}|${t.line.weight}`;
      expect(seen.has(key), t.name).toBe(false);
      seen.add(key);
    }
  });
});

describe("default fields", () => {
  it("is just the birthday, shown on the calendar", () => {
    expect(DEFAULT_FIELDS).toEqual([
      {
        key: "birthday",
        label: "Birthday",
        type: "date",
        section: "personal",
        default: true,
        calendar: { show: true, color: "#e0a030", title: "{name}'s birthday" },
      },
    ]);
  });

  it("uses Discord-style grey for characters with no colour", () => {
    expect(DEFAULT_CHARACTER_COLOR).toBe("#99aab5");
  });
});

describe("newWorldFiles", () => {
  const files = newWorldFiles("Camelot");

  it("produces files that pass their schemas", () => {
    expect(FILE_SCHEMAS.world.safeParse(files.world).success).toBe(true);
    expect(FILE_SCHEMAS.fields.safeParse(files.fields).success).toBe(true);
    expect(FILE_SCHEMAS.roles.safeParse(files.roles).success).toBe(true);
    expect(FILE_SCHEMAS.relationshipTypes.safeParse(files.relationshipTypes).success).toBe(true);
    expect(FILE_SCHEMAS.templates.safeParse(files.templates).success).toBe(true);
    expect(FILE_SCHEMAS.view.safeParse(files.mainView).success).toBe(true);
  });

  it("starts at schema version 1 with the main view selected", () => {
    expect(files.world.schemaVersion).toBe(1);
    expect(files.world.mainView).toBe(files.mainView.id);
    expect(files.world.name).toBe("Camelot");
  });

  it("has an empty role list, an empty template list and a default main view", () => {
    expect(files.roles.roles).toEqual([]);
    expect(files.templates.templates).toEqual([]);
    expect(files.mainView).toMatchObject({
      name: "Main",
      camera: { x: 0, y: 0, zoom: 1 },
      focus: null,
      depth: null,
      filters: {},
      clustering: "highest",
    });
  });

  it("points every file at its schema", () => {
    expect(files.world.$schema).toBe(schemaRefFor("world"));
    expect(files.fields.$schema).toBe(schemaRefFor("fields"));
    expect(files.roles.$schema).toBe(schemaRefFor("roles"));
    expect(files.relationshipTypes.$schema).toBe(schemaRefFor("relationshipTypes"));
    expect(files.templates.$schema).toBe(schemaRefFor("templates"));
    expect(files.mainView.$schema).toBe(schemaRefFor("view"));
  });

  it("gives every world its own ids", () => {
    const other = newWorldFiles("Camelot");
    expect(other.world.id).not.toBe(files.world.id);
    expect(other.relationshipTypes.types[0]?.id).not.toBe(files.relationshipTypes.types[0]?.id);
  });
});
