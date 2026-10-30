import type { FileEntry, WorldSnapshot } from "@dramatis-personae/schema";

export const WORLD = "0v2zt9rkngnagdl3";
export const IDS = {
  arthur: "arthurxxxxxxxxxx",
  merlin: "merlinxxxxxxxxxx",
  lancelot: "lancelotxxxxxxxx",
  knights: "knightsxxxxxxxxx",
  knightTemplate: "knighttemplatexx",
  court: "courtxxxxxxxxxxx",
};

const fingerprint = (seed: string) => seed.padEnd(64, "0").slice(0, 64);

export function characterFile(id: string, name: string, roles: string[] = []): FileEntry {
  return {
    ref: { kind: "character", id },
    path: `characters/${name.toLowerCase()}-${id}.json`,
    data: { id, name, color: null, roles, templates: [], extraFields: [], fields: {}, body: "" },
    fingerprint: fingerprint(`${id}${name}`),
  };
}

/** `file` with `patch` merged into its data. */
export function withData(file: FileEntry, patch: Record<string, unknown>): FileEntry {
  return { ...file, data: { ...(file.data as object), ...patch } };
}

const FIELD_DEFINITIONS = [
  { key: "birthday", label: "Birthday", type: "date", default: true },
  { key: "title", label: "Title", type: "text", default: true },
  { key: "liege", label: "Liege", type: "character", default: false },
  { key: "weapon", label: "Weapon", type: "text", default: false },
  { key: "steed", label: "Steed", type: "text", default: false },
  {
    key: "bloodType",
    label: "Blood type",
    type: "select",
    default: false,
    options: ["A", "B", "AB", "O"],
  },
];

/**
 * The small Camelot with a field library (subtitle: title), a Knight template,
 * Lancelot as a Knight with values, and Merlin with a one-off Blood type.
 */
export function profileSnapshot(): WorldSnapshot {
  const base = snapshot();
  const files = base.files.map((file) => {
    if (file.ref.kind !== "character") return file;
    if (file.ref.id === IDS.lancelot) {
      return withData(file, {
        templates: [IDS.knightTemplate],
        fields: {
          title: "Knight of the Round Table",
          birthday: { calendar: "gregorian", month: 8, day: 15 },
          weapon: "Arondight",
        },
      });
    }
    if (file.ref.id === IDS.merlin) {
      return withData(file, { extraFields: ["bloodType"], fields: { bloodType: "O" } });
    }
    return file;
  });
  files.push(
    {
      ref: { kind: "fields" },
      path: "fields.json",
      data: { subtitle: "title", fields: FIELD_DEFINITIONS },
      fingerprint: fingerprint("fields"),
    },
    {
      ref: { kind: "templates" },
      path: "templates.json",
      data: {
        templates: [
          {
            id: IDS.knightTemplate,
            name: "Knight",
            role: IDS.knights,
            fields: ["weapon", "steed"],
          },
        ],
      },
      fingerprint: fingerprint("templates"),
    },
  );
  return { ...base, files };
}

/** A small Camelot: Arthur, Merlin and Lancelot (a Knight of the Round Table). */
export function snapshot(overrides: Partial<WorldSnapshot> = {}): WorldSnapshot {
  return {
    world: { id: WORLD, name: "Camelot", folder: `camelot-${WORLD}`, schemaVersion: 1 },
    readOnly: false,
    unsaved: null,
    problems: [],
    seq: 5,
    files: [
      {
        ref: { kind: "world" },
        path: "world.json",
        data: { id: WORLD, name: "Camelot", schemaVersion: 1, mainView: null },
        fingerprint: fingerprint("world"),
      },
      {
        ref: { kind: "roles" },
        path: "roles.json",
        data: {
          roles: [
            {
              id: IDS.knights,
              name: "Knights of the Round Table",
              kind: "major",
              color: "#3b6fd4",
              leaders: [],
            },
          ],
        },
        fingerprint: fingerprint("roles"),
      },
      characterFile(IDS.arthur, "Arthur"),
      characterFile(IDS.merlin, "Merlin"),
      characterFile(IDS.lancelot, "Lancelot", [IDS.knights]),
    ],
    ...overrides,
  };
}
